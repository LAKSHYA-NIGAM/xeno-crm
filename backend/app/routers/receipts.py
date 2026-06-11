"""
Receipts router — webhook ingestion for delivery status updates.

Handles idempotency via dedupe_key, and status-precedence checks to
avoid downgrading a recipient's status.
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign_recipient import CampaignRecipient
from app.models.communication_event import CommunicationEvent

router = APIRouter(prefix="/receipts", tags=["receipts"])

# Status precedence — higher index = higher precedence
STATUS_ORDER = ["pending", "sent", "delivered", "opened", "read", "clicked"]
STATUS_RANK = {s: i for i, s in enumerate(STATUS_ORDER)}

# Which timestamp field to set for each event type
EVENT_TIMESTAMP_FIELD = {
    "sent": "sent_at",
    "delivered": "delivered_at",
    "opened": "opened_at",
    "read": "read_at",
    "clicked": "clicked_at",
}


class ReceiptBody(BaseModel):
    campaign_recipient_id: uuid.UUID
    provider_message_id: str = Field(..., max_length=255)
    event_type: str = Field(..., max_length=50)
    event_timestamp: datetime
    metadata: dict = {}
    dedupe_key: str = Field(..., max_length=255)


@router.post("")
async def receive_receipt(body: ReceiptBody, db: AsyncSession = Depends(get_db)):
    """
    Ingest a delivery status event from the channel service.

    Idempotency: if dedupe_key exists, return 200 with status=duplicate.
    Status precedence: never downgrade (e.g. don't overwrite 'clicked' with 'delivered').
    """
    from datetime import timezone
    # Convert timezone-aware datetime to naive UTC datetime
    if body.event_timestamp.tzinfo is not None:
        body.event_timestamp = body.event_timestamp.astimezone(timezone.utc).replace(tzinfo=None)

    # 1. Idempotency check
    existing = await db.execute(
        select(CommunicationEvent).where(CommunicationEvent.dedupe_key == body.dedupe_key)
    )
    if existing.scalars().first():
        return {"status": "duplicate"}

    # 2. Verify campaign recipient exists
    cr_result = await db.execute(
        select(CampaignRecipient).where(CampaignRecipient.id == body.campaign_recipient_id)
    )
    cr = cr_result.scalars().first()
    if not cr:
        return {"status": "error", "detail": "Campaign recipient not found"}

    # 3. Insert communication event
    event = CommunicationEvent(
        campaign_recipient_id=body.campaign_recipient_id,
        event_type=body.event_type,
        event_timestamp=body.event_timestamp,
        provider_message_id=body.provider_message_id,
        metadata_json=body.metadata,
        dedupe_key=body.dedupe_key,
    )
    db.add(event)

    # 4. Update campaign_recipient status (with precedence check)
    new_rank = STATUS_RANK.get(body.event_type, -1)
    current_rank = STATUS_RANK.get(cr.current_status, -1)

    if body.event_type == "failed":
        # Failed is a terminal state — always set it
        cr.current_status = "failed"
    elif new_rank > current_rank:
        # Only upgrade status, never downgrade
        cr.current_status = body.event_type

        # Set the corresponding timestamp field
        ts_field = EVENT_TIMESTAMP_FIELD.get(body.event_type)
        if ts_field and getattr(cr, ts_field) is None:
            setattr(cr, ts_field, body.event_timestamp)

    return {"status": "ok"}
