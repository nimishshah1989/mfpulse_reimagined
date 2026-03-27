# MF Pulse — Architecture Amendments v1.1

**Following Nimish's feedback on v1.0 — 7 corrections/additions**

---

## AMENDMENT 1: Feed Builder Access — CONFIRMED

No changes to data strategy. Bulk CSV feeds from Morningstar Feed Builder are the primary ingestion path. The per-fund API remains as a fallback for on-demand lookups only.

**Action:** PR-3 proceeds as designed — Feed CSV parser with bulk upsert.

---

## AMENDMENT 2: Historical Depth — FULL HISTORY AVAILABLE

Morningstar can deliver historical data all the way back. For the one-time backfill:

- **NAV history:** Full daily NAV from inception for every fund in the universe (~3,000 funds × 10-15 years × 250 trading days = ~7.5M-11M rows). This is a one-time Historical Feed from Feed Builder, then daily appends going forward.
- **Risk stats history:** Monthly snapshots going back as far as available. Critical for backtesting the six-lens engine — we need to know what a fund's Sharpe/Alpha/Sortino were 5 years ago, not just today.
- **Holdings history:** Monthly portfolio snapshots going back 3-5 years minimum. Enables sector drift analysis and historical portfolio construction backtesting.

**New PR added to Sprint 0:**

| PR | Description |
|----|-------------|
| PR-3b | **Historical backfill pipeline** — One-time bulk import of NAV, risk stats, and holdings history from Morningstar Historical Feed Builder. Separate from the daily/weekly/monthly incremental pipeline. Runs once, then decommissioned. |

This is the most data-intensive operation. Estimated 10M+ rows for NAV alone. Needs batch insert with progress tracking, chunk-based commits, and resume-on-failure.

---

## AMENDMENT 3: MarketPulse API — NOT DOCUMENTED, BRIDGE ENDPOINTS NEEDED

Reviewed the MarketPulse codebase. The API is functional but has no formal contract document. Here's what MF Pulse needs to consume:

### Endpoints MF Pulse will call:

| MarketPulse Endpoint | What MF Pulse Gets | Frequency |
|---------------------|---------------------|-----------|
| `GET /api/breadth/history?lookback=1y` | Breadth indicator history (stocks above 21 EMA, 50 EMA, 200 EMA, new highs/lows, etc.) | On-demand + daily cache |
| `GET /api/sentiment` | Composite sentiment score + 26 individual metrics | On-demand + daily cache |
| `GET /api/compass/sectors?period=3M` | Sector RS scores, quadrant classification (Leading/Improving/Weakening/Lagging), action signals | On-demand + daily cache |
| `GET /api/compass/picks` | Market regime (risk-on/risk-off), leading sectors, top momentum picks | On-demand |

### What exists vs what needs development:

All four endpoints **already exist and work**. The response shapes are:

- **Breadth:** `{ indicators: { above_21ema: { current, zone, trend, history[] }, ... }, divergences[] }`
- **Sentiment:** `{ composite_score, zone, metrics: [ { name, value, zone, signal } ] }`
- **Compass sectors:** `[ { sector_key, display_name, rs_score, rs_momentum, quadrant, action } ]`
- **Compass picks:** `{ market_regime, leading_sectors[], top_etfs[], top_stocks[] }`

**No development needed on MarketPulse.** MF Pulse creates a thin client (`services/marketpulse_client.py`) that calls these 4 endpoints and caches responses locally. The bridge is read-only — MF Pulse never writes to MarketPulse.

**One consideration:** MarketPulse runs on the same EC2 box. MF Pulse can call `http://localhost:8000/api/...` directly — no cross-network latency, no auth needed (both are internal services on the same machine).

---

## AMENDMENT 4: FM Input Mechanism — LIGHTWEIGHT OVERLAY

The old FSAS engine (manual sector signals with 5-tier weights) is dead. But FM needs a way to express views that the engine respects.

**New design: FM Overrides Table**

```
fm_override
  id, created_by (FM name), created_at,
  override_type: ENUM(
    'FUND_BOOST'     — boost a specific fund's lens score
    'FUND_SUPPRESS'  — suppress a fund from recommendations
    'CATEGORY_TILT'  — tilt strategy allocation toward/away from a category
    'SECTOR_VIEW'    — express bullish/bearish view on a sector
  ),
  target_id: (mstar_id for fund, category_name for category, sector_name for sector),
  direction: ENUM('POSITIVE', 'NEGATIVE', 'NEUTRAL'),
  magnitude: 1-5 scale (1=slight, 5=conviction),
  rationale: TEXT (mandatory — FM must explain why),
  expires_at: DATE (every override has an expiry — no stale opinions),
  is_active: BOOLEAN,
  audit_log_id: FK → audit_trail
```

**How it works in the engine:**
- Fund boost/suppress: Applied as a post-processing adjustment AFTER the six-lens engine runs. A boosted fund gets a visual "FM Pick" badge. A suppressed fund gets excluded from strategy selection. Neither changes the objective lens scores — those remain pure data.
- Category tilt: Strategy allocation engine respects this as a soft constraint. "FM is bullish on large cap" → model portfolio allocator gives +10% weight to large cap funds.
- Sector view: When MarketPulse sector RS says "Technology is Leading" and FM also says "POSITIVE on Technology", the signal is reinforced. When they disagree, both views are displayed — the system shows the conflict, doesn't hide it.

**Every override is audited.** Created → audit_trail. Modified → audit_trail. Expired → audit_trail.

---

## AMENDMENT 5: Audit Trail — MANDATORY FOR ALL ENGINES

New table added to the core schema:

```
audit_trail
  id: UUID,
  timestamp: TIMESTAMPTZ,
  actor: VARCHAR(100) — 'system/lens_engine', 'system/strategy_engine', 'fm/nimish', 'system/ingestion',
  action: VARCHAR(50) — 'SCORE_COMPUTED', 'STRATEGY_REBALANCED', 'FUND_SUPPRESSED',
                         'OVERRIDE_CREATED', 'BACKTEST_RUN', 'DATA_INGESTED', 'CLASSIFICATION_CHANGED',
  entity_type: VARCHAR(50) — 'fund', 'strategy', 'portfolio', 'override', 'ingestion',
  entity_id: VARCHAR(100) — mstar_id, strategy_id, etc.,
  details: JSONB — full context:
    For SCORE_COMPUTED: { previous_scores, new_scores, inputs_hash, engine_version }
    For STRATEGY_REBALANCED: { old_holdings, new_holdings, trigger_reason, trades_proposed }
    For CLASSIFICATION_CHANGED: { fund, old_class, new_class, which_lens_changed }
    For DATA_INGESTED: { feed_name, records, duration_ms }
    For BACKTEST_RUN: { strategy_id, params, result_summary }
  source_ip: VARCHAR(45) — for FM-initiated actions
```

**Audit mandates:**
1. Every lens score computation logs: which funds scored, what inputs, what engine version, what changed from last run.
2. Every strategy rebalance logs: what was held before, what changed, why (drift, lens downgrade, FM override, scheduled).
3. Every FM override logs: who created it, what it affects, when it expires.
4. Every data ingestion logs: what feed, how many records, any failures.
5. Every backtest run logs: parameters, results, who initiated it.

The audit_trail table is append-only. No updates, no deletes. Retention: indefinite (regulatory requirement for PMS).

**Added to quality gates:** No engine method completes without writing an audit record. This is enforced at the repository layer — the `save_scores()` method automatically creates the audit entry.

---

## AMENDMENT 6: Deployment — DOCKER ON EC2, NOT VERCEL

Corrected. MarketPulse is deployed as:
- **Multi-stage Docker image** (Node.js frontend build → Python runtime)
- **Next.js static export** (`pnpm run build` → `web/out/`) served by FastAPI
- **Docker on EC2** (13.206.50.251), port 8000, behind Docker restart policy
- **CI/CD:** GitHub Actions → AWS ECR → EC2 pull + restart

**MF Pulse follows the identical pattern:**

```
mf-pulse/
├── Dockerfile              # Multi-stage: Node.js build + Python runtime
├── docker-compose.yml
├── backend/
│   ├── server.py           # FastAPI orchestrator (same pattern as MarketPulse)
│   ├── models.py           # SQLAlchemy models
│   ├── routers/            # API endpoint handlers
│   ├── services/           # Business logic + engines
│   ├── repositories/       # Database access
│   └── jobs/               # Scheduled tasks
├── web/                    # Next.js frontend
│   ├── src/
│   ├── package.json
│   └── next.config.ts      # output: 'export' for static build
├── migrations/             # Alembic
└── .github/workflows/      # CI/CD to ECR → EC2
```

**Deployment specifics:**
- Same EC2 instance (13.206.50.251) as MarketPulse
- Different container: `mf-pulse` running on port **8001** (MarketPulse on 8000)
- Nginx reverse proxy routes `mfpulse.jslwealth.in` → localhost:8001
- Same RDS cluster, separate database: `mf_pulse`
- Same ECR registry, separate repository: `mf-pulse`
- Frontend built as static export, served by FastAPI (identical to MarketPulse pattern)

**Updated tech stack row:**

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 static export, served by FastAPI (NOT Vercel) |
| Deployment | Docker on EC2 (13.206.50.251:8001) via GitHub Actions → ECR → EC2 |

---

## AMENDMENT 7: Enhanced Simulation Engine — MF SIMULATOR INTEGRATION

Studied the MF Simulator codebase. It's a clean, focused tool:
- Fetches NAV from mfapi.in
- Fetches Nifty 500 stock prices via yfinance for breadth computation
- Computes 2 breadth signals: stocks above 21 EMA and stocks above 200 EMA
- Simulates Regular SIP vs Signal SIP (SIP + top-ups when breadth drops below thresholds)
- Outputs timeline, XIRR, alpha

**What's good and carries forward:**
- The SIP + signal top-up simulation concept is the core idea
- XIRR computation (Newton-Raphson) is solid
- Daily portfolio value timeline construction works well
- Decimal precision for financial calculations

**What needs to be enhanced for MF Pulse:**

### 7A. Multiple Signal Sources (not just 2 breadth metrics)

The current simulator uses only 2 signals: stocks above 21 EMA and stocks above 200 EMA. MF Pulse has access to MarketPulse's full intelligence stack. The enhanced simulator should support:

| Signal | Source | What it measures |
|--------|--------|-----------------|
| Breadth: Stocks above 21 EMA | MarketPulse breadth API | Short-term breadth collapse (panic) |
| Breadth: Stocks above 200 EMA | MarketPulse breadth API | Long-term trend damage (bear market) |
| Breadth: New 52-week lows | MarketPulse breadth API | Extreme pessimism |
| Breadth: Advance-decline ratio | MarketPulse breadth API | Broad market participation |
| Sentiment: Composite score | MarketPulse sentiment API | Multi-factor market mood |
| Sector RS: Leading sectors count | MarketPulse compass API | Sector rotation signal |
| Momentum: NIFTY 50 vs 200 SMA | Computed from index data | Trend filter (Faber-style) |
| Volatility: India VIX level | NSE data | Fear gauge |

### 7B. AND/OR Signal Conditions

The current simulator fires a top-up when ANY enabled signal crosses threshold. Enhanced version needs combinatorial logic:

```python
@dataclass
class SignalCondition:
    signal_name: str          # e.g. "breadth_21ema"
    operator: str             # "BELOW", "ABOVE", "CROSSES_BELOW", "CROSSES_ABOVE"
    threshold: float          # e.g. 75
    
@dataclass  
class SignalRule:
    name: str                 # "Deep panic buy"
    conditions: list[SignalCondition]
    logic: str                # "AND" or "OR"
    multiplier: float         # Top-up multiplier (1x = same as SIP, 2x = double)
    cooloff_days: int         # Min days between triggers of this rule

# Example rules:
rules = [
    SignalRule(
        name="Mild correction",
        conditions=[
            SignalCondition("breadth_21ema", "BELOW", 100),
        ],
        logic="AND",
        multiplier=1.0,
        cooloff_days=30,
    ),
    SignalRule(
        name="Deep panic — max deploy",
        conditions=[
            SignalCondition("breadth_200ema", "BELOW", 200),
            SignalCondition("sentiment_composite", "BELOW", 25),
        ],
        logic="AND",
        multiplier=3.0,
        cooloff_days=14,  # Shorter cooloff — deploy aggressively in panics
    ),
    SignalRule(
        name="Sector opportunity",
        conditions=[
            SignalCondition("nifty_above_200sma", "ABOVE", 0),  # Trend is up
            SignalCondition("leading_sectors_count", "ABOVE", 5),  # Breadth expanding
        ],
        logic="AND",
        multiplier=1.5,
        cooloff_days=45,
    ),
]
```

### 7C. Investment Mode Selection

Current simulator: SIP only (with optional top-ups).
Enhanced version supports 3 modes:

**Mode 1: Pure SIP**
Fixed amount on fixed date (5th of month). No signals. Baseline comparison.

**Mode 2: SIP + Signal Top-ups** (current MF Simulator, enhanced)
Regular SIP + extra deployments when signal rules fire. This is the core innovation — systematic deployment of surplus cash at statistically favorable moments.

**Mode 3: Pure Lumpsum**
Deploy full amount at a single point. Compare: invest at start vs invest when signals fire vs dollar-cost-average over N months.

**Mode 4: Hybrid — SIP + Lumpsum on Signals**
Regular SIP for disciplined investing, plus a lumpsum reserve that gets deployed in chunks when deep-panic signals fire. The user specifies:
- Monthly SIP amount
- Lumpsum reserve amount  
- What % of reserve to deploy per signal event
- Which signal rules trigger lumpsum deployment

### 7D. NAV Source — Morningstar, Not mfapi.in

The MF Simulator uses mfapi.in (AMFI data). MF Pulse has Morningstar NAV in its own database (nav_daily table). The simulator reads directly from PostgreSQL — faster, more reliable, consistent with all other MF Pulse computations.

### 7E. Breadth Data Source — MarketPulse, Not yfinance

The MF Simulator downloads Nifty 500 prices via yfinance to compute breadth. MF Pulse calls MarketPulse's breadth history API instead — the data already exists and is refreshed daily. For historical backtesting, we'll need MarketPulse to have breadth_history going back to at least 2019 (it stores this in the `breadth_history` table).

### 7F. Simulation Output — Enhanced Statistics

Current output: XIRR, absolute return, invested amount, current value.
Enhanced output adds:

| Metric | Description |
|--------|-------------|
| XIRR | Annualized return (✓ exists) |
| CAGR | For lumpsum comparisons |
| Max drawdown | Worst peak-to-trough decline during simulation |
| Drawdown recovery days | How long the worst drawdown took to recover |
| Sharpe ratio | Risk-adjusted return of the strategy |
| Monthly return distribution | Histogram of monthly returns — fat tails visible |
| Rolling 1Y XIRR | How XIRR varied over time — consistency measure |
| Signal hit rate | % of top-up signals that led to positive outcomes within 3/6/12 months |
| Capital efficiency | Return per unit of additional capital deployed via signals |
| Comparison vs benchmark | All metrics computed for NIFTY 50 TRI over the same period |

---

## UPDATED PR PLAN (incorporating all 7 amendments)

### Sprint 0 — Foundation (PRs 1-5) · 6 days

| PR | Description |
|----|-------------|
| PR-1 | Project scaffold: FastAPI, Docker (multi-stage), Nginx config, .env, health endpoint, CLAUDE.md |
| PR-2 | Database foundation: ALL tables including `audit_trail`, `fm_override`. Alembic migration. |
| PR-3 | Morningstar incremental ingestion pipeline: Feed CSV parser → bulk upsert → audit_trail logging |
| PR-4 | Morningstar historical backfill pipeline: One-time bulk import of NAV + risk stats + holdings history |
| PR-5 | Index data + MarketPulse client: Index ingestion + thin HTTP client for breadth/sentiment/compass APIs |

### Sprint 1 — Data & Lenses (PRs 6-9) · 7 days

| PR | Description |
|----|-------------|
| PR-6 | NAV + Returns ingestion (daily feed processing, return computation verification) |
| PR-7 | Risk stats + Ranks + Holdings ingestion (monthly feed processing, sector exposure computation) |
| PR-8 | Six-lens classification engine + audit trail (compute, rank, classify, log every run) |
| PR-9 | Lens + Holdings API endpoints + FM override CRUD |

### Sprint 2 — Simulation Engine (PRs 10-13) · 8 days

| PR | Description |
|----|-------------|
| PR-10 | Signal framework: multi-source signals, AND/OR conditions, configurable rules, cooloff logic |
| PR-11 | SIP simulator core: Mode 1-4 (pure SIP, SIP+signals, lumpsum, hybrid), XIRR, enhanced statistics |
| PR-12 | Strategy object model: definition schema, CRUD, validation, historical backtest orchestrator |
| PR-13 | Simulation API endpoints: `/simulate`, `/backtest`, `/compare-modes` |

### Sprint 3 — Frontend (PRs 14-17) · 7 days

| PR | Description |
|----|-------------|
| PR-14 | Frontend scaffold: Next.js static export, Tailwind, shared components, API client |
| PR-15 | Pages 1-3: Market overview, Fund explorer, Fund deep dive |
| PR-16 | Pages 4-5: Strategy lab (with simulator UI — signal rule builder, mode selector, results), Model portfolios |
| PR-17 | Pages 6-7: Overlap analyzer, System & data (audit log viewer, ingestion status, FM override UI) |

### Sprint 4 — Production (PRs 18-20) · 4 days

| PR | Description |
|----|-------------|
| PR-18 | Scheduled jobs: APScheduler for daily/weekly/monthly cycles, MarketPulse signal sync |
| PR-19 | CI/CD: GitHub Actions → ECR → EC2, deployment script, Nginx config for mfpulse.jslwealth.in |
| PR-20 | Production hardening: error handling audit, rate limiting, API auth, logging, audit trail completeness check |

**Total: 20 PRs across 4 sprints · ~28 days**

---

## UPDATED SYSTEM DIAGRAM NOTE

The architecture diagram from v1.0 remains accurate with one change:
- Frontend box label changes from "Next.js on Vercel" to "Next.js static export served by FastAPI (Docker on EC2)"

All other layers remain unchanged.
