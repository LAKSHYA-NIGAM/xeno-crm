from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

class CampaignRecipientBase(BaseModel):
    campaign_id: uuid.UUID
    customer_id: uuid.UUID
    personalization_json: dict
    current_status: str = "pending"

class CampaignRecipientCreate(CampaignRecipientBase):
    pass

class CampaignRecipientUpdate(BaseModel):
    current_status: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None

class CampaignRecipientResponse(CampaignRecipientBase):
    id: uuid.UUID
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
