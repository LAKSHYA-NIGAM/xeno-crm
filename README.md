# 🚀 Xeno CRM — AI-Native Shopper Engagement Platform

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployment-success?style=flat&logo=vercel&logoColor=white)](https://frontend-chi-snowy-71.vercel.app)
[![Render Backend](https://img.shields.io/badge/Render-Backend-blue?style=flat&logo=render&logoColor=white)](https://xeno-crm-ry0s.onrender.com)
[![Python Version](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org/)

An AI-native shopper engagement mini-CRM built for modern D2C brands. Xeno CRM enables marketers to define segments using natural language, auto-generate personalized marketing copies tailored to channels (Email, SMS, WhatsApp), execute high-throughput campaign broadcasts, and track real-time delivery performance using an asynchronous simulation engine.

---

## 🔗 Live Production Endpoints

| Resource | URL | Credentials / Notes |
| :--- | :--- | :--- |
| **Frontend Web App** | [frontend-chi-snowy-71.vercel.app](https://frontend-chi-snowy-71.vercel.app) | **Demo Login:** `demo@xenocrm.com` / `elara2026` |
| **API Documentation** | [xeno-crm-ry0s.onrender.com/docs](https://xeno-crm-ry0s.onrender.com/docs) | OpenAPI interactive Swagger UI |
| **CRM Backend API** | [xeno-crm-ry0s.onrender.com/api](https://xeno-crm-ry0s.onrender.com/api) | Production FastAPI Service |
| **Channel Simulation Service** | [xeno-channel-service-ra2k.onrender.com](https://xeno-channel-service-ra2k.onrender.com) | Handles callback simulation |

---

## ✨ Features Overview

* **🧠 Natural Language Segmentation**: Convert plain English prompts (e.g., *"Active customers in Mumbai with total spend above 5000"*) directly into structured SQL filters and preview matches in real time.
* **✍️ Personalized Copy Generation**: Leverages Google Gemini 2.0 Flash to instantly draft and stream customized message templates per customer profile.
* **📨 High-Throughput Campaign Broadcast**: Efficient batch dispatching designed to handle segment rules, client-side UUID attribution, and channel formatting.
* **📈 Real-Time Conversion & Delivery Funnel**: Live telemetry metrics displaying interactive progression charts (Audience → Sent → Delivered → Opened → Read → Clicked).
* **❄️ Cold-Start Resilience**: Built-in Render container wake-up timers, background keep-alives, and exponential backoff request wrappers to navigate free-tier hosting limits seamlessly.

---

## 🏗️ System Architecture

Xeno CRM operates on a robust, decoupled microservice pattern ensuring optimal database execution and immediate request-response cycles.

```
                  ┌───────────────────────────────┐
                  │       Next.js Frontend        │
                  │   (Vercel SPA Client UI)      │
                  └──────────────┬────────────────┘
                                 │ HTTP REST / SSE
                                 ▼
                  ┌───────────────────────────────┐
                  │       FastAPI CRM API         │
                  │   (Render Web Core Backend)   │
                  └──────────────┬────────────────┘
                  ┌──────────────┴──────────────┐
                  │                             │
                  ▼ (Neon Cloud PG)             ▼ (Broadcast Batch)
         ┌──────────────────┐          ┌──────────────────┐
         │ PostgreSQL DB    │          │ Channel Service  │
         │ (Customer Tables)│          │ (Async Simulator)│
         └──────────────────┘          └────────┬─────────┘
                  ▲                             │
                  └─────── Webhook Callbacks ───┘
                       (Status Events Delivery)
```

### Async Callback Flow
1. **Trigger**: The marketer clicks "Launch" in the frontend composer.
2. **Acceptance**: The CRM backend compiles segment recipients, stores their pending statuses with pre-generated UUID keys in a single transaction, and posts the payload to the Channel Service.
3. **Execution**: The Channel Service responds with a `200 OK` acceptance batch ID immediately.
4. **Simulation**: The Channel Service schedules asynchronous event loops in the background, executing progressive delivery delays (representing network delay, open rates, and click engagement) before posting back to the CRM API `/api/receipts` endpoint.

---

## ⚙️ Core Technical Optimizations

### 1. Batch Execution Database Performance
To prevent database query resource locks and `ReadTimeout` exceptions when dealing with larger segments (700+ shoppers), we optimized the recipient creation pipeline:
* **Client-Side UUID Generation**: Primary keys for `CampaignRecipient` database records are generated within application runtime using `uuid.uuid4()`.
* **Removed Sequential Loops**: Removed expensive `await db.refresh` database roundtrips during recipient creation. All records are created and pushed to the database in a single bulk commit, reducing dispatch times from minutes to under 3 seconds.

### 2. Auto-Wake Retry Mechanism
Render free-tier hosting suspends backend instances after 15 minutes of inactivity. When calling the sleeping channel service during campaign launch, standard HTTP clients fail on `502 Bad Gateway`.
We implemented a resilient wake-up loop in the CRM router:
* **Pre-warm Handshake**: Performs a warm-up handshake health check prior to posting the batch.
* **Resilient Retry Wrapper**: If a `502` or connection exception is encountered, it triggers a retry cycle (up to 5 attempts spanning a 90-second window with exponential backoffs) to allow sleeping instances to fully boot up without rejecting user requests.

---

## 💻 Local Quickstart

### Prerequisites
* Python 3.10+
* Node.js v18+
* Database URL (PostgreSQL)
* Google Gemini API Key

### Installation

#### 1. Clone the Repositories
```bash
git clone https://github.com/LAKSHYA-NIGAM/xeno-crm.git
git clone https://github.com/LAKSHYA-NIGAM/xeno-channel-service.git
```

#### 2. Run the CRM Backend
```bash
cd xeno-crm/backend

# Initialize virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, GEMINI_API_KEY, and CHANNEL_SERVICE_URL

# Populate database seeds
python seed/seed.py

# Start application server
uvicorn app.main:app --reload --port 8000
```

#### 3. Run the Channel Simulation Service
```bash
cd ../../xeno-channel-service

# Initialize environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your CRM_RECEIPT_URL=http://localhost:8000/api/receipts

# Start simulation server
uvicorn app.main:app --reload --port 8001
```

#### 4. Launch Next.js Frontend Client
```bash
cd ../xeno-crm/frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Start development client
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the client dashboard.

---

## 📊 Scale-up Blueprint

To scale the architecture for handling million+ daily campaigns in production, we propose:
1. **Distributed Queue (Celery + Redis)**: Hand off the broadcast generation and webhook ingestion to worker queues so the web servers never block.
2. **Event Streaming (Apache Kafka)**: Ingest provider callback webhooks in real time to Kafka topics to guarantee idempotency and buffer load spikes.
3. **Database Partitioning**: Partition the campaign communication event logs table by month to optimize query execution and indices retention.
4. **Idempotency Guard**: Store callback event hashes in Redis with a 24-hour expiration window to resolve message double-delivery instantly.
