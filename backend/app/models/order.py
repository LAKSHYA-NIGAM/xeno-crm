import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    order_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("completed", "cancelled", "refunded", name="order_status"),
        default="completed",
        nullable=False
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # Coffee, Skincare, Apparel, etc.
    channel: Mapped[str] = mapped_column(String(50), nullable=False)   # online, in-store
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="orders")

    def __repr__(self) -> str:
        return f"<Order {self.id} - Customer {self.customer_id} ({self.amount})>"
