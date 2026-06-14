import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from app.database import engine
# Import Base and models to ensure they are registered for metadata creation
# pyrefly: ignore [missing-import]
from app.models import Base
# pyrefly: ignore [missing-import]
from app.routers import customers, segments, campaigns, receipts, ai, analytics

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup database tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Dispose connection pool on shutdown
    await engine.dispose()

app = FastAPI(
    title="Xeno CRM Backend",
    description="AI-native shopper engagement mini-CRM backend for Elara",
    version="0.2.0",
    lifespan=lifespan
)

# CORS middleware for production and development
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", ""),  # Will be set to Vercel URL
    "*",  # Keep for now during deploy verification
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Register routers with /api prefix
app.include_router(customers.router, prefix="/api")
app.include_router(segments.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")

@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "Xeno CRM backend running"}

@app.post("/api/admin/clear-db")
async def clear_database():
    from app.database import AsyncSessionLocal
    from sqlalchemy import delete
    from app.models.communication_event import CommunicationEvent
    from app.models.campaign_recipient import CampaignRecipient
    from app.models.campaign import Campaign
    from app.models.segment import Segment
    from app.models.ai_suggestion import AISuggestion
    
    async with AsyncSessionLocal() as session:
        await session.execute(delete(CommunicationEvent))
        await session.execute(delete(CampaignRecipient))
        await session.execute(delete(Campaign))
        await session.execute(delete(Segment))
        try:
            await session.execute(delete(AISuggestion))
        except Exception:
            pass
        await session.commit()
    return {"status": "ok", "message": "Production database cleared"}

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Xeno CRM API",
        "brand_context": "Elara - Premium D2C Beauty & Wellness"
    }
