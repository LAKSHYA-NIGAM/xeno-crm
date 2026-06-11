from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse
from app.schemas.segment import SegmentCreate, SegmentUpdate, SegmentResponse
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignResponse
from app.schemas.campaign_recipient import CampaignRecipientCreate, CampaignRecipientUpdate, CampaignRecipientResponse
from app.schemas.communication_event import CommunicationEventCreate, CommunicationEventResponse
from app.schemas.ai_suggestion import AISuggestionCreate, AISuggestionResponse

__all__ = [
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "OrderCreate",
    "OrderUpdate",
    "OrderResponse",
    "SegmentCreate",
    "SegmentUpdate",
    "SegmentResponse",
    "CampaignCreate",
    "CampaignUpdate",
    "CampaignResponse",
    "CampaignRecipientCreate",
    "CampaignRecipientUpdate",
    "CampaignRecipientResponse",
    "CommunicationEventCreate",
    "CommunicationEventResponse",
    "AISuggestionCreate",
    "AISuggestionResponse",
]
