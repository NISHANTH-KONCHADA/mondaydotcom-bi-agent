# Skylark Drones — Monday.com BI Agent

An AI-powered Business Intelligence agent that answers founder-level queries by integrating with Monday.com boards (Deals Pipeline + Work Orders) using live data, a Groq-powered LLM, and a premium conversational interface.

**Live Demo:** _[Link after deployment]_

---

## Architecture

```
┌─────────────────────┐       ┌──────────────────────────┐       ┌────────────────────┐
│  React + Vite (TS)  │◄─────►│  Node/Express Backend     │◄─────►│  Groq LLM          │
│  Premium chat UI    │       │  - Agent tool-call loop   │       │  openai/gpt-oss    │
│  Leadership summary │       │  - Normalization layer    │       │  -120b             │
│  Data quality badges│       │  - In-memory cache (5min) │       └────────────────────┘
└─────────────────────┘       └────────────┬─────────────┘
                                            │
                              ┌─────────────▼─────────────┐
                              │  Monday.com GraphQL API v2 │
                              │  - Deals Pipeline board    │
                              │  - Work Orders board       │
                              └───────────────────────────┘
```

**Deployment:**
- Frontend → Firebase Hosting
- Backend → Google Cloud Run (source deploy via Cloud Build — no Docker required locally)

---

## Tech Stack Decisions

| Choice | Rationale |
|--------|-----------|
| **Groq `openai/gpt-oss-120b`** | Available model on the account with tool-calling support |
| **Monday.com GraphQL API** (not MCP) | More predictable, full control over caching and normalization |
| **No vector DB / RAG** | ~500 rows of structured data → in-memory filter+aggregate is correct |
| **In-memory TTL cache (5 min)** | Reduces API calls; data freshness acceptable for BI queries |
| **5 composable tools** | Generic aggregate tool handles unanticipated questions |

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Monday.com account with two boards imported (Deals Pipeline, Work Orders)
- Groq API key (free at console.groq.com)
- GCP project with Cloud Run + Firebase enabled

### 1. Monday.com Board Setup

Import the two CSV files into Monday.com:
1. **Deals Pipeline** — from `Deal funnel Data.xlsx - Deal tracker.csv`
2. **Work Orders** — from `Work_Order_Tracker Data.xlsx - work order tracker.csv`

After import, fix column types:
- Deals: `Masked Deal value` → Numbers; date columns → Date; `Deal Status` → Status
- Work Orders: financial columns → Numbers; date columns → Date; status columns → Status

Get your board IDs from the URL: `https://yourteam.monday.com/boards/BOARD_ID_HERE`

### 2. Local Development

```bash
# Backend
cd backend
cp .env.example .env   # Fill in your values
npm install
npm run dev            # Starts on port 3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev            # Starts on port 5173 (proxies /api to 3001)
```

### 3. Environment Variables (Backend)

```env
MONDAY_API_KEY=eyJhbGci...         # Monday.com personal API token
MONDAY_DEALS_BOARD_ID=1234567890   # Deals Pipeline board ID
MONDAY_WORK_ORDERS_BOARD_ID=987654321  # Work Orders board ID
GROQ_API_KEY=gsk_...               # Groq API key
PORT=3001                          # (optional, defaults to 3001)
FRONTEND_URL=https://your-app.web.app  # (optional, for CORS)
```

### 4. Deploy to GCP

```bash
# Deploy backend to Cloud Run
cd backend
gcloud run deploy skylark-bi-backend \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "MONDAY_API_KEY=...,MONDAY_DEALS_BOARD_ID=...,MONDAY_WORK_ORDERS_BOARD_ID=...,GROQ_API_KEY=..."

# Get the Cloud Run URL, then build + deploy frontend
cd ../frontend
echo "VITE_API_URL=https://skylark-bi-backend-xxxx-uc.a.run.app" > .env.production
npm run build
firebase deploy --only hosting
```

---

## Agent Tools

| Tool | Purpose |
|------|---------|
| `get_schema` | Column catalog + enum values + known caveats for both boards |
| `get_deals` | Fetch + filter normalized deals; returns data quality report |
| `get_work_orders` | Fetch + filter normalized work orders; returns anomaly flags |
| `aggregate` | Generic groupby/sum/count/avg on any returned rows |
| `join_boards` | Cross-board join by deal name; surfaces unmatched deals/WOs |

---

## Data Quality Handling

The agent explicitly communicates data quality issues, never silently skipping them:

- **Deal value** null in ~52% of rows → every financial aggregate states coverage
- **Billing Status** typos (`BIlled` → `Billed`) → normalized, mentioned in responses  
- **Negative "Amount to be billed"** → flagged as over-billing anomaly, not a data error
- **Stray header row** in Deals (Deal Stage = "Deal Stage") → filtered on ingest
- **`Project Completed` stage** has no letter prefix → mapped to `P. Project Completed`
- **WO Status ≠ Execution Status** → two different lifecycles, never conflated

---

## Decision Log

### Data Normalization Decisions

| Decision | Reasoning |
|----------|-----------|
| Treat duplicate Client Code + Deal Name rows as separate tranches | Different tentative close dates suggest pipeline stage updates over time, not true duplicates |
| "Tender" kept as sector (not re-classified) | Insufficient context to reclassify; documented as caveat |
| `Project Completed` → `P. Project Completed` | Maintains alphabetical sort order; makes it consistent with the lettered scheme |
| Negative billing amounts kept (not zeroed) | Real business signal: over-billed vs PO. Surfaced as anomaly |
| Billing Status normalized from 4+ raw variants | `BIlled`, `Billed`, `Fully Billed` — case-fold + map to canonical set |

### Cross-Board Join Strategy
Join on `dealName` (normalized, case-insensitive). Owner code (`OWNER_00X`) is the same value space across both boards. **Known limitation:** Deal Name is not unique — "Sakura" appears for 30+ different clients. Matches for these are flagged as ambiguous. Company codes cannot be joined — WO uses `WOCOMPANY_XXX` prefix while Deals uses `COMPANY_XXX`.

### API vs MCP
Used Monday.com GraphQL API directly rather than MCP for the data fetching layer. Reason: more predictable behavior for a 5-hour build, full control over caching and normalization, simpler error handling. An MCP wrapper would add value in a production setup (standardized tool interface for multi-agent scenarios).

### Leadership Updates Interpretation
Implemented as a `/summary` command that generates a structured markdown weekly briefing covering: pipeline snapshot, sector performance, won deals, at-risk deals, work order health, billing/collections status, data quality flags, and rep performance. Rationale: a clean markdown summary that can be pasted into Slack/docs is more immediately useful than PDF generation in a prototype timeframe.

### What I'd Do With More Time
1. **Monday.com webhooks** instead of TTL cache for real-time data freshness
2. **Fuzzy matching** for billing status normalization (not just case-fold)
3. **PDF/Google Docs export** for leadership summaries
4. **Better join logic** — build a canonical deal ID mapping manually or via a lookup table
5. **Streaming responses** via SSE for better UX on long queries
6. **Rate limiting** on the backend for the Groq API

---

## Sample Queries

- _"How's our pipeline looking for Mining sector this quarter?"_
- _"Which won deals don't have a work order yet?"_
- _"Show me billing status breakdown across all work orders"_
- _"Which open deals have overdue tentative close dates?"_
- _"Are there any anomalies in our billing amounts?"_
- _"/summary"_ → Weekly leadership briefing
