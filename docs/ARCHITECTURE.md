# MF Pulse Engine — Architecture Proposal v1.0

**Author:** Claude (Principal Engineer)
**Date:** March 26, 2026
**Status:** DRAFT — Awaiting Nimish's review before any code is written

---

## 1. WHAT WE'RE BUILDING

A unified platform that serves as the central nervous system for JSL's mutual fund business. Three interconnected purposes, one system:

**The Lens** — Fund Intelligence: Look at any Indian mutual fund from every angle. Returns, risk, consistency, holdings, sector exposure, manager quality, expense efficiency. Not one composite score — multiple independent dimensions, each telling a clear story.

**The Brain** — Strategy & Simulation: Design model portfolios as living strategies with explicit rules. Simulate them across history — SIP vs lumpsum, different entry timing, different market regimes. Produce statistically robust outcomes. Borrow the proven Compass/Momentum intelligence from MarketPulse.

**The Product** — PMS & Distribution: Launch MF-based PMS products (backtested, systematic). Simultaneously feed recommendations into the BIP for retail MF distribution clients.

---

## 2. SYSTEM NAME

**MF Pulse** — deployed at `mfpulse.jslwealth.in`

Colocated with MarketPulse on the same EC2 + RDS infrastructure in ap-south-1. Shares the PostgreSQL cluster (separate database: `mf_pulse`). Separate FastAPI service on a different port behind Nginx.

---

## 3. DATA FOUNDATION — MORNINGSTAR-FIRST SCHEMA

### 3.1 Design Principle

The database mirrors Morningstar's data universe. Tables are shaped by what Morningstar provides, not by what any scoring engine needs. Engines read from this normalized data store. No column is added "for the engine" — every column traces back to a Morningstar data point or a derived calculation with documented methodology.

### 3.2 Ingestion Strategy

Rather than 18,000+ per-fund API calls, we use Morningstar's Feed Builder for bulk data delivery:

| Feed | Frequency | Content | Delivery |
|------|-----------|---------|----------|
| **Master Feed** | Weekly (Monday 6AM IST) | All 150 Operations/MasterFile fields for full universe | Scheduled CSV via email/FTP |
| **NAV Feed** | Daily (9PM IST) | DayEndNAV, NAVChange, trailing returns (1D through 10Y), 52wk high/low | Scheduled CSV |
| **Risk Stats Feed** | Monthly (5th business day) | All risk ratios: Sharpe, Sortino, Alpha, Beta, StdDev, MaxDrawdown, Capture ratios, Treynor, Information Ratio, Correlation, R-squared, Kurtosis, Skewness — across 1Y/3Y/5Y/10Y | Scheduled CSV |
| **Ranks Feed** | Monthly | Quartile and absolute ranks within category, calendar year percentile ranks | Scheduled CSV |
| **Holdings Feed** | Monthly | Full portfolio holdings with sector, credit quality, market cap breakdown, asset allocation | Scheduled CSV |
| **Category Feed** | Daily (with NAV feed) | Category average returns across all periods | Scheduled CSV |

Additionally, a **single-fund API** remains available for on-demand lookups (the existing `MorningstarFetcher` from the old engine).

**Universe:** All Indian Open End Mutual Funds where `PerformanceReady = true` and `purchase_mode = 1` (Regular). Direct plans excluded from the scoring universe but stored for reference. Estimated: ~3,000 eligible share classes across ~40 SEBI categories.

### 3.3 Core Tables

```
── MORNINGSTAR MIRROR LAYER (raw data, minimal transformation) ──

fund_master              ~3,000 rows    Weekly refresh
  Primary identity, AMC, category, inception, manager, risk level,
  benchmarks, fees, ISIN, AMFI code, SIP availability, lock-in, etc.
  150+ columns mapped 1:1 from Morningstar OperationsMasterFile

nav_daily                ~3,000 × 250 = 750K rows/year    Daily append
  mstar_id, nav_date, nav, nav_change, return_1d, return_1w, return_1m,
  return_3m, return_6m, return_ytd, return_1y, return_2y, return_3y,
  return_4y, return_5y, return_7y, return_10y, return_since_inception,
  nav_52wk_high, nav_52wk_low, cumulative_return_3y/5y/10y

risk_stats_monthly       ~3,000 × 12 = 36K rows/year     Monthly append
  mstar_id, as_of_date, + all risk ratios across horizons:
  sharpe_1y/3y/5y, alpha_3y/5y/10y, beta_3y/5y/10y,
  std_dev_1y/3y/5y, sortino_1y/3y/5y, max_drawdown_1y/3y/5y,
  treynor_1y/3y/5y/10y, info_ratio_1y/3y/5y/10y,
  tracking_error_1y/3y/5y/10y, capture_up_1y/3y/5y/10y,
  capture_down_1y/3y/5y, correlation_1y/3y/5y,
  r_squared_1y/3y/5y, kurtosis_1y/3y/5y, skewness_1y/3y/5y,
  mean_1y/3y/5y

rank_monthly             ~3,000 × 12 = 36K rows/year     Monthly append
  mstar_id, as_of_date,
  quartile_1m/3m/6m/1y/2y/3y/4y/5y/7y/10y,
  abs_rank_1m/3m/6m/ytd/1y/2y/3y/4y/5y/7y/10y,
  calendar_year_pctile_ytd/1y/2y/3y/4y/5y/6y/7y/8y/9y/10y

category_returns_daily   ~40 categories × 250 = 10K rows/year
  category_code, as_of_date,
  cat_return_2y/3y/4y/5y/7y/10y,
  cat_cumulative_2y/3y/4y/5y/7y/10y

── PORTFOLIO / HOLDINGS LAYER ──

fund_holdings_snapshot   ~3,000 × 12 = 36K snapshots/year   Monthly
  mstar_id, portfolio_date, num_holdings, num_equity, num_bond,
  equity_style_box, bond_style_box,
  aum, avg_market_cap, pe_ratio, pb_ratio, roe, roa,
  ytm, avg_eff_maturity, modified_duration, avg_credit_quality,
  prospective_dividend_yield, turnover_ratio

fund_holding_detail      ~3,000 × avg 50 holdings × 12 = 1.8M rows/year
  snapshot_id → fund_holdings_snapshot,
  holding_name, isin, holding_type (equity/bond/cash/other),
  weighting_pct, num_shares, market_value,
  global_sector, country, currency,
  coupon, maturity_date, credit_quality

fund_sector_exposure     ~3,000 × 11 sectors × 12 = 396K rows/year
  mstar_id, portfolio_date, sector_name,
  net_pct (from Morningstar GlobalEquitySector breakdown)
  Sectors: BasicMaterials, CommunicationServices, ConsumerCyclical,
  ConsumerDefensive, Energy, FinancialServices, Healthcare,
  Industrials, RealEstate, Technology, Utilities

fund_asset_allocation    ~3,000 × 12 = 36K rows/year
  mstar_id, portfolio_date,
  equity_net, bond_net, cash_net, other_net,
  indian_large_cap_pct, indian_mid_cap_pct, indian_small_cap_pct,
  (+ full Indian primary-level allocation breakdown)

fund_credit_quality      ~3,000 × 12 = 36K rows/year (debt funds only)
  mstar_id, portfolio_date,
  aaa_pct, aa_pct, a_pct, bbb_pct, bb_pct, b_pct, below_b_pct, not_rated_pct

fund_maturity_breakdown  ~3,000 × 12 = 36K rows/year (debt funds only)
  mstar_id, portfolio_date,
  bucket_1d_7d, bucket_8d_30d, bucket_31d_90d, ..., bucket_over_30y

── BENCHMARK / INDEX LAYER ──

index_master             ~82 rows (from Morningstar index list)
  index_id, index_name, has_eod_price, comments

index_daily              ~82 × 250 = 20.5K rows/year
  index_id, price_date, close_price,
  return_1d/1w/1m/3m/6m/ytd/1y/3y/5y/10y

── INTELLIGENCE LAYER (computed, not Morningstar raw) ──

fund_lens_scores         ~3,000 × 12 = 36K rows/year     Monthly recompute
  mstar_id, computed_date, category_name,
  -- The 6 independent lenses (each 0-100 percentile within category):
  return_score, risk_score, consistency_score,
  alpha_score, efficiency_score, resilience_score,
  -- Plus supporting metadata:
  data_completeness_pct, available_horizons, engine_version

fund_classification      ~3,000 × 12 = 36K rows/year
  mstar_id, computed_date,
  -- Per-lens classification (each is a text label, not a number):
  return_class (LEADER / STRONG / AVERAGE / WEAK),
  risk_class (LOW_RISK / MODERATE / ELEVATED / HIGH_RISK),
  consistency_class (ROCK_SOLID / CONSISTENT / MIXED / ERRATIC),
  alpha_class (ALPHA_MACHINE / POSITIVE / NEUTRAL / NEGATIVE),
  efficiency_class (LEAN / FAIR / EXPENSIVE / BLOATED),
  resilience_class (FORTRESS / STURDY / FRAGILE / VULNERABLE),
  -- Composite human-readable tag:
  headline_tag (e.g. "Consistent alpha generator with moderate risk")

── STRATEGY & SIMULATION LAYER ──

strategy_definition      Small table, ~20-50 strategies
  id, name, description, strategy_type (MODEL_PORTFOLIO / TACTICAL / THEMATIC),
  category_filter (which SEBI categories to pick from),
  allocation_rules (JSONB — weights, constraints, rebalance triggers),
  entry_rules (JSONB — SIP config, lumpsum timing rules),
  exit_rules (JSONB — stop loss, rebalance on classification change),
  created_by, is_active, created_at

strategy_backtest_run    Simulation results
  id, strategy_id, run_date, params (JSONB),
  start_date, end_date, initial_investment,
  mode (SIP / LUMPSUM / HYBRID),
  -- Results:
  final_value, cagr, xirr, max_drawdown, sharpe,
  benchmark_cagr, alpha_vs_benchmark,
  monthly_returns (JSONB array), nav_series (JSONB array),
  -- Metadata:
  simulation_hash, compute_time_ms

strategy_live_portfolio  Active PMS / model portfolios
  id, strategy_id, name, inception_date,
  current_nav, current_aum,
  last_rebalance_date, next_rebalance_due

strategy_portfolio_holding
  portfolio_id → strategy_live_portfolio,
  mstar_id, weight_pct, units, entry_date, entry_nav

── SYSTEM / AUDIT ──

ingestion_log            Tracks every feed ingestion
  id, feed_name, ingestion_date, records_processed, records_failed,
  duration_ms, status, error_details

engine_config            All thresholds and weights
  config_key, config_value (JSONB), description, updated_by
```

---

## 4. THE SIX LENSES — FUND CLASSIFICATION

No composite score. Six independent dimensions, each telling a different story. Each lens is computed as a percentile rank within the fund's SEBI category (peer group). Then classified into 4 tiers.

### Lens 1: RETURN (Does it make money?)
```
Inputs:  Return_1Y, Return_3Y, Return_5Y, Cumulative_3Y/5Y
Weight:  1Y × 20%, 3Y × 35%, 5Y × 45%  (longer = more important)
Method:  Weighted average of percentile ranks within category
Output:  0-100 score → LEADER (>75) / STRONG (50-75) / AVERAGE (25-50) / WEAK (<25)
```

### Lens 2: RISK (How bumpy is the ride?)
```
Inputs:  StdDev_3Y, MaxDrawdown_3Y, Beta_3Y, Downside Capture_3Y
Weight:  Equal weight across 4 metrics
Method:  Percentile rank (inverted — lower risk = higher score)
Output:  0-100 → LOW_RISK (>75) / MODERATE (50-75) / ELEVATED (25-50) / HIGH_RISK (<25)
```

### Lens 3: CONSISTENCY (Can you count on it?)
```
Inputs:  Quartile rank history — how often in Q1/Q2 across 1Y/3Y/5Y
         Calendar year return ranks — % of years in top half
         Sortino_3Y (rewards consistency over raw returns)
Method:  Frequency-based — "this fund was in top quartile X% of measured periods"
Output:  0-100 → ROCK_SOLID (>75) / CONSISTENT (50-75) / MIXED (25-50) / ERRATIC (<25)
```

### Lens 4: ALPHA (Is the manager adding value?)
```
Inputs:  Alpha_3Y, Alpha_5Y, Information Ratio_3Y/5Y,
         Excess return vs category average (3Y, 5Y)
Weight:  5Y metrics × 60%, 3Y metrics × 40%
Method:  Percentile rank. Measures whether the manager is beating their benchmark
         AND their category peers — net of luck.
Output:  0-100 → ALPHA_MACHINE (>75) / POSITIVE (50-75) / NEUTRAL (25-50) / NEGATIVE (<25)
```

### Lens 5: EFFICIENCY (Is it worth the cost?)
```
Inputs:  Net Expense Ratio, Turnover Ratio,
         Return per unit of expense (Return_3Y / Expense Ratio),
         Tracking Error (for index funds — lower = better)
Method:  Expense-adjusted value score. High returns with low expenses = efficient.
Output:  0-100 → LEAN (>75) / FAIR (50-75) / EXPENSIVE (25-50) / BLOATED (<25)
```

### Lens 6: RESILIENCE (How does it behave in bad markets?)
```
Inputs:  MaxDrawdown_3Y, Drawdown recovery months (computed from NAV history),
         Downside Capture_3Y, Upside/Downside capture ratio,
         Performance during worst calendar year
Method:  "When markets crashed, did this fund protect capital and recover fast?"
Output:  0-100 → FORTRESS (>75) / STURDY (50-75) / FRAGILE (25-50) / VULNERABLE (<25)
```

### Why This Works

A fund can be LEADER in returns but VULNERABLE in resilience — that's a high-beta momentum chaser. Another can be AVERAGE in returns but ROCK_SOLID in consistency and FORTRESS in resilience — that's a compounder. The six lenses make this visible instantly without needing to explain a formula.

For the **headline tag**, we combine the top 2-3 strongest signals into a human-readable description: *"Consistent alpha generator with fortress-level resilience"* or *"Strong returns but high risk and erratic consistency."*

---

## 5. HOLDINGS INTELLIGENCE

### 5.1 Sector Exposure Mapping

Every fund's Morningstar GlobalEquitySector breakdown (11 sectors) is stored monthly. This enables:

- **Sector drift detection:** Has the fund changed its sector allocation significantly vs 3/6/12 months ago?
- **Sector concentration risk:** What % is in the top 2-3 sectors? Any single sector >30%?
- **Cross-fund overlap:** If a client holds 3 funds, what's their effective sector allocation? How much hidden overlap?

### 5.2 Market Cap Tilt

Morningstar provides both global (Giant/Large/Mid/Small/Micro) and India-specific (Large/Mid/Small) cap breakdown. We store both. This tells us whether a "Large Cap fund" is actually holding 15% in mid-caps.

### 5.3 Credit Quality & Duration (Debt Funds)

For debt/hybrid funds, the credit quality breakdown and maturity profile are critical risk indicators. A "short duration fund" holding 20% in AA or below is a different beast than one holding 95% AAA.

### 5.4 Holding-Level Analysis

Full portfolio holdings (up to all holdings, not just top 10/25) enable:
- **Stock overlap across funds:** Client holds 3 equity funds — do they all hold Reliance, HDFC Bank, Infosys?
- **Effective portfolio construction:** Aggregate all a client's MF holdings into one virtual portfolio and analyze it as a whole.
- **Manager conviction:** Top 10 holdings concentration tells you how concentrated/diversified the manager's bets are.

---

## 6. STRATEGY & SIMULATION ENGINE

### 6.1 The Strategy Object

A strategy is not "5 funds with weights." It's a configuration object that describes HOW to build and maintain a portfolio:

```python
{
  "name": "JSL Momentum Leaders - Equity",
  "type": "MODEL_PORTFOLIO",
  "universe": {
    "broad_categories": ["Equity"],
    "exclude_categories": ["Sectoral/Thematic", "ELSS"],
    "min_aum_cr": 500,
    "min_track_record_years": 3,
    "purchase_mode": "Regular"
  },
  "selection": {
    "method": "MULTI_LENS",
    "primary_lens": "return_score",
    "min_thresholds": {
      "consistency_score": 40,
      "risk_score": 30,
      "resilience_score": 30
    },
    "max_funds": 8,
    "diversification": {
      "max_per_category": 2,
      "max_per_amc": 2
    }
  },
  "allocation": {
    "method": "EQUAL_WEIGHT",
    "rebalance_frequency": "QUARTERLY",
    "rebalance_trigger": {
      "drift_threshold_pct": 5,
      "lens_downgrade": true  // Rebalance if any holding drops a lens tier
    }
  },
  "risk_management": {
    "max_drawdown_exit_pct": 25,
    "category_concentration_max_pct": 40
  }
}
```

### 6.2 Simulation Modes

**Mode A: Historical Backtest**
Given a strategy definition, simulate how it would have performed over N years of history. The simulator:
1. At each rebalance date, runs the selection logic against historical fund_lens_scores
2. Computes portfolio NAV using historical NAV data
3. Applies all rules: entry, exit, rebalance, risk management
4. Outputs: time-series NAV, CAGR, XIRR, Sharpe, max drawdown, rolling returns

**Mode B: SIP vs Lumpsum Comparison**
Given a strategy + investment amount:
1. Simulate SIP (fixed monthly) vs Lumpsum (full amount at start) vs Smart Entry (lumpsum triggered by momentum/breadth signals from MarketPulse)
2. Run across multiple historical windows (rolling 3Y, 5Y, 7Y windows)
3. Output: probability distribution of outcomes, best/worst/median XIRR, drawdown profiles

**Mode C: Monte Carlo**
Given a strategy + return/risk characteristics:
1. Generate N simulated return paths (using historical return distribution, not normal distribution)
2. Run the strategy across each path
3. Output: probability cones, VaR, expected CAGR range at various confidence levels

### 6.3 MarketPulse Bridge

The Compass system's intelligence feeds into MF Pulse:

| MarketPulse Signal | MF Pulse Usage |
|-------------------|----------------|
| Sector regime (bullish/bearish/neutral per sector) | Weight sector-aligned funds higher during bullish regimes |
| Breadth indicators (advance/decline, new highs) | Signal for Smart Entry mode — deploy lumpsum when breadth is expanding |
| Momentum regime (risk-on / risk-off) | Shift allocation between equity and debt/hybrid strategies |
| Market sentiment score | Input to tactical rebalance triggers |

This is an **API bridge**, not a code import. MF Pulse calls MarketPulse endpoints for signal data. They remain independent services.

---

## 7. FRONTEND — MF PULSE DASHBOARD

Next.js on Vercel (consistent with MarketPulse). Pages:

### Page 1: Market Overview
- Broad market indices (from MarketPulse API)
- Category heatmap: which MF categories are performing best this month/quarter/year
- Sector sentiment overlay (from MarketPulse Compass)
- New fund launches, category reclassifications

### Page 2: Fund Explorer
- Searchable, filterable table of all 3,000+ funds
- Filter by: category, AMC, lens classification, AUM range, expense ratio
- Each row shows: 6 lens scores as visual badges, trailing returns, AUM
- Click → Fund Deep Dive

### Page 3: Fund Deep Dive (per fund)
- Hero section: 6 lens radar chart + headline tag
- NAV chart with benchmark overlay (interactive, zoomable)
- Returns table: 1D through 10Y + calendar year returns
- Risk analytics: all ratios in a clean dashboard
- Holdings: top holdings, sector pie chart, market cap bar, credit quality (if applicable)
- Peer comparison: how does this fund rank vs category on each lens
- Sector drift timeline: how sector allocation has changed over last 12 months

### Page 4: Strategy Lab
- Strategy builder: configure universe, selection rules, allocation, risk management
- Backtest results: NAV chart, statistics table, rolling return chart
- SIP vs Lumpsum comparison: probability distribution
- Save as model portfolio

### Page 5: Model Portfolios
- List of active strategies with live performance
- Each portfolio: current holdings, allocation, next rebalance date
- Performance vs benchmark
- Rebalance alerts when triggered

### Page 6: Overlap Analyzer
- Select 2-5 funds → see effective combined portfolio
- Stock overlap matrix
- Sector allocation of combined portfolio
- Suggested substitutions to reduce overlap

### Page 7: System & Data
- Ingestion status, data freshness for each feed
- Manual trigger for recompute
- Engine config editor
- API documentation

---

## 8. PR-BASED BUILD PLAN

### Sprint 0 — Foundation (PRs 1-4) · Estimated: 5 days

| PR | Description | Deliverable |
|----|-------------|-------------|
| PR-1 | Project scaffold | FastAPI project structure, Docker, .env, CLAUDE.md, CORS config, health endpoint |
| PR-2 | Database foundation | Alembic setup, all table definitions from Section 3.3, initial migration |
| PR-3 | Morningstar ingestion pipeline | Feed CSV parser, bulk upsert logic, ingestion_log tracking, scheduled job stubs |
| PR-4 | Index data pipeline | Index master + daily price ingestion, NIFTY 50/SENSEX/category indices |

### Sprint 1 — Data & Lenses (PRs 5-8) · Estimated: 6 days

| PR | Description | Deliverable |
|----|-------------|-------------|
| PR-5 | NAV + Returns ingestion | Daily NAV feed parser, historical backfill from Morningstar, return computation verification |
| PR-6 | Risk stats + Ranks ingestion | Monthly risk stats parser, rank data parser, data completeness validation |
| PR-7 | Six Lenses engine | The core classification engine: compute all 6 lens scores from ingested data, percentile ranking within category, tier classification, headline tag generation |
| PR-8 | Lens API endpoints | `/api/v1/funds` (list with lens scores), `/api/v1/funds/{mstar_id}` (deep dive), `/api/v1/categories` (heatmap data) |

### Sprint 2 — Holdings & Intelligence (PRs 9-12) · Estimated: 6 days

| PR | Description | Deliverable |
|----|-------------|-------------|
| PR-9 | Holdings ingestion | Full holdings feed parser, sector exposure computation, market cap breakdown, credit quality |
| PR-10 | Holdings API + Overlap engine | Holdings endpoints, sector exposure endpoints, overlap computation for multi-fund analysis |
| PR-11 | MarketPulse bridge | API client that fetches sector regime, breadth, sentiment from MarketPulse. Adapter layer for MF-specific interpretation |
| PR-12 | Frontend: Pages 1-3 | Market Overview, Fund Explorer, Fund Deep Dive — all read-only intelligence pages |

### Sprint 3 — Strategy & Simulation (PRs 13-16) · Estimated: 8 days

| PR | Description | Deliverable |
|----|-------------|-------------|
| PR-13 | Strategy object model | Strategy definition schema, CRUD API, validation logic |
| PR-14 | Historical backtest engine | Core simulation: given strategy + date range, produce NAV series and statistics. Adapted from MarketPulse MomentumSimulator |
| PR-15 | SIP vs Lumpsum simulator | Mode B from Section 6.2: multiple historical windows, probability distributions, Smart Entry mode using MarketPulse signals |
| PR-16 | Frontend: Pages 4-5 | Strategy Lab + Model Portfolios pages |

### Sprint 4 — Polish & Production (PRs 17-19) · Estimated: 4 days

| PR | Description | Deliverable |
|----|-------------|-------------|
| PR-17 | Frontend: Pages 6-7 | Overlap Analyzer + System & Data pages |
| PR-18 | Scheduled jobs | APScheduler integration: daily NAV refresh, monthly risk/holdings/lens recompute, MarketPulse signal sync |
| PR-19 | Production hardening | Error handling audit, logging, rate limiting, API authentication, Nginx config, PM2 setup, deployment script |

**Total: 19 PRs across 4 sprints · ~25 days of work**

---

## 9. KEY ARCHITECTURAL DECISIONS

### ADR-001: Multi-lens over composite score
**Decision:** Six independent lens scores instead of one CRS number.
**Rationale:** A composite number hides tradeoffs. A fund scoring 72/100 tells you nothing about whether that's a high-return risky fund or a low-return safe fund. Independent lenses let the user — whether it's the FM designing a PMS strategy or a broker picking a fund for a client — make decisions based on what matters to THEM.

### ADR-002: Morningstar-first schema
**Decision:** Database tables mirror Morningstar's data structure, not the engine's needs.
**Rationale:** The old engine had tables shaped by QFS/FSAS scoring requirements. Every new insight required schema changes. By storing Morningstar's full data universe in normalized form, any future engine, analysis, or feature can be built on top without touching the schema.

### ADR-003: Bulk feed ingestion over per-fund API calls
**Decision:** Scheduled CSV feeds from Morningstar Feed Builder as primary data source.
**Rationale:** 3,000 funds × 6 API calls = 18,000 requests per refresh cycle. This is slow, fragile (one timeout blocks the chain), and puts unnecessary load on Morningstar's API. Bulk feeds are delivered reliably on schedule, processed in one batch, and complete in minutes not hours.

### ADR-004: Strategy as a first-class object
**Decision:** Model portfolios are strategy configurations, not static fund lists.
**Rationale:** A static list becomes stale. A strategy with explicit selection rules, allocation logic, and rebalance triggers can be backtested, simulated, and deployed live. The same object powers historical analysis, paper trading, and live PMS portfolios.

### ADR-005: MarketPulse as API bridge, not code import
**Decision:** MF Pulse calls MarketPulse REST endpoints for market intelligence.
**Rationale:** Importing code creates tight coupling. If MarketPulse's Compass engine changes its internal API, MF Pulse breaks. An HTTP API bridge means the two systems evolve independently, with a contract at the boundary.

---

## 10. TECH STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | FastAPI (Python 3.12) | Async, Pydantic v2 for all schemas |
| Database | PostgreSQL 15 on AWS RDS (ap-south-1) | Same cluster as MarketPulse, separate `mf_pulse` database |
| ORM | SQLAlchemy 2.0 (async) | Mapped columns, typed models |
| Migrations | Alembic | Sequential, reversible |
| Task scheduler | APScheduler | For daily/weekly/monthly jobs |
| Frontend | Next.js 14 (App Router) on Vercel | Tailwind CSS + Recharts |
| Deployment | EC2 (13.206.50.251) via PM2 + Nginx | Same box as MarketPulse, different port |
| Data source | Morningstar API Center | Bulk feeds + on-demand API |
| Market intelligence | MarketPulse REST API | Sector regime, breadth, sentiment signals |

---

## 11. WHAT'S EXPLICITLY NOT IN V1

- **Direct equity / stock recommendations** — MF Pulse is mutual funds only
- **Client portfolio management** — that's BIP's domain; MF Pulse feeds into BIP
- **Tax optimization / LTCG-STCG engine** — future enhancement
- **Real-time NAV** — Morningstar provides EOD NAV; intraday is not available
- **Multi-currency** — INR only; no international fund support in v1
- **Monte Carlo simulation** — Mode C from Section 6.2 is v2; historical backtest and SIP/Lumpsum are v1

---

## 12. OPEN QUESTIONS FOR NIMISH

1. **Feed Builder access:** Do we have access to Morningstar's Feed Builder today, or only the per-fund API? If only API, Sprint 0 changes significantly — we'd need to build a bulk orchestrator that batches API calls efficiently.

2. **Historical data depth:** How far back can Morningstar deliver historical NAV data? For meaningful backtesting (especially SIP simulations), we need 7-10 years of daily NAV for the universe. Is this available via the Feed Builder as a one-time historical data pull?

3. **MarketPulse API stability:** Is MarketPulse's API contract documented? Which endpoints would MF Pulse call for sector regime, breadth signals, and sentiment scores?

4. **FM signal layer (from old engine):** The old engine had a manual FM sector signal overlay (FSAS). Is this concept still relevant, or does the MarketPulse Compass intelligence fully replace it?

5. **PMS regulatory requirements:** For launching an MF-based PMS, are there specific reporting requirements (daily NAV calculation method, audit trail for rebalance decisions) that need to be built into the system from day one?
