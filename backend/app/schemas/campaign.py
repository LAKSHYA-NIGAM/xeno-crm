from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid

class CampaignBase(BaseModel):
    name: str = Field(..., max_length=150)
    objective: str = Field(..., max_length=500)
    segment_id: uuid.UUID
    channel: str  # email, whatsapp, sms
    message_template: str

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    objective: Optional[str] = Field(None, max_length=500)
    segment_id: Optional[uuid.UUID] = None
    channel: Optional[str] = None
    message_template: Optional[str] = None
    status: Optional[str] = None
    audience_size: Optional[int] = None
    launched_at: Optional[datetime] = None

class CampaignResponse(CampaignBase):
    id: uuid.UUID
    status: str  # draft, launched, completed
    audience_size: Optional[int] = None
    created_at: datetime
    launched_at: Optional[datetime] = None

    class Config:
        from_attributes = True
