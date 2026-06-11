import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class CommunicationEvent(Base):
    __tablename__ = "communication_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campaign_recipient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("campaign_recipients.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)  # sent, delivered, opened, clicked, etc.
    event_timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    provider_message_id: Mapped[str] = mapped_column(String(255), nullable=True)  # Provider reference ID
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # Full webhook payload metadata
    dedupe_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)  # To ensure webhook idempotency
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    campaign_recipient: Mapped["CampaignRecipient"] = relationship("CampaignRecipient", back_populates="communication_events")

    def __repr__(self) -> str:
        return f"<CommunicationEvent {self.event_type} - Recipient {self.campaign_recipient_id}>"
