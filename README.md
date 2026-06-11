# Xeno CRM - AI-Native Shopper Engagement Platform

Welcome to **Xeno CRM**, an AI-native shopper engagement mini-CRM tailored for **Elara**, a D2C premium beauty and wellness brand. This monorepo contains a FastAPI backend service and a Next.js 14 frontend application designed to segment customers, create tailored marketing campaigns, and use AI features to generate optimized copy and suggest segment rules.

---

## Repository Structure

```
xeno-crm/
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint, router registrations, CORS, lifespan
│   │   ├── database.py         # SQLAlchemy 2.0 Async engine, session, and dependency
│   │   ├── config.py           # Pydantic Settings env loader
│   │   ├── models/             # SQLAlchemy 2.0 mapped_column models
│   │   ├── schemas/            # Pydantic schemas mirroring models
│   │   ├── routers/            # FastAPI router endpoints (customers, segments, campaigns, receipts, ai)
│   │   ├── services/           # Segmentation, campaign sending, and analytics services
│   │   └── ai/                 # LLM handlers (segment suggestions, copywriting)
│   ├── seed/
│   │   └── seed.py             # Idempotent Indian-locale (Faker('en_IN')) data generator
│   ├── alembic/                # Async database migration configuration
│   ├── requirements.txt        # Backend dependencies
│   ├── .env.example            # Environment variables template
│   └── Dockerfile              # Container configuration
├── frontend/
│   ├── app/                    # Next.js 14 App Router (layout, dashboard, segments, campaigns)
│   ├── components/             # Reusable UI elements (using Shadcn UI tokens)
│   ├── lib/
│   │   └── api.ts              # Typed fetch client stubs
│   ├── package.json            # React/Next dependencies
│   └── tailwind.config.ts      # Styling configurations
├── docker-compose.yml          # Root-level PostgreSQL service orchestration
└── README.md                   # Setup and operations guide
```

---

## Brand Context: Elara

**Elara** is a premium D2C beauty and wellness brand focusing on high-quality organic skincare, premium coffee blends, and holistic lifestyle wellness. 

To model real-world engagement patterns, our data seed populates:
- **High-Value Lapsed (200)**: Big spenders (₹8,000–₹25,000) who haven't ordered in 50–120 days. High priority for AI-drafted email Win-Back campaigns.
- **Frequent Recent (200)**: Highly active loyalists (₹2,000–₹8,000) purchasing in the last 1–20 days. Best for new product launch notifications via WhatsApp.
- **New One-Time (200)**: Fresh trial signups (₹300–₹1,200) who ordered in the last 5–40 days. Target for SMS-based feedback surveys.
- **Mid-Value Dormant (200)**: Occasional shoppers (₹2,000–₹6,000) inactive for 90–200 days. Great for personalized discount coupon codes.

---

## Backend Setup

### Prerequisites
- Python 3.12 (or 3.11)
- Pip (Python Package Manager)

### Installation
1. Go to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # On Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\Activate.ps1

   # On Linux/macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create your local configuration by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

### Database & Seeding
1. Launch the local PostgreSQL container using Docker:
   ```bash
   docker-compose up -d
   ```
2. Run migrations (or let FastAPI auto-create tables on first launch).
3. Populate the database with the idempotent seed script:
   ```bash
   python seed/seed.py
   ```

### Running the API
Start the FastAPI server:
```bash
uvicorn app.main:app --reload
```
The interactive Swagger API documentation will be available at `http://localhost:8000/docs`.

---

## Frontend Setup

### Prerequisites
- Node.js (v18+)
- Npm or Yarn

### Installation
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env.local` configuration from `.env.local.example`:
   ```bash
   cp .env.local.example .env.local
   ```

### Running Next.js
Launch the local dev server:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser. The landing page redirects automatically to `/dashboard`.
