# Xeno CRM — AI-Native Shopper Engagement Platform

> Built for Xeno Engineering Internship Assignment 2026

## Live Demo
- **App:** https://frontend-chi-snowy-71.vercel.app
- **Demo login:** demo@xenocrm.com / elara2026
- **API Docs:** https://xeno-crm-ry0s.onrender.com/docs

## Product Overview
An AI-native mini CRM for D2C brands to identify high-value shopper
segments, generate personalized campaign copy, launch campaigns through
a simulated channel service, and track real-time delivery performance.

Demo brand: **Elara** — a premium beauty and wellness brand.

## Architecture
Two-service architecture per assignment requirements:
```
[Next.js Frontend]
        ↓ REST + SSE
[FastAPI CRM Backend] ──POST /send──→ [Channel Service]
        ↑ POST /receipts ←── async callbacks ──┘
        ↓
[PostgreSQL on Neon]
        ↓
[Gemini 2.0 Flash API]
```

## AI Features
- **Segment suggest:** Natural language → audience rules (streaming)
- **Message draft:** Personalized campaign copy per channel (streaming)
- **Channel recommendation:** Based on segment preferences

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui, Recharts |
| Backend | FastAPI, SQLAlchemy 2.0, asyncpg |
| Database | PostgreSQL (Neon serverless) |
| AI | Google Gemini 2.0 Flash |
| Channel Service | FastAPI, asyncio background tasks |
| Deployment | Vercel + Render |

## Key Design Decisions & Tradeoffs
- Used PostgreSQL over event streaming (Kafka) — right scale for MVP,
  would add Kafka at 100k+ events/day
- SSE streaming over WebSockets — simpler, sufficient for unidirectional AI output
- Probabilistic simulation over real provider — assignment spec requires stubbed service
- localStorage demo auth over JWT — scope decision, production would use
  httpOnly cookies with refresh token rotation
- Gemini 2.0 Flash over GPT-4 — faster streaming, generous free tier,
  sufficient quality for CRM copy generation

## Local Setup
```bash
# 1. Clone repos
git clone https://github.com/YOUR_USERNAME/xeno-crm
git clone https://github.com/YOUR_USERNAME/xeno-channel-service

# 2. Backend setup
cd xeno-crm/backend
pip install -r requirements.txt
cp .env.example .env  # Fill in your values
python seed/seed.py
uvicorn app.main:app --reload --port 8000

# 3. Channel service setup
cd ../../xeno-channel-service
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001

# 4. Frontend setup
cd ../xeno-crm/frontend
npm install
cp .env.local.example .env.local  # Fill in API URL
npm run dev
```

### Seed Data
800 customers across 4 behavioral profiles, 3000 orders,
7 Indian cities, brand: Elara beauty & wellness.

### Walkthrough Video
[Link to video]

### Scale-up Plan
At production scale this system would add:
- Kafka for high-volume event ingestion
- Redis + Celery for distributed task queue
- Idempotency middleware with stronger retry policies
- Role-based access control and audit logs
- Warehouse sync for attribution modeling
