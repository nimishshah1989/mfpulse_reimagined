# PR-14b: Frontend Redesign — Strategies + Pulse Dashboard

## Objective
Merge Simulation Lab and Strategy Builder into a single "Strategies" tab. Every simulation IS a strategy. Build a strategy repository with expandable cards. Redesign Pulse Dashboard as a morning briefing. After this PR, the frontend is complete.

---

## NAVIGATION CHANGE

Old sidebar (6 tabs):
1. Universe Explorer
2. Fund 360°
3. Sector Intelligence
4. Simulation Lab ← REMOVE
5. Strategy Builder ← REMOVE
6. Pulse Dashboard

New sidebar (5 tabs):
1. Universe Explorer
2. Fund 360°
3. Sector Intelligence
4. **Strategies** ← MERGED (was Simulation + Strategy)
5. Pulse Dashboard

---

## TAB 4: Strategies (Merged Simulation + Strategy Builder)

### Concept
Every investment plan is a "Strategy". Creating one involves: selecting funds, setting allocation, defining investment conditions, and running a backtest simulation. Strategies persist as a repository — you can compare them, modify them, and track them over time. Each strategy has its own card and expandable detail page (like Multi Asset Alpha in MarketPulse's model portfolio section).

### File: `web/src/pages/strategies.jsx`

**Two views:**
1. **Strategy Repository** (default when no strategy selected) — grid of strategy cards
2. **Strategy Editor** (when creating/editing a strategy)

---

### VIEW 1: Strategy Repository

```
┌─────────────────────────────────────────────────────────┐
│ Strategies                                              │
│ "Your investment playbooks — build, simulate, compare"  │
│                                                         │
│ [+ New Strategy]  [Compare Selected]                    │
│                                                         │
│ ┌───────────────────────────────────────────────────┐   │
│ │ Multi Asset Alpha v2                    ACTIVE    │   │
│ │ 5 funds · ₹23K SIP/mo · 3 conditions · Since 2019│   │
│ │ XIRR: 17.8% · Value: ₹51.2L · Invested: ₹31.6L │   │
│ │ [Expand] [Edit] [Duplicate] [Compare]             │   │
│ ├───────────────────────────────────────────────────┤   │
│ │ Conservative Debt Play              BACKTEST ONLY │   │
│ │ 3 funds · ₹15K SIP/mo · 1 condition · 5Y period  │   │
│ │ XIRR: 9.4% · Value: ₹11.2L · Invested: ₹9L     │   │
│ │ [Expand] [Edit] [Duplicate] [Compare]             │   │
│ ├───────────────────────────────────────────────────┤   │
│ │ Momentum Alpha Aggressive           BACKTEST ONLY │   │
│ │ 4 funds · Lumpsum-on-events · 7Y period           │   │
│ │ XIRR: 22.1% · Value: ₹38.4L · Invested: ₹18L   │   │
│ │ [Expand] [Edit] [Duplicate] [Compare]             │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Strategy Card** shows:
- Strategy name (editable)
- Status badge: ACTIVE (running from start date to present) / BACKTEST ONLY (historical simulation)
- Fund count, monthly commitment, condition count, period
- Key metrics: XIRR, current value, total invested
- All metrics colored by green-to-red spectrum
- Action buttons: Expand (shows full detail page), Edit, Duplicate, Compare

**Expand** opens a detail page inline (or navigates to `/strategies/{id}`) showing:
- Full fund list with allocations and lens tags
- Investment conditions
- Equity curve chart (with event markers)
- Results breakdown (SIP vs SIP+topups vs Lumpsum comparison)
- Event log
- Like the Multi Asset Alpha page in MarketPulse

**Compare mode:** Select 2-3 strategies → side-by-side comparison of XIRR, value, risk, event count, equity curves overlaid.

---

### VIEW 2: Strategy Editor

Accessed via "+ New Strategy" or "Edit" on an existing strategy.

**Step 1: Investment Mode**
Three modes as a toggle:
1. **SIP + top-ups** — regular SIP with extra deployment on conditions
2. **Distribute annual budget as lumpsum** — parks SIP×12 in liquid, deploys chunks on conditions, forced SIP if no event for N days
3. **Custom per fund** — each fund gets its own SIP/lumpsum/condition config independently

**Step 2: Select Funds**
- Search bar with autocomplete
- Quick filters: "Top 5 by alpha", "Large cap leaders", "Best Sharpe", "From sector intelligence"
- Can also type a natural language mandate: "Need 40% financial + energy, 20% tech, rest diversified" → parses and recommends (if recommendation engine is ready; otherwise just manual search)
- Each added fund shows:
  - Name + key lens tags (colored by spectrum, adjective labels like "Leader" / "Strong" / "Weak")
  - Allocation % input
  - Per-fund deploy amount (in lumpsum-on-events mode)
- Total allocation must = 100% (validation bar at bottom)

**Step 3: Investment Conditions**
Condition builder using MarketPulse indicators:

**Available indicators (dropdown):**
| Indicator | Source | Direction |
|-----------|--------|-----------|
| % stocks above 21-day EMA | MarketPulse Breadth | falls below / rises above |
| % stocks above 50-day EMA | MarketPulse Breadth | falls below / rises above |
| % stocks above 200-day EMA | MarketPulse Breadth | falls below / rises above |
| Advance-decline ratio (21d avg) | MarketPulse Breadth | falls below / rises above |
| New highs vs new lows ratio | MarketPulse Breadth | falls below / rises above |
| VIX level | Market data | falls below / rises above |
| Sentiment composite score | MarketPulse Sentiment | falls below / rises above |
| Nifty vs 200-day SMA (%) | Market data | falls below / rises above |
| Sector RS breadth (leading count) | MarketPulse Compass | falls below / rises above |

**Each condition set:**
- IF [indicator dropdown] [operator dropdown] [threshold number input]
- AND/OR toggle
- More conditions can be added within the set
- Action: Deploy Nx SIP / Deploy fixed amount
- Cooloff: N days between events

**Multiple condition sets** connected by OR logic (any set triggers deployment).

**Forced SIP setting** (for lumpsum-on-events mode):
- "If no condition fires for [N] days, deploy a regular SIP to maintain discipline"

**Live feedback:**
- "These conditions triggered 8 times in 10 years"
- "Your budget would deploy in ~2-3 events"

**Step 4: Simulation Period**
- Start date: date picker (default: 5 years ago)
- End date: "Today" (default) or specific date
- Mode: 
  - **Backtest only** — runs simulation from start to end, saves results
  - **Active strategy** — simulation runs from start to today AND continues forward. Future condition triggers will be flagged in the dashboard. Strategy stays "live" until paused.

**Step 5: Run & Results**
- "Run Simulation" button
- Results appear below:
  - 3-column comparison: Plain SIP vs SIP+Conditions vs Lumpsum-on-Events
  - Each column: XIRR, total invested, current value, max drawdown, Sharpe
  - All metrics with colored tags (green-to-red spectrum)
  - Best mode highlighted
  - Narrative insight: "The 8 extra investments during dips added ₹8.4L — 20% more wealth"
  - Equity curve chart with event markers (clickable → shows what condition fired)
  - Event log: date, condition that triggered, amount deployed, gain since
- "Save Strategy" button → adds to repository

### Components:
- `web/src/components/strategies/StrategyRepository.jsx` — grid of strategy cards
- `web/src/components/strategies/StrategyCard.jsx` — card with metrics + actions
- `web/src/components/strategies/StrategyDetail.jsx` — expanded detail page
- `web/src/components/strategies/StrategyEditor.jsx` — the step-by-step builder
- `web/src/components/strategies/FundSelector.jsx` — search + add funds with lens tags
- `web/src/components/strategies/ConditionBuilder.jsx` — MarketPulse indicator conditions
- `web/src/components/strategies/SimulationResults.jsx` — 3-column comparison + chart + event log
- `web/src/components/strategies/StrategyCompare.jsx` — side-by-side strategy comparison
- `web/src/components/strategies/ModeToggle.jsx` — SIP+topups / Lumpsum-on-events / Custom

---

## TAB 5: Pulse Dashboard Redesign

### File: `web/src/pages/dashboard.jsx` (rewrite)

The dashboard is a morning briefing. Open it at 9 AM and know exactly what to do.

**Market Posture** (hero section):
- Traffic light indicator: Bullish (green) / Cautious (amber) / Defensive (red)
- 3-5 sentence narrative explaining WHY and what it means for MF allocation
- Generated client-side from breadth + sentiment + VIX + sector data
- Specific MF actions: "Continue large-cap SIPs" / "Pause small-cap lumpsum" / "Debt attractive at 8%+"

**Metric Cards** (4 across):
- Each has: metric name, large value, and 1-line explanation
- Breadth: "62%" + "Fading from 71% last week"
- Sentiment: "55/100" + "Neutral — neither fear nor greed"
- VIX: "14.2" + "Low volatility regime"
- Leading sectors: "4 of 11" + "IT, Pharma entering leading"

**Sector Moves:**
- Color-coded cards (green border = entering leading, amber = weakening, red = warning)
- Each card: sector name, what happened, which funds are affected
- Fund chips are clickable → navigate to Fund 360°

**Active Strategies Alert** (new — connects to strategy repository):
- "Your strategy 'Multi Asset Alpha v2' has a condition approaching trigger"
- "Breadth at 62%, your threshold is 40% — no action needed yet"
- If a condition fires: "ALERT: Breadth dropped to 38%. Deploy 3x SIP per your 'Multi Asset Alpha' strategy"

**Top Funds by Lens** (3 across: Return leaders, Alpha generators, Fortress resilience):
- 3 funds per card, clickable → Fund 360°
- Lens scores as colored circles, adjective tags

**Data Status:**
- NAV latest date, lens computed time, fund count, MarketPulse status
- Colored badges (green = fresh, amber = stale, red = very stale)
- Refresh / Recompute buttons

### Components:
- `web/src/components/dashboard/MarketPosture.jsx` — hero briefing with narrative
- `web/src/components/dashboard/MetricCards.jsx` — 4 cards with explainers
- `web/src/components/dashboard/SectorMoves.jsx` — color-coded sector alerts
- `web/src/components/dashboard/StrategyAlerts.jsx` — active strategy notifications
- `web/src/components/dashboard/TopFundsByLens.jsx` — 3 lens leader cards
- `web/src/components/dashboard/DataStatus.jsx` — freshness badges

---

## Data Requirements

### APIs already built:
- All fund/lens/category APIs ✓
- Simulation API (POST /simulation, POST /simulation/compare) ✓
- Strategy CRUD (POST/GET/PUT /strategies) ✓
- MarketPulse bridge (breadth, sentiment, sectors, regime) ✓
- Override CRUD ✓

### Field mapping verification:
Before building, Claude Code should verify these fields are populated in the DB:
```sql
SELECT COUNT(*) FROM fund_master WHERE amc_name IS NOT NULL;
SELECT COUNT(*) FROM fund_master WHERE net_expense_ratio IS NOT NULL;
SELECT COUNT(*) FROM fund_master WHERE inception_date IS NOT NULL;
SELECT COUNT(*) FROM fund_holdings_snapshot;
SELECT COUNT(*) FROM fund_sector_exposure;
SELECT COUNT(*) FROM nav_daily WHERE nav_date < '2024-01-01';
```

If amc_name or inception_date are NULL for most funds, the Fund 360° header will show gaps. If nav_daily has no historical data, simulation can't run. If sector_exposure is empty, sector tags on holdings won't work. Log warnings but don't block the build — use graceful empty states.

---

## QA Checklist

### Strategies Tab
1. Repository shows saved strategies as cards
2. "New Strategy" opens editor with mode toggle
3. Fund search works and shows lens tags
4. Allocation validates to 100%
5. Condition builder: add/remove conditions with AND/OR
6. All MarketPulse indicators available in dropdown
7. Lumpsum-on-events mode: shows budget math and forced SIP setting
8. Start date picker works, end date defaults to today
9. Run simulation: 3-column comparison renders
10. Equity curve shows event markers
11. Event log shows date, condition, amount, gain
12. Save strategy adds to repository
13. Compare mode: 2 strategies side by side

### Pulse Dashboard
14. Market posture narrative generates from MarketPulse data
15. Metric cards have explainer subtexts
16. Sector moves show affected funds
17. Active strategy alerts connect to saved strategies
18. Top funds by lens show colored circles
19. Data status shows freshness correctly
20. MarketPulse offline → clear fallback

### Both
21. `pnpm build` succeeds
22. All scores use green-to-red spectrum
23. All numbers have adjective context
24. Navigation between all 5 tabs works

Commit: `PR-14b: frontend redesign — strategies (merged sim+strategy) + pulse dashboard`
