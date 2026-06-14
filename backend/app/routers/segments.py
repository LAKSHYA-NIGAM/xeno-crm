"""
Segments router — preview, create, list, and detail.
"""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.segment import Segment
from app.services.segmentation import preview_segment

router = APIRouter(prefix="/segments", tags=["segments"])


# ---------- request / response schemas ----------

class RuleJsonBody(BaseModel):
    rule_json: dict[str, Any]


class CreateSegmentBody(BaseModel):
    name: str = Field(..., max_length=150)
    description: str = Field(..., max_length=500)
    rule_json: dict[str, Any]


# ---------- endpoints ----------

@router.post("/preview")
async def preview(body: RuleJsonBody, db: AsyncSession = Depends(get_db)):
    """
    Live preview — returns count + 5 sample customers matching rule_json.
    Called on every rule change in the frontend builder.
    """
    result = await preview_segment(db, body.rule_json)
    return result


@router.post("")
async def create_segment(body: CreateSegmentBody, db: AsyncSession = Depends(get_db)):
    """
    Create a new segment. Runs preview internally to set estimated_count.
    """
    preview_result = await preview_segment(db, body.rule_json)

    segment = Segment(
        name=body.name,
        description=body.description,
        rule_json=body.rule_json,
        estimated_count=preview_result["count"],
    )
    db.add(segment)
    await db.flush()
    await db.refresh(segment)

    return {
        "id": str(segment.id),
        "name": segment.name,
        "description": segment.description,
        "rule_json": segment.rule_json,
        "estimated_count": segment.estimated_count,
        "created_at": segment.created_at.isoformat() if segment.created_at else None,
    }


@router.get("")
async def list_segments(db: AsyncSession = Depends(get_db)):
    """List all segments, newest first."""
    stmt = select(Segment).order_by(Segment.created_at.desc())
    result = await db.execute(stmt)
    segments = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "name": s.name,
            "description": s.description,
            "rule_json": s.rule_json,
            "estimated_count": s.estimated_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in segments
    ]


@router.get("/{segment_id}")
async def get_segment(segment_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Return a single segment with its estimated_count."""
    result = await db.execute(select(Segment).where(Segment.id == segment_id))
    segment = result.scalars().first()

    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found")

    return {
        "id": str(segment.id),
        "name": segment.name,
        "description": segment.description,
        "rule_json": segment.rule_json,
        "estimated_count": segment.estimated_count,
        "created_at": segment.created_at.isoformat() if segment.created_at else None,
    }


@router.delete("/{segment_id}")
async def delete_segment(segment_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a segment by ID."""
    result = await db.execute(select(Segment).where(Segment.id == segment_id))
    segment = result.scalars().first()

    if not segment:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found")

    await db.delete(segment)
    await db.commit()
    return {"deleted": True}
