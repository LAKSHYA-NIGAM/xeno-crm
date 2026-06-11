"""
Analytics router — overview stats, campaign funnel, and timeline.
"""
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, case, extract, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.customer import Customer
from app.models.order import Order
from app.models.campaign import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.communication_event import CommunicationEvent

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Status precedence ranks (higher = further in funnel)
STATUS_RANK = {"pending": 0, "sent": 1, "delivered": 2, "opened": 3, "read": 4, "clicked": 5}


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    """
    Dashboard overview with aggregate metrics.
    """
    # Total customers
    total_cust_q = await db.execute(select(func.count(Customer.id)))
    total_customers = total_cust_q.scalar_one()

    # Total revenue
    rev_q = await db.execute(select(func.coalesce(func.sum(Order.amount), 0)))
    total_revenue = float(rev_q.scalar_one())

    # Total orders
    orders_q = await db.execute(select(func.count(Order.id)))
    total_orders = orders_q.scalar_one()

    # Active campaigns (status = launched)
    active_q = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.status == "launched")
    )
    active_campaigns = active_q.scalar_one()

    # Campaigns created this month
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_q = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.created_at >= month_start)
    )
    campaigns_this_month = monthly_q.scalar_one()

    # Top cities
    cities_q = await db.execute(
        select(Customer.city, func.count(Customer.id).label("count"))
        .group_by(Customer.city)
        .order_by(func.count(Customer.id).desc())
        .limit(7)
    )
    top_cities = [{"city": row[0], "count": row[1]} for row in cities_q.all()]

    # Channel distribution
    channel_q = await db.execute(
        select(Customer.preferred_channel, func.count(Customer.id).label("count"))
        .group_by(Customer.preferred_channel)
        .order_by(func.count(Customer.id).desc())
    )
    channel_distribution = [{"channel": row[0], "count": row[1]} for row in channel_q.all()]

    # Recent campaigns (last 3) with delivery stats
    recent_q = await db.execute(
        select(Campaign).order_by(Campaign.created_at.desc()).limit(3)
    )
    recent_campaigns_raw = recent_q.scalars().all()
    recent_campaigns = []
    for c in recent_campaigns_raw:
        # Get inline stats
        stats_q = await db.execute(
            select(
                CampaignRecipient.current_status,
                func.count(CampaignRecipient.id),
            )
            .where(CampaignRecipient.campaign_id == c.id)
            .group_by(CampaignRecipient.current_status)
        )
        stats = {"sent": 0, "delivered": 0, "failed": 0, "opened": 0, "read": 0, "clicked": 0}
        for status, count in stats_q.all():
            if status in stats:
                stats[status] = count

        recent_campaigns.append({
            "id": str(c.id),
            "name": c.name,
            "status": c.status,
            "channel": c.channel,
            "audience_size": c.audience_size,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "launched_at": c.launched_at.isoformat() if c.launched_at else None,
            **stats,
        })

    return {
        "total_customers": total_customers,
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "active_campaigns": active_campaigns,
        "campaigns_this_month": campaigns_this_month,
        "top_cities": top_cities,
        "channel_distribution": channel_distribution,
        "recent_campaigns": recent_campaigns,
    }


@router.get("/campaigns/{campaign_id}/funnel")
async def campaign_funnel(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Return funnel data for a campaign.

    A recipient with status 'clicked' counts in all stages above it too
    (Audience → Sent → Delivered → Opened → Read → Clicked).
    """
    # Verify campaign exists
    camp_q = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_q.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    # Get status counts
    stats_q = await db.execute(
        select(
            CampaignRecipient.current_status,
            func.count(CampaignRecipient.id),
        )
        .where(CampaignRecipient.campaign_id == campaign_id)
        .group_by(CampaignRecipient.current_status)
    )
    status_counts = {row[0]: row[1] for row in stats_q.all()}

    # Build cumulative funnel
    # Each stage includes all recipients at that stage or higher
    stages = ["sent", "delivered", "opened", "read", "clicked"]
    cumulative = {}
    for stage in stages:
        stage_rank = STATUS_RANK[stage]
        cumulative[stage] = sum(
            count for status, count in status_counts.items()
            if STATUS_RANK.get(status, -1) >= stage_rank
        )

    audience = campaign.audience_size or sum(status_counts.values())

    funnel = [
        {"stage": "Audience", "count": audience},
        {"stage": "Sent", "count": cumulative.get("sent", 0)},
        {"stage": "Delivered", "count": cumulative.get("delivered", 0)},
        {"stage": "Opened", "count": cumulative.get("opened", 0)},
        {"stage": "Read", "count": cumulative.get("read", 0)},
        {"stage": "Clicked", "count": cumulative.get("clicked", 0)},
    ]

    return {"funnel": funnel}


@router.get("/campaigns/{campaign_id}/timeline")
async def campaign_timeline(campaign_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Return communication events grouped by hour for timeline visualization.
    """
    # Verify campaign exists
    camp_q = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = camp_q.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")

    # Get all communication events for this campaign's recipients
    # Join through campaign_recipients
    stmt = (
        select(
            func.date_trunc('hour', CommunicationEvent.event_timestamp).label("hour"),
            CommunicationEvent.event_type,
            func.count(CommunicationEvent.id).label("count"),
        )
        .join(
            CampaignRecipient,
            CommunicationEvent.campaign_recipient_id == CampaignRecipient.id,
        )
        .where(CampaignRecipient.campaign_id == campaign_id)
        .group_by("hour", CommunicationEvent.event_type)
        .order_by("hour")
    )

    result = await db.execute(stmt)
    rows = result.all()

    timeline = [
        {
            "hour": row[0].isoformat() if row[0] else None,
            "event_type": row[1],
            "count": row[2],
        }
        for row in rows
    ]

    return {"timeline": timeline}
