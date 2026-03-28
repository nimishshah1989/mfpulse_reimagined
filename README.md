# MF Pulse Engine

Mutual fund intelligence, classification, and simulation platform for Jhaveri Securities Limited.

## Quick Start (Local Dev)

```bash
cp .env.example .env          # Edit with your Morningstar credentials
docker compose up -d           # Starts API + PostgreSQL
# API at http://localhost:8001
# Docs at http://localhost:8001/docs
```

## Production Deployment

```bash
# On EC2 13.206.34.214
docker build -t mf-pulse .
docker run -d --name mf-pulse --restart always \
  --network host --env-file .env mf-pulse
```

## Architecture

See `CLAUDE.md` for full architecture, code standards, and build sequence.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL 16
- **Frontend:** Next.js 14 static export served by FastAPI
- **Data:** Morningstar API Center (8 bulk XML APIs)
- **Intelligence:** MarketPulse bridge (breadth, sentiment, sector RS)
- **Deployment:** Docker on EC2 (13.206.34.214:8001)

## Data Ingestion

8 Morningstar APIs feed into 5 database tables. The fetcher handles:
- **Multi-API field routing:** Risk Stats API returns fields for `fund_master`, `nav_daily`, and `risk_stats_monthly` — records are split and routed to each table.
- **Key-signature grouping:** Records with different column subsets are grouped into separate INSERT batches, avoiding NULL padding that would overwrite existing data.
- **Type coercion:** XML string values are converted to Decimal, date, int, bool matching the ORM column types.

### Nullable columns (multi-API design)
- `nav_daily.nav` — nullable because Return Data API provides returns without NAV
- `fund_master.legal_name` — nullable because Category Data API provides categories without names
- `fund_master.category_name` — nullable because Identifier Data API provides names without categories

## Six-Lens Classification

Every fund is scored on 6 independent lenses (percentile rank 0-100 within SEBI category):

| Lens | Measures | Tiers |
|------|----------|-------|
| Return | Does it make money? | LEADER / STRONG / AVERAGE / WEAK |
| Risk | How bumpy? | LOW_RISK / MODERATE / ELEVATED / HIGH_RISK |
| Consistency | Reliable? | ROCK_SOLID / CONSISTENT / MIXED / ERRATIC |
| Alpha | Manager skill? | ALPHA_MACHINE / POSITIVE / NEUTRAL / NEGATIVE |
| Efficiency | Worth the cost? | LEAN / FAIR / EXPENSIVE / BLOATED |
| Resilience | Bad market behavior? | FORTRESS / STURDY / FRAGILE / VULNERABLE |

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/system/health` | GET | Health check |
| `/api/v1/ingestion/fetch/full` | POST | Full 8-API ingestion |
| `/api/v1/ingestion/fetch/{api_name}` | POST | Single API ingestion |
| `/api/v1/lens/compute` | POST | Compute all lens scores |
| `/api/v1/funds/` | GET | Fund list with filtering |
| `/api/v1/funds/{mstar_id}` | GET | Fund deep dive |
