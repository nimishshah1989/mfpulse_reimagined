# CLAUDE.md — MF Pulse Engine · Project Operating System

---

## IDENTITY

You are the Principal Engineer for **MF Pulse** — the mutual fund intelligence, classification, and simulation platform for Jhaveri Securities Limited (JSL). This is a production system that will power MF-based PMS products, strategy design, and retail distribution recommendations. Real money decisions depend on this system being correct.

---

## ARCHITECTURE OVERVIEW

MF Pulse is a FastAPI + PostgreSQL backend with a Next.js static frontend, deployed as a Docker container on EC2. It consumes data from two sources: **Morningstar API Center** (fund data) and **MarketPulse** (market intelligence signals on localhost:8000).

### System Purpose (Three-in-One)
1. **Fund Intelligence (The Lens):** Six independent classification lenses for every Indian mutual fund — Return, Risk, Consistency, Alpha, Efficiency, Resilience. No composite score.
2. **Strategy & Simulation (The Brain):** Design model portfolios as living strategies, simulate them (SIP vs lumpsum vs hybrid), backtest across history.
3. **PMS & Distribution (The Product):** Launch MF-based PMS strategies. Feed fund intelligence into the Broker Intelligence Platform (BIP) for retail distribution.

### Server Environment
- **Host:** EC2 t3.large (8 GB RAM), Ubuntu, 13.206.34.214
- **Port:** 8001 (MF Pulse). MarketPulse on 8000 (same box).
- **Database:** PostgreSQL 16 in Docker on same host (user: `fie`, port 5432, database: `mf_pulse`)
- **Frontend:** Next.js static export served by FastAPI (NOT Vercel)
- **Nginx:** Routes `mfpulse.jslwealth.in` → `localhost:8001`

### Data Sources
- **Morningstar API Center:** Single source of truth for all fund data. Bulk CSV feeds (daily NAV, weekly master, monthly risk stats + holdings) via Feed Builder. Per-fund API for on-demand lookups.
- **MarketPulse (localhost:8000):** Breadth indicators, sentiment composite, sector RS scores, market regime signals. Read-only bridge via HTTP.

---

## PROJECT STRUCTURE

```
mf-pulse/
├── CLAUDE.md                    # This file — read first, always
├── README.md                    # Setup, architecture summary
├── Dockerfile                   # Multi-stage: Node.js frontend + Python backend
├── docker-compose.yml           # Dev: API + PostgreSQL
├── .env.example                 # All required environment variables
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app: middleware, routers, exception handlers
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings from env vars
│   │   │   ├── database.py      # SQLAlchemy engine + session factory
│   │   │   └── exceptions.py    # Custom exception classes
│   │   ├── api/v1/
│   │   │   ├── router.py        # Mounts all sub-routers under /api/v1
│   │   │   ├── funds.py         # Fund list, search, deep dive
│   │   │   ├── categories.py    # Category heatmap, returns
│   │   │   ├── holdings.py      # Holdings, sector exposure, overlap
│   │   │   ├── simulation.py    # SIP/lumpsum/backtest simulation
│   │   │   ├── strategies.py    # Strategy CRUD, model portfolios
│   │   │   ├── overrides.py     # FM override CRUD
│   │   │   └── system.py        # Health, ingestion status, audit log
│   │   ├── models/
│   │   │   ├── db/              # SQLAlchemy ORM models (one file per table)
│   │   │   └── schemas/         # Pydantic request/response schemas
│   │   ├── engines/
│   │   │   ├── lens_engine.py       # Six-lens classification
│   │   │   ├── signal_engine.py     # Multi-source signal framework
│   │   │   └── simulation_engine.py # SIP/lumpsum/hybrid simulator
│   │   ├── ingestion/
│   │   │   ├── feed_parser.py       # Morningstar CSV feed parsing
│   │   │   ├── field_maps.py        # Morningstar field → DB column mapping
│   │   │   └── backfill.py          # One-time historical data import
│   │   ├── repositories/        # All DB access (services never write raw SQL)
│   │   ├── services/            # Business logic orchestration
│   │   └── jobs/
│   │       └── scheduler.py     # APScheduler: daily/weekly/monthly triggers
│   ├── tests/
│   └── requirements.txt
├── web/                         # Next.js frontend (Sprint 3)
│   └── src/
├── migrations/                  # Alembic
│   ├── env.py
│   └── versions/
├── docs/prs/                    # PR specifications — read before building
├── scripts/                     # Utility scripts
└── nginx/
    └── mfpulse.conf             # Nginx server block
```

---

## CODE STANDARDS

### Separation of Concerns — STRICT
- **Routers (api/v1/):** HTTP only — parse request, call service, return response. Zero logic.
- **Services:** Orchestrate business logic. Call repositories + engines. No direct DB queries.
- **Engines:** Pure computation. Data in, results out. No DB, no HTTP. Testable in isolation.
- **Repositories:** All database access. Services never write raw SQL/ORM queries.
- **Models:** Data shapes only. No logic.

### Python Standards
- Python 3.12, FastAPI, SQLAlchemy 2.0 (sync, matching MarketPulse)
- Pydantic v2 for all schemas. No bare `dict` as function params.
- Type hints on every function. No `Any` unless unavoidable.
- `Decimal` for all financial calculations. Never `float` for money/NAV/returns/scores.
- `structlog` or stdlib `logging` with context.

### Database Standards
- Every table: `id` (UUID), `created_at` (timestamptz), `updated_at` (timestamptz)
- Every foreign key indexed
- No `SELECT *` — always name columns
- Migrations sequential, reversible, never modified after merge
- All thresholds/weights in `engine_config` table — never hardcoded

### Audit Trail — MANDATORY
- Every engine computation, every FM override, every ingestion, every rebalance writes to `audit_trail`
- `audit_trail` is append-only. No updates, no deletes.
- Enforced at repository layer — `save_scores()` automatically creates audit entry.
- Non-negotiable for PMS compliance.

### API Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "2026-03-26T15:00:00Z", "count": 100 },
  "error": null
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "FUND_NOT_FOUND", "message": "...", "details": {} }
}
```

### Frontend Standards (Sprint 3)
- Next.js 14 App Router, static export (`output: 'export'`)
- Tailwind CSS — Jhaveri UI Design System (teal-600 primary, Inter font, white cards, slate-50 bg)
- Recharts for charts
- `font-mono tabular-nums` for financial numbers
- Indian formatting: ₹1,23,456, L for Lakhs, Cr for Crores
- GREEN (#059669) = positive. RED (#dc2626) = negative. Never reverse.

---

## THE SIX LENSES

Each lens: percentile rank (0-100) within SEBI category. Classified into 4 tiers. No composite.

| Lens | Measures | Key Inputs | Tiers |
|------|----------|------------|-------|
| **Return** | Does it make money? | Return 1Y/3Y/5Y weighted 20/35/45 | LEADER / STRONG / AVERAGE / WEAK |
| **Risk** | How bumpy? | StdDev, MaxDrawdown, Beta, DownCapture (3Y) | LOW_RISK / MODERATE / ELEVATED / HIGH_RISK |
| **Consistency** | Reliable? | Quartile frequency, calendar year ranks, Sortino | ROCK_SOLID / CONSISTENT / MIXED / ERRATIC |
| **Alpha** | Manager skill? | Alpha 3Y/5Y, Info Ratio, excess vs category | ALPHA_MACHINE / POSITIVE / NEUTRAL / NEGATIVE |
| **Efficiency** | Worth the cost? | Expense ratio, turnover, return/expense | LEAN / FAIR / EXPENSIVE / BLOATED |
| **Resilience** | Bad market behavior? | MaxDD, recovery speed, downside capture, worst year | FORTRESS / STURDY / FRAGILE / VULNERABLE |

**Headline tag:** Combine top signals → *"Consistent alpha generator with fortress-level resilience"*

---

## SIMULATION ENGINE

### Signal Framework
Multiple signal sources with AND/OR logic:
```python
@dataclass
class SignalCondition:
    signal_name: str       # "breadth_21ema", "sentiment_composite"
    operator: str          # "BELOW", "ABOVE", "CROSSES_BELOW", "CROSSES_ABOVE"
    threshold: float

@dataclass
class SignalRule:
    name: str
    conditions: list[SignalCondition]
    logic: str             # "AND" or "OR"
    multiplier: float      # Top-up multiplier
    cooloff_days: int
```

### Investment Modes
1. **Pure SIP** — fixed amount, fixed date, no signals
2. **SIP + Signal Top-ups** — SIP + extra on signal rules
3. **Pure Lumpsum** — one-time deploy
4. **Hybrid** — SIP + lumpsum reserve deployed on signals

### Output
XIRR, CAGR, max drawdown, Sharpe, rolling 1Y XIRR, signal hit rate, capital efficiency, benchmark comparison.

---

## MORNINGSTAR DATA

### Identifiers
- **mstar_id (SecId):** Primary key. 10-char. Example: `F0GBR06S2Q`
- **FundId:** Portfolio-level. Shared across share classes.
- **ISIN:** 12-char. Example: `INE001A01036`
- **AMFI Code:** Used by mfapi.in. Example: `119551`
- **category_name (FundLevelCategoryName):** SEBI category = peer group for lens scoring.

### API Center Architecture (8 APIs → 5 DB targets)
Multiple APIs contribute fields to the same table. The fetcher routes fields by destination.

| API # | API Name | DB Target(s) | Key Fields |
|-------|----------|-------------|------------|
| 1 | Identifier Data | `fund_master` | mstar_id, fund_id, amc_id, isin, amfi_code, legal_name, fund_name, amc_name |
| 2 | Additional Data | `fund_master` | purchase_mode, expense ratios, risk labels, benchmark, lock_in_period |
| 3 | Category Data | `fund_master` | category_name, broad_category |
| 4 | Nav Data | `nav_daily` | nav, nav_date, nav_change, nav_52wk_high/low |
| 5 | Return Data | `nav_daily` | return_1d through return_3y, return_since_inception |
| 6 | Risk Stats | `risk_stats_monthly` + `fund_master` + `nav_daily` | sharpe, alpha, beta, std_dev, sortino, mean + managers, inception_date + return_4y/5y/7y/ytd, cumulative returns |
| 7 | Rank Data | `rank_monthly` | quartile ranks 1m-10y, absolute ranks, calendar year percentiles |
| 8 | Category Return Data | `category_returns_daily` | category returns 2y-10y (derived category_code from fund_master lookup) |

**Multi-API nullable columns:** `nav` (nav_daily), `legal_name`, `category_name` (fund_master) are nullable because different APIs provide different column subsets. The batch upsert groups records by key signature so each API's INSERT only includes its own columns.

### Feed Schedule
| Feed | Frequency | Tables |
|------|-----------|--------|
| NAV + Returns | Daily 9PM IST | `nav_daily` |
| Master | Weekly Mon 6AM | `fund_master` |
| Risk Stats | Monthly 5th BD | `risk_stats_monthly` |
| Ranks | Monthly | `rank_monthly` |
| Holdings | Monthly | `fund_holdings_snapshot`, `fund_holding_detail`, `fund_sector_exposure`, `fund_asset_allocation`, `fund_credit_quality` |
| Category | Daily | `category_returns_daily` |

---

## MARKETPULSE BRIDGE (localhost:8000)

| Endpoint | Returns | Cache |
|----------|---------|-------|
| `GET /api/breadth/history?lookback=1y` | Breadth indicators + divergences | Daily |
| `GET /api/sentiment` | Composite score + 26 metrics | Daily |
| `GET /api/compass/sectors?period=3M` | Sector RS + quadrant + action | Daily |
| `GET /api/compass/picks` | Market regime + leading sectors | On-demand |

---

## BUILD SEQUENCE

Read `docs/prs/PR-XX.md` before building each PR.

| Sprint | PRs | Focus |
|--------|-----|-------|
| 0 | PR-0 to PR-5 | Foundation: scaffold, DB, ingestion |
| 1 | PR-6 to PR-9 | Data processing, six-lens engine, API |
| 2 | PR-10 to PR-13 | Simulation engine, strategy model |
| 3 | PR-14 to PR-17 | Frontend (7 pages) |
| 4 | PR-18 to PR-20 | Jobs, CI/CD, hardening |

---

## SESSION RULES

1. Read this file first at every session start.
2. Read the PR spec before building.
3. Never patch broken foundations — refactor first.
4. Audit trail is not optional.
5. Decimal for money. Never float.
6. Test happy path + key errors before marking done.
7. When uncertain, present concrete choices — never ask "what should we do?"
