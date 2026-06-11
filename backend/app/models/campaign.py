import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    objective: Mapped[str] = mapped_column(String(500), nullable=False)
    segment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("segments.id", ondelete="RESTRICT"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(
        Enum("email", "whatsapp", "sms", name="channel_type", inherit_schema=True),
        nullable=False
    )
    message_template: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("draft", "launched", "completed", name="campaign_status"),
        default="draft",
        nullable=False
    )
    audience_size: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    launched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    segment: Mapped["Segment"] = relationship("Segment", back_populates="campaigns")
    recipients: Mapped[List["CampaignRecipient"]] = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Campaign {self.name} - Status: {self.status}>"
