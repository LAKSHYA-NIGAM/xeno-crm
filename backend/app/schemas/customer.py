from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
import uuid

class CustomerBase(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=20)
    city: str = Field(..., max_length=100)
    signup_date: date
    preferred_channel: str  # email, whatsapp, sms

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    city: Optional[str] = Field(None, max_length=100)
    signup_date: Optional[date] = None
    preferred_channel: Optional[str] = None
    total_spend: Optional[float] = None
    last_order_at: Optional[datetime] = None
    order_count: Optional[int] = None

class CustomerResponse(CustomerBase):
    id: uuid.UUID
    total_spend: float
    last_order_at: Optional[datetime] = None
    order_count: int
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            uuid.UUID: str
        }
