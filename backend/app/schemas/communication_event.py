from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid

class CommunicationEventBase(BaseModel):
    campaign_recipient_id: uuid.UUID
    event_type: str = Field(..., max_length=50)  # sent, delivered, opened, clicked, etc.
    event_timestamp: datetime
    provider_message_id: Optional[str] = Field(None, max_length=255)
    metadata_json: dict = {}
    dedupe_key: str = Field(..., max_length=255)

class CommunicationEventCreate(CommunicationEventBase):
    pass

class CommunicationEventResponse(CommunicationEventBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
