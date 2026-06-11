import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    personalization_json: Mapped[dict] = mapped_column(JSON, nullable=False)  # Key-value variables for customization
    current_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)  # pending, sent, delivered, opened, etc.

    # Audit timestamps
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    clicked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    campaign: Mapped["Campaign"] = relationship("Campaign", back_populates="recipients")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="campaign_recipients")
    communication_events: Mapped[List["CommunicationEvent"]] = relationship("CommunicationEvent", back_populates="campaign_recipient", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<CampaignRecipient {self.id} - Customer: {self.customer_id} - Status: {self.current_status}>"
