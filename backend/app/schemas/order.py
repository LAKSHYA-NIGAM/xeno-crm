from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid

class OrderBase(BaseModel):
    customer_id: uuid.UUID
    order_date: datetime
    amount: float
    status: str = "completed"  # completed, cancelled, refunded
    category: str = Field(..., max_length=100)  # Coffee, Skincare, Apparel, etc.
    channel: str = Field(..., max_length=50)   # online, in-store

class OrderCreate(OrderBase):
    pass

class OrderUpdate(BaseModel):
    customer_id: Optional[uuid.UUID] = None
    order_date: Optional[datetime] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    channel: Optional[str] = Field(None, max_length=50)

class OrderResponse(OrderBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
