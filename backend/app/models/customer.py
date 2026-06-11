import uuid
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import String, Integer, Numeric, Date, DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    signup_date: Mapped[date] = mapped_column(Date, nullable=False)
    preferred_channel: Mapped[str] = mapped_column(
        Enum("email", "whatsapp", "sms", name="channel_type"),
        nullable=False
    )
    total_spend: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    last_order_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    order_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="customer", cascade="all, delete-orphan")
    campaign_recipients: Mapped[List["CampaignRecipient"]] = relationship("CampaignRecipient", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Customer {self.first_name} {self.last_name} ({self.email})>"
