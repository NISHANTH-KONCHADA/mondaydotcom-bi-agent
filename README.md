# Skylark Drones — Autonomous Monday.com Business Intelligence Agent

[![Live Hosted App](https://img.shields.io/badge/Live_App-mondaydotcom--bi--agent.web.app-orange?style=for-the-badge&logo=firebase)](https://mondaydotcom-bi-agent.web.app)
[![Backend Status](https://img.shields.io/badge/Backend-Google_Cloud_Run-4285F4?style=for-the-badge&logo=googlecloud)](https://monday-bi-backend-889048520285.asia-south1.run.app/health)
[![Groq LLM](https://img.shields.io/badge/LLM-openai%2Fgpt--oss--120b-black?style=for-the-badge&logo=openai)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

An autonomous Business Intelligence agent designed for Skylark Drones leadership. The agent interfaces directly with live **Monday.com GraphQL API v2** boards (**Deals Pipeline** and **Work Orders Tracker**), performing deterministic data normalization, cross-board reconciliation, anomaly auditing, and executive synthesis.

**Live Application URL:** [https://mondaydotcom-bi-agent.web.app](https://mondaydotcom-bi-agent.web.app)  
**GitHub Repository:** [https://github.com/NISHANTH-KONCHADA/mondaydotcom-bi-agent](https://github.com/NISHANTH-KONCHADA/mondaydotcom-bi-agent)  
**Decision & Architecture Log:** [`DECISION_LOG.md`](./DECISION_LOG.md)

---

## Table of Contents

1. [Executive Summary & Capabilities](#1-executive-summary--capabilities)
2. [System Architecture](#2-system-architecture)
3. [Monday.com Datasets & Normalization Engine](#3-mondaycom-datasets--normalization-engine)
   - [Deals Pipeline Board (`5030968060`)](#deals-pipeline-board-id-5030968060)
   - [Work Orders Board (`5030968082`)](#work-orders-board-id-5030968082)
   - [Cross-Board Join & Entity Resolution](#cross-board-join--entity-resolution)
4. [Composable Agent Tools](#4-composable-agent-tools)
   - [Server-Side Pre-Aggregation & Token Budgeting](#server-side-pre-aggregation--token-budgeting)
   - [Tool Specifications & Schemas](#tool-specifications--schemas)
5. [Prompt Engineering & Business Directives](#5-prompt-engineering--business-directives)
6. [Frontend UI & Design System](#6-frontend-ui--design-system)
7. [Local Installation & Development](#7-local-installation--development)
8. [Production Deployment Guide](#8-production-deployment-guide)
9. [Sample Queries & Evaluation Benchmarks](#9-sample-queries--evaluation-benchmarks)
10. [Repository Structure](#10-repository-structure)

---

## 1. Executive Summary & Capabilities

Skylark Drones operates an enterprise drone analytics and field services business across multiple industrial sectors (Mining, Power/Renewables, Infrastructure, Agriculture, Security). Managing sales pipelines alongside complex delivery work orders requires real-time reconciliation across disparate Monday.com boards.

This agent delivers:
- **Autonomous Multi-Step Reasoning:** Translates ambiguous leadership inquiries into deterministic tool-calling chains.
- **Cross-Board Reconciliation:** Automatically matches Deals to Work Orders to detect won contracts missing work orders, execution delays, and revenue leakage.
- **Financial Anomaly & Risk Auditing:** Identifies negative billing balances (over-billing vs PO), expired tentative close dates, un-invoiced milestones, and unpopulated deal values.
- **Data Coverage Transparency:** Transparently reports coverage statistics (e.g. *"₹45.48 Cr across 34 of 106 deals (32% coverage)"*) rather than silently distorting aggregates.
- **1-Click Executive Weekly Briefing (`/summary`):** Generates structured markdown executive summaries ready for founder review, board decks, or Slack distribution.

---

## 2. System Architecture

```
                                  USER BROWSER
                         (React 18 + TypeScript + Vite)
                         Hosted on Firebase Hosting
                                      │
                                      │ REST API / POST /api/chat
                                      ▼
                        GOOGLE CLOUD RUN BACKEND SERVICE
                       (Node.js / Express Serverless API)
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
              ▼                                               ▼
      GROQ LLM ORCHESTRATION                         MONDAY.COM GRAPHQL V2
  Model: `openai/gpt-oss-120b`                       Cursor-Based Pagination
  - Native JSON Tool Calling                         - In-memory TTL Cache (5 min)
  - Autonomous Multi-Turn Execution                  - Normalization & Anomaly Layer
  - Zero-Emoji Executive System Prompt               - Deterministic Math Engine
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                        AGGREGATION & SYNTHESIS
                        - `get_deals`
                        - `get_work_orders`
                        - `aggregate`
                        - `join_boards`
                        - `get_schema`
```

### Architectural Highlights:
1. **Direct GraphQL API v2 vs MCP Wrapper:** Implemented direct GraphQL v2 with cursor pagination (`items_page(limit: 500)`) to achieve millisecond response times, deterministic in-memory caching, and resilient error recovery under strict time constraints.
2. **In-Memory TTL Caching:** 5-minute TTL cache on board fetches to minimize Monday.com API query cost while ensuring fresh data for BI sessions. Includes a manual bust endpoint `/api/cache/clear`.
3. **Dual Deployment Architecture:** Decoupled serverless architecture (Frontend on Google Firebase Hosting, Backend on Google Cloud Run in `asia-south1`) ensuring zero maintenance, automatic HTTPS, and instant auto-scaling.

---

## 3. Monday.com Datasets & Normalization Engine

### Deals Pipeline Board (ID: `5030968060`)
Contains **346 raw records** (344 valid deal items after header cleaning) tracking customer lead progression.

| Column Field | Normalized Property | Data Type | Populated % | Description & Business Rules |
|---|---|---|---|---|
| `Name` | `dealName` | String | 100% | Name of the project/opportunity (e.g. "Sakura", "Alias_102"). |
| `Masked Client Code` | `clientCode` | String | 100% | Client identifier (`CLIENT_001` - `CLIENT_150`). |
| `Masked Company Code` | `companyCode` | String | 100% | Entity company identifier (`COMPANY_001` - `COMPANY_100`). |
| `Sector` | `sector` | String | 100% | Industry vertical (Mining, Power, Infrastructure, Renewables, etc.). |
| `Masked Deal value` | `dealValue` | Float (₹ Cr) | **~48-52%** | Contract value. Missing in ~52% of rows. The agent **must** state data coverage when computing sums. |
| `Deal Stage` | `dealStage` | Enum | 100% | Stages A through P (`A. Lead Generated` to `P. Project Completed`). |
| `Deal Status` | `dealStatus` | Enum | 100% | Primary state (`Open`, `Won`, `Lost`, `Hold`, `Inactive`). |
| `Tentative Close Date` | `tentativeCloseDate` | ISO Date | ~72% | Target closing date. Primary date used for pipeline forecasting. |
| `Close Date (A)` | `actualCloseDate` | ISO Date | **~8%** | Actual closing date. Unpopulated in 92% of records. |
| `Owner Code` | `ownerCode` | String | 100% | Sales representative identifier (`OWNER_001` - `OWNER_020`). |

#### Deals Normalization Rules (`backend/src/normalization/deals.js`):
1. **Header Row Cleaning:** Raw CSV contains a duplicate header row where `Deal Stage = "Deal Stage"`, filtered out on ingest.
2. **Orphan Stage Prefixing:** The raw stage `"Project Completed"` lacks a letter prefix; normalized to `"P. Project Completed"` to maintain natural alphabetical lifecycle sorting.
3. **Tranche Handling:** Records sharing identical `Client Code` + `Deal Name` with distinct tentative close dates represent progressive contract milestones and are preserved as separate tranches.

---

### Work Orders Board (ID: `5030968082`)
Contains **176 records** representing operational execution, field drone flights, and milestone billings.

| Column Field | Normalized Property | Data Type | Description & Business Rules |
|---|---|---|---|
| `Work Order tracker` | `workOrderName` | String | Identifier for the work order / client contract. |
| `Deal Name` | `dealName` | String | Deal reference key used for cross-board reconciliation. |
| `Company Code` | `companyCode` | String | WO company identifier (prefixed as `WOCOMPANY_XXX`). |
| `WO Status (billed)` | `woStatus` | Enum | Accounting lifecycle state (`Open`, `Closed`). |
| `Execution Status` | `executionStatus` | Enum | Operational flight state (`Completed`, `Ongoing`, `Not Started`). |
| `PO Amount in Rs.` | `poAmount` | Float (₹) | Total client Purchase Order monetary commitment. |
| `Total Billed in Rs.` | `totalBilled` | Float (₹) | Cumulative amount invoiced to the client. |
| `Amount to be billed` | `amountToBeBilled` | Float (₹) | Outstanding balance to bill. **Negative values indicate over-billing vs PO.** |
| `Billing Status` | `billingStatus` | Enum | Normalizes raw typo variants (`BIlled`, `Fully Billed`, `Partially Billed`, `To be billed`). |

#### Work Orders Normalization Rules (`backend/src/normalization/workorders.js`):
1. **Lifecycle Separation:** The system strictly separates `woStatus` (financial/billing state) from `executionStatus` (drone operations). A work order can be operationally *Completed* while remaining financially *Open* with un-invoiced balances.
2. **Over-Billing Anomaly Detection:** Negative values in `amountToBeBilled` are not filtered or zeroed; they are flagged as operational anomalies where billing exceeded original Purchase Orders.
3. **Billing Status Typo Normalization:** Resolves free-text variants (`BIlled`, `Fully Billed`, `Billed- Visit 7`) into canonical states (`Billed`, `Partially Billed`, `To be billed`, `Over-Billed`).

---

### Cross-Board Join & Entity Resolution

Cross-board reasoning connects sales opportunities with actual operational delivery:
- **Join Strategy:** Joined on normalized, case-insensitive `dealName`.
- **Ambiguity Detection:** Masked project names (e.g. *"Sakura"*, *"Alias_160"*) repeat across 30+ distinct clients. The agent identifies multi-match instances and reports them as *ambiguous joins* with explicit caveats.
- **Namespace Mismatch Caveat:** Deals use `COMPANY_XXX` while Work Orders use `WOCOMPANY_XXX`. The system documents that direct company code joining is impossible without an explicit client crosswalk table.

---

## 4. Composable Agent Tools

### Server-Side Pre-Aggregation & Token Budgeting

> [!IMPORTANT]
> Returning raw JSON dumps of 346 deals or 176 work orders to an LLM context consumes ~35,000 tokens per call, immediately crashing Groq's 8,000 Tokens-Per-Minute (TPM) limit and causing severe latency.

To guarantee sub-second execution within token limits, every backend tool computes summary analytics and distributions on the server before returning compact, rich payloads to the LLM:

```
[Raw Board Data: 346 items / 35k tokens]
              │
              ▼
[Server-Side Pre-Aggregation Engine]
  - Computes counts, total values, min/max/averages
  - Aggregates stage, sector, and status breakdowns
  - Identifies anomalies and data quality coverage
  - Extracts representative top sample rows
              │
              ▼
[Compact Structured JSON: ~400 tokens]
              │
              ▼
[Groq LLM: Instant Reasoning & Perfect Output]
```

---

### Tool Specifications & Schemas

#### 1. `get_schema`
Returns column definitions, valid enum values, and known data caveats for both boards.
```typescript
get_schema({
  board?: "deals" | "work_orders" | "all" // Target board schema
})
```

#### 2. `get_deals`
Filters deals by sector, stage, status, or sales rep. Returns computed financial sums, value coverage %, stage distributions, and top deal samples.
```typescript
get_deals({
  sector?: string,       // e.g. "Mining", "Power", "Renewables"
  dealStage?: string,    // e.g. "G. Project Won", "E. Proposal Sent"
  dealStatus?: string,   // e.g. "Won", "Open", "Lost", "Hold"
  ownerCode?: string,    // e.g. "OWNER_001"
  search?: string        // Text search across dealName and clientCode
})
```

#### 3. `get_work_orders`
Fetches normalized work orders with filtering by execution status, billing status, or accounting status. Returns total PO amounts, billed amounts, receivable balances, and anomaly flags.
```typescript
get_work_orders({
  woStatus?: string,        // e.g. "Open", "Closed"
  executionStatus?: string, // e.g. "Completed", "Ongoing", "Not Started"
  billingStatus?: string,   // e.g. "Billed", "Partially Billed", "To be billed"
  anomaliesOnly?: boolean   // Flag to retrieve only over-billed / data anomaly rows
})
```

#### 4. `aggregate`
Performs multi-dimensional grouping and math operations across filtered boards.
```typescript
aggregate({
  board: "deals" | "work_orders", // Target dataset
  groupBy: string,                // Field to group by (e.g. "sector", "ownerCode", "dealStage")
  metricField?: string,           // Numeric field (e.g. "dealValue", "poAmount")
  operation: "sum" | "count" | "avg" | "distribution"
})
```

#### 5. `join_boards`
Executes cross-board reconciliation. Identifies deals with matching work orders, won deals lacking work orders (pipeline leak), and unmatched work orders.
```typescript
join_boards({
  filterWonWithoutWO?: boolean,   // Surface won deals missing work orders
  sector?: string                 // Filter join scope by vertical
})
```

---

## 5. Prompt Engineering & Business Directives

The agent system prompt (`backend/src/agent/systemPrompt.js`) enforces strict founder-grade communication rules:

1. **Zero Emojis:** Strictly professional, aesthetic tone using clean GitHub markdown formatting, bold headers, and structured tables.
2. **Mandatory Data Coverage Disclosure:** Whenever financial metrics are stated, the agent must report how many rows had populated values (e.g. *"Deal value is populated for 165 of 344 deals (48% coverage)"*).
3. **Explicit Lifecycle Separation:** Clear distinction between accounting state (`WO Status`) and operational state (`Execution Status`).
4. **Transparent Anomaly Reporting:** Highlighting negative billing amounts as over-billing and noting non-unique deal names as ambiguous.

---

## 6. Frontend UI & Design System

The frontend is built with React 18, TypeScript, and Vanilla CSS, inspired by the design system of [stash.nishanthkonchada.dev](https://stash.nishanthkonchada.dev/).

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [>_] Skylark BI [Monday.com Live]       [Weekly Briefing] [GitHub] [Theme]│
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Founder-level intelligence for Skylark Drones.                          │
│   Real-time analytics and cross-board reasoning across Deals & WOs.       │
│                                                                           │
│   [All Queries (6)] [Deals Pipeline (2)] [Reconciliation (1)] [Ops (1)]  │
│                                                                           │
│   ┌───────────────────────────┐   ┌───────────────────────────┐           │
│   │ Mining Sector Pipeline    │   │ Won Deals Without WOs     │           │
│   │ Stage breakdown & values  │   │ Revenue leakage detection │           │
│   └───────────────────────────┘   └───────────────────────────┘           │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │ [Search icon] Ask an executive query or type /summary...  [Query] │   │
│   └───────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### UI Features:
- **Category Filter Chips (`.chip`):** Filter starter resource queries by `All`, `Deals Pipeline`, `Reconciliation`, `Operations`, `Rep Performance`, and `Receivables`.
- **Resource Cards (`.resource-card`):** Interactive query trigger cards with status badges (`Live Data`, `Cross-Board`, `Anomaly`), description tags, and arrow-up-right hover transitions.
- **Transitions.dev Thinking Indicator:** Dynamic multi-phase shimmer indicator (`Querying Monday.com GraphQL API...` → `Loading 346 Deals...` → `Synthesizing...`) with glyph clipping (`background-clip: text`) and smooth enter/exit translation.
- **AI Rim Glow Card (`AiLightsCard`):** Single morphing body animating across 4 UI states (Prompt bar, Progress tracker, Workflow node, Terminal panel) lit by a 5-layer conic opacity canvas mask and rainbow light pulse.
- **Light / Dark Mode Theme Switcher:** Fully adaptive CSS tokens with local storage persistence.

---

## 7. Local Installation & Development

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Monday.com API Key:** Personal API token from Monday.com Developer section
- **Groq API Key:** API key from [console.groq.com](https://console.groq.com)

### 1. Clone the Repository
```bash
git clone https://github.com/NISHANTH-KONCHADA/mondaydotcom-bi-agent.git
cd mondaydotcom-bi-agent
```

### 2. Backend Setup
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
```

Edit `backend/.env`:
```env
MONDAY_API_KEY=your_monday_api_token_here
MONDAY_DEALS_BOARD_ID=5030968060
MONDAY_WORK_ORDERS_BOARD_ID=5030968082
GROQ_API_KEY=your_groq_api_key_here
PORT=3001
```

Start the backend development server:
```bash
npm run dev
# Server running at http://localhost:3001
```

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install

# Start Vite development server
npm run dev
# Frontend running at http://localhost:5173 (proxies /api to http://localhost:3001)
```

---

## 8. Production Deployment Guide

### Backend: Google Cloud Run
The backend is packaged and deployed directly to Cloud Run using Google Cloud Build (no local Docker daemon required):

```bash
cd backend
gcloud run deploy monday-bi-backend \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "MONDAY_API_KEY=...,MONDAY_DEALS_BOARD_ID=5030968060,MONDAY_WORK_ORDERS_BOARD_ID=5030968082,GROQ_API_KEY=..."
```

### Frontend: Firebase Hosting
```bash
cd frontend

# Build optimized production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

---

## 9. Sample Queries & Evaluation Benchmarks

| Query Domain | Sample Prompt | Tools Executed | Key Business Insight Produced |
|---|---|---|---|
| **Pipeline Analysis** | *"How is our pipeline looking for the Mining sector? Show value and stage distribution."* | `get_deals` | Total ₹45.48 Cr across 106 mining deals; highlights ₹25.69 Cr sitting in *"Projects On Hold"*. |
| **Reconciliation** | *"Which won deals do not have a work order yet? Highlight revenue at risk."* | `join_boards` | Identifies won deals missing operational flight scheduling; prevents contract leakage. |
| **Operational Health** | *"Show me work orders by execution status and flag ongoing contracts."* | `get_work_orders` | Breaks down completed vs ongoing flights, surfacing delayed deliverables. |
| **Receivables & Billing** | *"Show billing status breakdown and highlight any negative billing amounts."* | `get_work_orders` | Audits over-billed work orders against POs and surfaces un-invoiced receivables. |
| **Sales Performance** | *"Which sales reps have the highest win rate and pipeline value?"* | `get_deals` | Analyzes rep productivity, win conversions, and open opportunity distribution. |
| **Executive Summary** | `"/summary"` or **Weekly Briefing** | `get_deals`, `get_work_orders`, `join_boards` | Complete 6-part executive briefing synthesizing pipeline, execution, billing, and caveats. |

---

## 10. Repository Structure

```
mondaydotcom-bi-agent/
├── README.md                      # Comprehensive project documentation
├── DECISION_LOG.md                # 2-page decision log and technical trade-offs
├── backend/
│   ├── package.json               # Backend dependencies (Express, @google/genai, groq-sdk)
│   ├── .env.example               # Template environment configuration
│   └── src/
│       ├── index.js               # Express application entry point & routes
│       ├── monday/
│       │   └── client.js          # Monday.com GraphQL v2 client with cursor pagination
│       ├── normalization/
│       │   ├── deals.js           # Deals Pipeline cleaning, stage sorting, coverage logic
│       │   └── workorders.js      # Work Orders lifecycle separation & typo normalizers
│       ├── agent/
│       │   ├── loop.js            # Groq tool-calling agent loop & error recovery
│       │   └── systemPrompt.js    # Executive system instructions (zero emojis, coverage rules)
│       └── tools/
│           ├── index.js           # Composable tool definitions & dispatch registry
│           ├── getSchema.js       # Column catalogs, enum types, and board caveats
│           ├── getDeals.js        # Server-side deal aggregation & filtering
│           ├── getWorkOrders.js   # Server-side work order aggregation & anomaly detector
│           ├── aggregate.js       # Multi-field grouping & arithmetic calculator
│           └── joinBoards.js      # Cross-board reconciliation engine
└── frontend/
    ├── package.json               # Frontend dependencies (React, Lucide, ReactMarkdown)
    ├── vite.config.ts             # Vite configuration with proxy rules
    ├── index.html                 # Single page application entry point
    └── src/
        ├── main.tsx               # React application root
        ├── App.tsx                # Main BI dashboard interface & chat stream
        ├── api.ts                 # API communication layer
        ├── index.css              # Stash design system tokens, themes, & keyframes
        ├── components/
        │   └── ThinkingIndicator.tsx # Transitions.dev thinking states shimmer component
        └── ai-lights/
            ├── AiLightsCard.tsx   # Morphing AI status card
            ├── RimGlow.tsx        # 5-layer conic opacity canvas mask renderer
            ├── Surface.tsx        # Dynamic light/dark theme surface background
            ├── mask.ts            # Off-screen HTML5 Canvas conic gradient mask builder
            ├── use-ai-lights.ts   # Rainbow rim pulse animation loop hook
            └── variants.tsx       # 4 morphing UI variant definitions & typography
```

---

## License

This project is licensed under the [MIT License](LICENSE).
