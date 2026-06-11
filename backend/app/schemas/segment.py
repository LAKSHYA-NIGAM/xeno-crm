from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid

class SegmentBase(BaseModel):
    name: str = Field(..., max_length=150)
    description: str = Field(..., max_length=500)
    rule_json: dict  # JSON rule logic defining target constraints

class SegmentCreate(SegmentBase):
    pass

class SegmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    rule_json: Optional[dict] = None
    estimated_count: Optional[int] = None

class SegmentResponse(SegmentBase):
    id: uuid.UUID
    estimated_count: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
