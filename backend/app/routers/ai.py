from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db
from app.ai.segment_suggest import stream_segment_suggest
from app.ai.message_draft import stream_message_draft
from app.services.segmentation import get_segment_count
from app.services.ai_service import save_suggestion, get_sample_customers

router = APIRouter(prefix="/ai", tags=["AI"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}

class SegmentSuggestRequest(BaseModel):
    goal: str

# Support both naming conventions
SegmentSuggestBody = SegmentSuggestRequest


class MessageDraftRequest(BaseModel):
    audience_name: str
    channel: str
    objective: str
    brand_tone: str = "warm and premium"
    segment_rules: dict = {}

# Support both naming conventions
MessageDraftBody = MessageDraftRequest


@router.post("/segment-suggest")
async def segment_suggest(
    body: SegmentSuggestRequest,
    db: AsyncSession = Depends(get_db),
):
    generator = await stream_segment_suggest(
        body.goal, db, get_segment_count, save_suggestion
    )
    return StreamingResponse(generator, media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/message-draft")
async def message_draft(
    body: MessageDraftRequest,
    db: AsyncSession = Depends(get_db),
):
    samples = await get_sample_customers(body.segment_rules, db)
    generator = await stream_message_draft(
        body.audience_name, body.channel, body.objective,
        body.brand_tone, samples, db, save_suggestion,
    )
    return StreamingResponse(generator, media_type="text/event-stream", headers=SSE_HEADERS)
