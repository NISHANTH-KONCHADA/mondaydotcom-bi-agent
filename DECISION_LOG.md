# Decision Log — Skylark Drones BI Agent

## 1. Key Assumptions & Dataset Profiling

1. **Deals Pipeline (346 rows):**
   - *Masked Deal Value:* Null in ~52% of rows. We assume any top-line monetary aggregate must explicitly report record coverage (e.g. "₹45.48Cr across 34 of 106 deals") rather than silently omitting unvalued deals.
   - *Dates:* Actual Close Date (`Close Date (A)`) is ~92% unpopulated. We assume `Tentative Close Date` is the canonical date field for forward-looking and quarterly queries.
   - *Stage Normalization:* A stray header row (`Deal Stage = "Deal Stage"`) was filtered on ingest. The orphan value `"Project Completed"` lacked a letter prefix and was mapped to `"P. Project Completed"` to maintain lexical ordering.
   - *Duplicate Client + Deal Rows:* Records sharing identical `Client Code` + `Deal Name` with distinct tentative dates are treated as successive tranches/milestones rather than duplicates to preserve pipeline evolution history.

2. **Work Orders (176 rows):**
   - *Lifecycle Separation:* `WO Status (billed)` (Open/Closed) tracks accounting/billing status, whereas `Execution Status` (Completed/Ongoing/Not Started) tracks drone field operations. The agent strictly distinguishes between them.
   - *Over-Billing Signal:* Negative values in `Amount to be billed in Rs.` are treated as valid operational signals (over-billing vs original PO) rather than data errors, and are surfaced as anomalies.
   - *Billing Status Typos:* Free-text variants (`BIlled`, `Fully Billed`, `Partially Billed`, `Billed- Visit 7`) were normalized to a canonical enum.

---

## 2. Technical Architecture & Trade-Offs

| Decision | Choice | Rationale & Trade-Offs |
|---|---|---|
| **Data Fetching Layer** | Monday.com GraphQL API v2 (Direct) | Chosen over MCP wrapper for predictable low latency, fine-grained caching, and custom normalization in a time-constrained environment. |
| **LLM & Tool Orchestration** | Groq `openai/gpt-oss-120b` with Native Function Calling | Provides fast inference and high-quality structured reasoning. Compact summary outputs in tools avoid token rate limits. |
| **Data Query Strategy** | In-memory Normalization + Pre-aggregated Tool Responses | With ~520 total rows, vector databases or RAG would add unnecessary latency and hallucination risk. Direct in-memory filtering + grouping guarantees deterministic arithmetic. |
| **Caching Layer** | 5-Minute In-Memory TTL Cache | Balances data freshness with Monday.com API rate limit conservation. Includes manual cache bust endpoint `/api/cache/clear`. |
| **Hosting Platform** | GCP (Cloud Run backend + Firebase Hosting frontend) | Serverless containerized deployment with auto-scaling, HTTPS, and zero local configuration needed for evaluators. |

---

## 3. Cross-Board Join Strategy & Known Limitations

- **Join Strategy:** Joined on normalized, case-insensitive `Deal Name`, with `Owner Code` (`OWNER_00X`) as rep performance alignment.
- **Company Code Namespace Mismatch:** Deals uses `COMPANY_XXX` while Work Orders uses `WOCOMPANY_XXX`. Direct company join is therefore impossible without an explicit crosswalk table.
- **Deal Name Non-Uniqueness:** Masked identifiers (e.g. "Sakura", "Alias_160") repeat across multiple unrelated clients. Matches for these are flagged as *ambiguous* in the agent output with explicit caveats.

---

## 4. Leadership Updates Interpretation

The optional requirement **"The agent should help prepare data for leadership updates"** is implemented as a dedicated `/summary` command and a 1-click **"Weekly Briefing"** button in the UI. 

**Structure of the Leadership Update:**
1. **Executive Pipeline Snapshot:** Total monetary pipeline, open/won/lost distribution, and value coverage percentages.
2. **Sectoral Concentration:** Sector-wise volume and value rankings.
3. **Execution & Operational Health:** Work order completion rates and ongoing field contracts.
4. **Billing & Collections Status:** Outstanding receivables, AR priority accounts, and over-billing anomalies.
5. **At-Risk Opportunities:** Open deals with expired tentative close dates.
6. **Data Integrity Audit:** Transparent caveat list detailing null counts and join ambiguities for the executive team.

---

## 5. What I'd Do Differently With More Time

1. **Monday.com Webhooks:** Replace 5-minute polling cache with real-time webhooks for instantaneous updates.
2. **Entity Resolution & Crosswalk Table:** Build a probabilistic entity-linking model to match `WOCOMPANY_XXX` to `COMPANY_XXX` based on rep, sector, and contract dates.
3. **Executive PDF/Slack Export:** Add automated formatting to export briefings directly to PDF or push to a Slack leadership channel.
4. **Interactive BI Charts:** Embed inline interactive charts (Recharts) inside the chat stream alongside markdown tables.
