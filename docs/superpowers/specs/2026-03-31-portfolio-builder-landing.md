# MF Portfolio Builder & Landing Page — Design Spec

## Goal
Two deliverables:
1. **Enhanced Strategy Builder** — upgrade existing wizard with NL fund search, exit rules, 5-step flow
2. **Portfolio Landing Page** — new standalone route `/strategies/portfolio/[id]` with 11 rich sections

## What Already Exists

### Backend (Complete)
- `POST /strategies` — create strategy definition (JSONB config)
- `GET/PUT/DELETE /strategies/{id}` — CRUD
- `POST /strategies/{id}/backtest` — save backtest results
- `POST /strategies/{id}/deploy` — deploy as live portfolio
- `GET /strategies/portfolios/{id}` — portfolio detail with holdings
- `SimulationEngine` — 4 modes (SIP, SIP_SIGNAL, LUMPSUM, HYBRID) with XIRR/CAGR/Sharpe/Sortino/MaxDD
- `SignalEngine` — 4 operators (BELOW, ABOVE, CROSSES_BELOW, CROSSES_ABOVE), 9 signal sources, AND/OR logic
- Full audit trail system

### Frontend (Partially Complete)
- `strategies.jsx` — repository page with templates, mode cards, 4-step editor wizard
- `StrategyEditor.jsx` — 4 steps: Mode → Funds → Signals → Review & Backtest
- `FundSelector.jsx` — search, quick filters, tier filters, allocation sliders
- `ConditionBuilder.jsx` — signal rule builder with 9 indicators, multiplier, cooloff
- `SimulationResults.jsx` — backtest results display

## What Needs Building

### A. Backend — Portfolio Analytics Endpoint
**New:** `GET /strategies/portfolios/{id}/analytics`

Returns computed analytics for the portfolio landing page:
```json
{
  "portfolio": { /* existing portfolio data */ },
  "strategy": { /* parent strategy config */ },
  "holdings_analysis": [
    {
      "mstar_id": "...",
      "fund_name": "...",
      "weight_pct": 30.0,
      "current_nav": 45.23,
      "entry_nav": 38.10,
      "return_pct": 18.7,
      "return_contribution_pct": 5.6,  /* weighted return contribution */
      "risk_contribution_pct": 4.2,     /* weighted risk contribution */
      "lens_scores": { /* 6 lenses */ },
      "lens_classes": { /* 6 tier labels */ },
      "sector_exposure": [ /* 11 sectors with pct */ ],
      "asset_allocation": { "equity_net": 95, "large_cap": 65, "mid_cap": 20, "small_cap": 10 }
    }
  ],
  "blended_metrics": {
    "sector_blend": [ { "sector": "Financial Services", "pct": 32.5 }, ... ],
    "market_cap_split": { "large": 65.2, "mid": 20.1, "small": 12.3, "micro": 2.4 },
    "blended_lens_scores": { "return_score": 78, "risk_score": 65, ... },
    "category_avg_lens": { /* for radar overlay */ }
  },
  "risk_profile": {
    "portfolio": { "std_dev": 14.2, "max_drawdown": -18.5, "sharpe": 1.23, "sortino": 1.56, "beta": 0.92, "capture_up": 105, "capture_down": 85 },
    "benchmark": { /* same shape */ }
  },
  "backtest": { /* latest backtest result with nav_series, monthly_returns, signal_events */ },
  "similar_funds": [
    { "mstar_id": "...", "fund_name": "...", "match_pct": 87.3, "cagr_3y": 15.2, "max_drawdown": -12.1, "sharpe_3y": 1.45, "sector_overlap_pct": 82 }
  ],
  "change_trail": [ { "timestamp": "...", "action": "HOLDING_ADDED", "details": {...}, "actor": "..." } ]
}
```

### B. Backend — NL Search Enhancement
**Modify:** `backend/app/services/nl_search_service.py`
- Already exists with keyword parser
- Add: lens tier keywords ("leader", "fortress", "alpha machine")
- Add: metric filter parsing ("sharpe > 1.5", "alpha > 5%")
- Wire to fund search endpoint

### C. Frontend — Strategy Builder Enhancement
**Modify:** `web/src/components/strategies/StrategyEditor.jsx`
- Add Step 0: Name & Description (currently just an inline input)
- Total: 5 steps matching mockup (Name → Mode → Funds → Signals → Review)

**Modify:** `web/src/components/strategies/FundSelector.jsx`
- Add NL search input with parsed token display (colored pills)
- Keep existing quick filters and tier filters as complementary

**Modify:** `web/src/components/strategies/ConditionBuilder.jsx`
- Add exit rules section (optional, same UI as entry rules)
- Add pre-built rule templates dropdown

### D. Frontend — Portfolio Landing Page (NEW)
**New route:** `web/src/pages/portfolio/[id].jsx`
**New components:** `web/src/components/portfolio/`

11 sections:
1. **HeroSection** — gradient header, 8 key metrics, badges (LIVE/SIP+Signals/N Funds)
2. **EquityCurve** — Recharts area chart with portfolio NAV + benchmark overlay
3. **HoldingsTable** — fund list with weight, return, contribution bars (return + risk)
4. **SectorBlend** — horizontal bars for blended sector exposure
5. **MarketCapSplit** — stacked horizontal bar (Large/Mid/Small/Micro)
6. **BlendedLensRadar** — 6-axis radar with category avg overlay
7. **RiskProfile** — 7 metrics in 2 columns (portfolio vs benchmark)
8. **RiskReturnScatter** — quadrant scatter with portfolio + benchmark dots
9. **SimilarFunds** — top 3 matching funds with match %, metrics, overlap
10. **SignalTimeline** — chronological event cards with deployed amount + return since
11. **ChangeTrail** — immutable audit log table

## Design System
- Same as all pages: rounded-xl cards, section-title class, teal-600 primary
- JetBrains Mono for all numbers, tabular-nums
- Green (#059669) positive, Red (#dc2626) negative
- scoreColor() spectrum for all lens scores
- Indian formatting for all amounts (xx,yyy format)
