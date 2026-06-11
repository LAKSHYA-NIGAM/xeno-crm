from pydantic import BaseModel
from datetime import datetime
import uuid

class AISuggestionBase(BaseModel):
    type: str  # segment_rules, message_template
    input_prompt: str
    output_json: dict

class AISuggestionCreate(AISuggestionBase):
    pass

class AISuggestionResponse(AISuggestionBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
