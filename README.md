# Skylark Drones — Monday.com BI Agent

An AI Business Intelligence agent that answers founder-level queries across Monday.com CRM and Operations boards (**Deals Pipeline** + **Work Orders**) using live data, tool-calling LLMs, and an executive interface.

**Live Application:** [https://mondaydotcom-bi-agent.web.app](https://mondaydotcom-bi-agent.web.app)

---

## Key Features

- **Live Monday.com GraphQL Integration:** Cursor-based pagination across 346 Deals and 176 Work Orders with in-memory TTL caching.
- **Cross-Board Reconciliation:** Automated joins between Deals Pipeline and Work Orders to uncover won deals without work orders, execution delays, and revenue leakage.
- **Autonomous Tool-Calling Loop:** 5 composable tools (`get_deals`, `get_work_orders`, `aggregate`, `join_boards`, `get_schema`) with server-side pre-aggregation to guarantee zero rate-limit issues.
- **Data Quality & Anomaly Awareness:** Proactively flags missing deal values (~52% null), missing close dates, ambiguous deal keys, typo-prone billing statuses, and negative billing amounts.
- **Executive Leadership Briefing:** One-click weekly operational summary (`/summary`) synthesizing pipeline health, sector concentration, receivables, and at-risk accounts.
- **Modern Interface:** Responsive light/dark theme, interactive query suggestions, animated thinking states, and dynamic status telemetry.

---

## Architecture

```
┌───────────────────────────────┐
│     React + TypeScript UI     │  (Firebase Hosting)
│  - Query categorization chips │
│  - Weekly briefing generator  │
│  - Live agent status telemetry│
└──────────────┬────────────────┘
               │  REST / Chat API
┌──────────────▼────────────────┐
│      Node.js Agent Service    │  (Google Cloud Run)
│  - Groq LLM tool calling loop │
│  - In-memory cache layer      │
│  - Schema & anomaly validation│
└───────┬──────────────┬────────┘
        │              │
┌───────▼──────┐ ┌─────▼────────────────┐
│   Groq LLM   │ │ Monday.com GraphQL   │
│  (Tool Call) │ │ - Deals (346 rows)   │
│              │ │ - Orders (176 rows)  │
└──────────────┘ └──────────────────────┘
```

---

## Composable Agent Tools

| Tool | Description |
|---|---|
| `get_schema` | Returns column definitions, allowable enum values, and known data quirks. |
| `get_deals` | Fetches, filters, and computes server-side aggregates across normalized deals. |
| `get_work_orders` | Fetches, filters, and surfaces work order financial metrics and anomaly flags. |
| `aggregate` | Dynamic multi-field group-by, sum, count, and average calculations. |
| `join_boards` | Joins Deals and Work Orders on normalized keys, flagging unlinked accounts. |

---

## Data Quality Handling & Business Logic

- **Deal Value Coverage:** ~52% of deal values are unpopulated; calculations explicitly state the percentage of rows with valid financial numbers.
- **Actual vs Tentative Close Dates:** Actual close date is ~92% null; pipeline forecasting automatically relies on `tentativeCloseDate`.
- **Negative Billing Amounts:** Negative values in *"Amount to be billed"* are surfaced as over-billing against Purchase Orders rather than discarded.
- **Status Normalization:** Canonical mappings resolve typos (e.g., `BIlled` → `Billed`, un-lettered `Project Completed` → `P. Project Completed`).
- **Join Ambiguity:** Non-unique deal names (e.g. repeated project names across clients) are detected and flagged in caveats.

---

## Local Development

### 1. Prerequisites
- Node.js 18+
- Monday.com API Token & Board IDs
- Groq API Key

### 2. Setup & Installation

```bash
# Clone the repository
git clone https://github.com/NISHANTH-KONCHADA/mondaydotcom-bi-agent.git
cd mondaydotcom-bi-agent

# Backend Setup
cd backend
npm install
cp .env.example .env   # Configure MONDAY_API_KEY, GROQ_API_KEY, and BOARD_IDs
npm run dev

# Frontend Setup (in a separate terminal)
cd ../frontend
npm install
npm run dev
```

---

## Sample Queries

- *"How is our pipeline looking for the Mining sector? Show value and stage distribution."*
- *"Which won deals do not have an associated work order yet?"*
- *"Show me billing status breakdown and highlight any negative billing amounts."*
- *"Which sales reps have the highest win rate and pipeline value?"*
- *"/summary"* (Generates an end-to-end executive weekly briefing)
