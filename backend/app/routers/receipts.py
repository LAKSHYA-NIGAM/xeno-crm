"""
Receipts router — webhook ingestion for delivery status updates.

Handles idempotency via dedupe_key, and status-precedence checks to
avoid downgrading a recipient's status.
"""
import uuid
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign_recipient import CampaignRecipient
from app.models.communication_event import CommunicationEvent

router = APIRouter(prefix="/receipts", tags=["receipts"])


class ReceiptPayload(BaseModel):
    campaign_recipient_id: str
    provider_message_id: str = Field(..., max_length=255)
    event_type: str = Field(..., max_length=50)
    event_timestamp: datetime
    metadata: dict = {}
    dedupe_key: str = Field(..., max_length=255)


@router.post("")
async def receive_receipt(
    payload: ReceiptPayload,
    db: AsyncSession = Depends(get_db)
):
    print(f"[RECEIPT] Received: {payload.event_type} for recipient {payload.campaign_recipient_id}")

    # Idempotency check
    try:
        existing = await db.execute(
            select(CommunicationEvent).where(
                CommunicationEvent.dedupe_key == payload.dedupe_key
            )
        )
        if existing.scalar_one_or_none():
            print(f"[RECEIPT] Duplicate event ignored: {payload.dedupe_key}")
            return {"status": "duplicate"}
    except Exception as e:
        print(f"[RECEIPT] Dedupe check error: {e}")

    # Find recipient - try UUID first then string
    recipient = None
    try:
        recipient = await db.get(CampaignRecipient, UUID(payload.campaign_recipient_id))
    except Exception:
        try:
            result = await db.execute(
                select(CampaignRecipient).where(
                    cast(CampaignRecipient.id, String) == payload.campaign_recipient_id
                )
            )
            recipient = result.scalar_one_or_none()
        except Exception as e:
            print(f"[RECEIPT] Error finding recipient: {e}")

    if not recipient:
        print(f"[RECEIPT] Recipient not found: {payload.campaign_recipient_id}")
        return {"status": "recipient_not_found"}

    # Status precedence — never downgrade
    STATUS_ORDER = {
        "pending": 0, "sent": 1, "delivered": 2,
        "opened": 3, "read": 4, "clicked": 5, "failed": -1
    }

    current_order = STATUS_ORDER.get(recipient.current_status, 0)
    new_order = STATUS_ORDER.get(payload.event_type, 0)

    # Save event
    event = CommunicationEvent(
        campaign_recipient_id=recipient.id,
        event_type=payload.event_type,
        event_timestamp=payload.event_timestamp,
        provider_message_id=payload.provider_message_id,
        metadata_json=payload.metadata,
        dedupe_key=payload.dedupe_key,
    )
    db.add(event)

    # Update recipient status and timestamps
    now = datetime.now(timezone.utc)
    if payload.event_type == "sent" and not recipient.sent_at:
        recipient.sent_at = now
    elif payload.event_type == "delivered" and not recipient.delivered_at:
        recipient.delivered_at = now
    elif payload.event_type == "failed":
        recipient.current_status = "failed"
    elif payload.event_type == "opened" and not recipient.opened_at:
        recipient.opened_at = now
    elif payload.event_type == "read" and not recipient.read_at:
        recipient.read_at = now
    elif payload.event_type == "clicked" and not recipient.clicked_at:
        recipient.clicked_at = now

    # Only upgrade status, never downgrade
    if new_order > current_order:
        recipient.current_status = payload.event_type
        print(f"[RECEIPT] Status updated: {payload.campaign_recipient_id} → {payload.event_type}")

    try:
        await db.commit()
        print(f"[RECEIPT] Saved successfully")
    except Exception as e:
        await db.rollback()
        print(f"[RECEIPT] Commit error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "ok"}
