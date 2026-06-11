import uuid
from datetime import datetime
from typing import List
from sqlalchemy import String, Integer, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    rule_json: Mapped[dict] = mapped_column(JSON, nullable=False)  # JSON logic/rules defining the segment
    estimated_count: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    campaigns: Mapped[List["Campaign"]] = relationship("Campaign", back_populates="segment")

    def __repr__(self) -> str:
        return f"<Segment {self.name} ({self.id})>"
