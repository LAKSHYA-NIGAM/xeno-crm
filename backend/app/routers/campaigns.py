"""
Campaigns router — create, list, detail, and send.
"""
import logging
import uuid
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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
async def send_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Get campaign
    campaign = await db.get(Campaign, UUID(campaign_id))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get segment and run rules
    segment = await db.get(Segment, campaign.segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Get matching customers using segment rules
    from app.services.segmentation import build_segment_query
    query = build_segment_query(segment.rule_json)
    result = await db.execute(query)
    customers = result.scalars().all()

    print(f"[SEND] Campaign {campaign_id} — found {len(customers)} customers")

    if len(customers) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No customers match this segment. Rules: {segment.rule_json}"
        )

    # Update campaign status
    campaign.status = "launched"
    campaign.launched_at = datetime.now(timezone.utc)
    campaign.audience_size = len(customers)

    # Create recipient records
    recipients = []
    for customer in customers:
        message = campaign.message_template.replace(
            "{first_name}", customer.first_name
        )
        recipient = CampaignRecipient(
            campaign_id=campaign.id,
            customer_id=customer.id,
            personalization_json={"first_name": customer.first_name},
            current_status="pending",
        )
        db.add(recipient)
        recipients.append((customer, recipient, message))

    await db.commit()

    # Refresh recipients to get their IDs
    for _, recipient, _ in recipients:
        await db.refresh(recipient)

    print(f"[SEND] Created {len(recipients)} recipient records")

    # Build payload for channel service
    messages = []
    for customer, recipient, message in recipients:
        destination = customer.phone if campaign.channel in ["whatsapp", "sms"] else customer.email
        messages.append({
            "recipient_id": str(customer.id),
            "destination": destination or customer.email,
            "message": message,
            "metadata": {
                "campaign_recipient_id": str(recipient.id)
            }
        })

    payload = {
        "campaign_id": str(campaign.id),
        "channel": campaign.channel,
        "messages": messages
    }

    print(f"[SEND] Sending {len(messages)} messages to channel service")
    print(f"[SEND] Channel service URL: {settings.CHANNEL_SERVICE_URL}")

    # Call channel service
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.CHANNEL_SERVICE_URL}/send",
                json=payload
            )
            print(f"[SEND] Channel service response: {response.status_code}")
            print(f"[SEND] Channel service body: {response.text}")
            response.raise_for_status()
    except httpx.TimeoutException:
        print(f"[SEND ERROR] Channel service timed out")
        # Don't fail — campaign is launched, callbacks may still come
    except Exception as e:
        print(f"[SEND ERROR] {type(e).__name__}: {e}")
        # Don't fail — log and continue

    return {
        "campaign_id": str(campaign.id),
        "status": "launched",
        "recipients_count": len(customers)
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

