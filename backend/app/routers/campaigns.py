"""
Campaigns router — create, list, detail, and send.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.segment import Segment
from app.models.customer import Customer
from app.services.segmentation import preview_segment, get_segment_customers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ---------- request schemas ----------

class CreateCampaignBody(BaseModel):
    name: str = Field(..., max_length=150)
    objective: str = Field(..., max_length=500)
    segment_id: uuid.UUID
    channel: str  # email | whatsapp | sms
    message_template: str


# ---------- helper ----------

async def _get_delivery_stats(db: AsyncSession, campaign_id: uuid.UUID) -> dict:
    """Count campaign_recipients grouped by status for inline stats."""
    stmt = (
        select(
            CampaignRecipient.current_status,
            func.count(CampaignRecipient.id),
        )
        .where(CampaignRecipient.campaign_id == campaign_id)
        .group_by(CampaignRecipient.current_status)
    )
    result = await db.execute(stmt)
    rows = result.all()

    stats = {"sent": 0, "delivered": 0, "failed": 0, "opened": 0, "read": 0, "clicked": 0}
    for status, count in rows:
        if status in stats:
            stats[status] = count
    # Also count totals for statuses that supersede earlier ones
    # e.g. a 'clicked' recipient was also 'opened', 'delivered', 'sent'
    return stats


# ---------- endpoints ----------

@router.post("")
async def create_campaign(body: CreateCampaignBody, db: AsyncSession = Depends(get_db)):
    """Create a new draft campaign. Computes audience_size from segment rules."""
    # Verify segment exists
    seg_result = await db.execute(select(Segment).where(Segment.id == body.segment_id))
    segment = seg_result.scalars().first()
    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment {body.segment_id} not found")

    # Compute audience size
    preview = await preview_segment(db, segment.rule_json)
    audience_size = preview["count"]

    campaign = Campaign(
        name=body.name,
        objective=body.objective,
        segment_id=body.segment_id,
        channel=body.channel,
        message_template=body.message_template,
        status="draft",
        audience_size=audience_size,
    )
    db.add(campaign)
    await db.flush()
    await db.refresh(campaign)

    return {
        "id": str(campaign.id),
        "name": campaign.name,
        "objective": campaign.objective,
        "segment_id": str(campaign.segment_id),
        "channel": campaign.channel,
        "message_template": campaign.message_template,
        "status": campaign.status,
        "audience_size": campaign.audience_size,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "launched_at": None,
    }


@router.get("")
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    """List all campaigns with inline delivery stats."""
    stmt = select(Campaign).order_by(Campaign.created_at.desc())
    result = await db.execute(stmt)
    campaigns = result.scalars().all()

    output = []
    for c in campaigns:
        stats = await _get_delivery_stats(db, c.id)
        output.append({
            "id": str(c.id),
            "name": c.name,
            "status": c.status,
            "channel": c.channel,
            "audience_size": c.audience_size,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "launched_at": c.launched_at.isoformat() if c.launched_at else None,
            **stats,
        })

    return output


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return full campaign object with analytics and recipients list."""
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    # Get raw stats
    stats = await _get_delivery_stats(db, campaign_id)

    # Compute cumulative counts for rates
    # Status precedence: pending < sent < delivered < opened < read < clicked
    total = campaign.audience_size or 0
    sent = stats.get("sent", 0) + stats.get("delivered", 0) + stats.get("opened", 0) + stats.get("read", 0) + stats.get("clicked", 0)
    delivered = stats.get("delivered", 0) + stats.get("opened", 0) + stats.get("read", 0) + stats.get("clicked", 0)
    opened = stats.get("opened", 0) + stats.get("read", 0) + stats.get("clicked", 0)
    read = stats.get("read", 0) + stats.get("clicked", 0)
    clicked = stats.get("clicked", 0)
    failed = stats.get("failed", 0)

    delivery_rate = round((delivered / sent * 100), 1) if sent > 0 else 0
    open_rate = round((opened / delivered * 100), 1) if delivered > 0 else 0
    click_rate = round((clicked / opened * 100), 1) if opened > 0 else 0

    # Get recipients with customer info
    recipients_stmt = (
        select(CampaignRecipient)
        .options(selectinload(CampaignRecipient.customer))
        .where(CampaignRecipient.campaign_id == campaign_id)
        .order_by(CampaignRecipient.sent_at.desc().nullslast())
    )
    recipients_result = await db.execute(recipients_stmt)
    recipients = recipients_result.scalars().all()

    recipients_list = []
    for r in recipients:
        # Determine last event time
        times = [t for t in [r.sent_at, r.delivered_at, r.opened_at, r.read_at, r.clicked_at, r.converted_at] if t]
        last_event = max(times).isoformat() if times else None

        recipients_list.append({
            "id": str(r.id),
            "customer_name": f"{r.customer.first_name} {r.customer.last_name}" if r.customer else "Unknown",
            "email": r.customer.email if r.customer else None,
            "current_status": r.current_status,
            "last_event_time": last_event,
        })

    return {
        "id": str(campaign.id),
        "name": campaign.name,
        "objective": campaign.objective,
        "segment_id": str(campaign.segment_id),
        "channel": campaign.channel,
        "message_template": campaign.message_template,
        "status": campaign.status,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "launched_at": campaign.launched_at.isoformat() if campaign.launched_at else None,
        "analytics": {
            "audience_size": total,
            "sent": sent,
            "delivered": delivered,
            "failed": failed,
            "opened": opened,
            "read": read,
            "clicked": clicked,
            "delivery_rate": delivery_rate,
            "open_rate": open_rate,
            "click_rate": click_rate,
        },
        "recipients": recipients_list,
    }


@router.post("/{campaign_id}/send")
async def send_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Launch a campaign:
    1. Mark campaign as launched
    2. Resolve segment customers
    3. Create campaign_recipient rows
    4. POST to channel service
    """
    # Fetch campaign
    result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.segment))
        .where(Campaign.id == campaign_id)
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    if campaign.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Campaign is already '{campaign.status}'. Only draft campaigns can be sent.",
        )

    # Mark as launched
    campaign.status = "launched"
    campaign.launched_at = datetime.utcnow()

    # Resolve segment audience
    customers = await get_segment_customers(db, campaign.segment.rule_json)
    campaign.audience_size = len(customers)

    # Create campaign_recipient rows
    messages = []
    for customer in customers:
        personalized_msg = campaign.message_template.replace(
            "{first_name}", customer.first_name
        )

        cr = CampaignRecipient(
            campaign_id=campaign.id,
            customer_id=customer.id,
            personalization_json={"first_name": customer.first_name},
            current_status="pending",
        )
        db.add(cr)
        await db.flush()  # get cr.id

        # Determine destination based on channel
        if campaign.channel == "email":
            destination = customer.email
        else:
            destination = customer.phone

        messages.append({
            "recipient_id": str(customer.id),
            "destination": destination,
            "message": personalized_msg,
            "metadata": {"campaign_recipient_id": str(cr.id)},
        })

    # Explicitly commit database transaction before making the external HTTP network request
    # to avoid holding database connections open during long-running network operations.
    await db.commit()

    # POST to channel service — wrapped in try/except so campaign still launches even if service is down
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{settings.CHANNEL_SERVICE_URL}/send",
                json={
                    "campaign_id": str(campaign.id),
                    "channel": campaign.channel,
                    "messages": messages,
                },
            )
    except Exception as e:
        logger.error(f"Channel service call failed for campaign {campaign.id}: {e}")
        # Don't crash — campaign is still marked as launched

    return {
        "campaign_id": str(campaign.id),
        "recipients_count": len(customers),
        "status": "launched",
    }


@router.post("/{campaign_id}/complete")
async def complete_campaign(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Mark a campaign status as completed once processing is done."""
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")
    
    if campaign.status == "launched":
        campaign.status = "completed"
        await db.commit()
        logger.info(f"Campaign {campaign_id} status updated to completed.")
    
    return {"status": "ok", "campaign_id": str(campaign_id), "new_status": campaign.status}

