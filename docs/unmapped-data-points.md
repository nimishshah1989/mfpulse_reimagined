# Unmapped Data Points — Backend Returns But Frontend Ignores

**Status:** These fields are already in the DB, already returned by backend API endpoints, but the frontend never reads or displays them. Zero backend work needed — pure frontend wiring.

---

## TIER 1: HIGH-VALUE (Should display immediately)

### 1.1 Absolute Ranks — "Rank 5 of 128" (11 fields)
**Backend:** `_rank_to_dict()` returns `abs_rank_1m` through `abs_rank_10y`
**Frontend gap:** `QuartileRibbon.jsx` only reads `quartile_*` fields, ignores `abs_rank_*`
**Where to surface:**
- QuartileRibbon: Below each quartile cell, show "Rank X" in muted text
- HeroSection: Show "Rank {abs_rank_1y} in {category_name}" next to 1Y return
- FundCard/BubbleTooltip: Show rank badge

| Field | API Path | Display |
|-------|----------|---------|
| abs_rank_1m | ranks.abs_rank_1m | Rank X |
| abs_rank_3m | ranks.abs_rank_3m | Rank X |
| abs_rank_6m | ranks.abs_rank_6m | Rank X |
| abs_rank_ytd | ranks.abs_rank_ytd | Rank X |
| abs_rank_1y | ranks.abs_rank_1y | Rank X |
| abs_rank_2y | ranks.abs_rank_2y | Rank X |
| abs_rank_3y | ranks.abs_rank_3y | Rank X |
| abs_rank_4y | ranks.abs_rank_4y | Rank X |
| abs_rank_5y | ranks.abs_rank_5y | Rank X |
| abs_rank_7y | ranks.abs_rank_7y | Rank X |
| abs_rank_10y | ranks.abs_rank_10y | Rank X |

### 1.2 Calendar Year Percentiles (11 fields)
**Backend:** `_rank_to_dict()` returns `cal_year_pctile_ytd` through `cal_year_pctile_10y`
**Frontend gap:** Completely ignored
**Where to surface:**
- New component: CalendarYearPercentileChart in Fund 360
- Show heatmap: green for P80+, amber for P40-79, red for P0-39 per year

| Field | API Path | Display |
|-------|----------|---------|
| cal_year_pctile_ytd | ranks.cal_year_pctile_ytd | P{value} |
| cal_year_pctile_1y | ranks.cal_year_pctile_1y | P{value} |
| cal_year_pctile_2y | ranks.cal_year_pctile_2y | P{value} |
| cal_year_pctile_3y | ranks.cal_year_pctile_3y | P{value} |
| cal_year_pctile_4y | ranks.cal_year_pctile_4y | P{value} |
| cal_year_pctile_5y | ranks.cal_year_pctile_5y | P{value} |
| cal_year_pctile_6y | ranks.cal_year_pctile_6y | P{value} |
| cal_year_pctile_7y | ranks.cal_year_pctile_7y | P{value} |
| cal_year_pctile_8y | ranks.cal_year_pctile_8y | P{value} |
| cal_year_pctile_9y | ranks.cal_year_pctile_9y | P{value} |
| cal_year_pctile_10y | ranks.cal_year_pctile_10y | P{value} |

### 1.3 Morningstar Style Box (2 fields)
**Backend:** `_snapshot_to_dict()` returns `equity_style_box`, `bond_style_box`
**Universe endpoint:** Already returns `equity_style_box`
**Frontend gap:** Universe page receives it but never displays it; Fund 360 has `portfolio.equity_style_box` but PortfolioMetrics doesn't render it
**Where to surface:**
- HeroSection: Style box badge next to category (e.g., "Large Growth")
- PortfolioMetrics: Morningstar 3x3 grid visual
- Universe BubbleTooltip: Style box label
- FundCard: Style box badge

| Field | API Path | Display |
|-------|----------|---------|
| equity_style_box | portfolio.equity_style_box / fund.equity_style_box | "Large Growth", "Mid Blend", etc. |
| bond_style_box | portfolio.bond_style_box | "High Quality Short", etc. |

### 1.4 Share Change — Portfolio Activity (1 field)
**Backend:** `_holding_to_dict()` returns `share_change`
**Frontend gap:** HoldingsTable receives it but never shows it
**Where to surface:**
- HoldingsTable: Green up-arrow or red down-arrow badge per holding
- "Manager added/reduced" indicator

| Field | API Path | Display |
|-------|----------|---------|
| share_change | holdings[].share_change | +50,000 / -20,000 with arrow |

### 1.5 Multi-Horizon Risk Metrics — 5Y (15 fields already returned)
**Backend:** `_risk_stats_to_dict()` returns all 5Y metrics
**Frontend gap:** LensCard breakdowns only show 3Y metrics
**Where to surface:**
- LensCard expanded detail: Add 5Y column alongside 3Y
- RiskProfile: Add "3Y vs 5Y" comparison row

| Field | API Path | Currently Shown? |
|-------|----------|-----------------|
| sharpe_5y | risk_stats.sharpe_5y | No — show in Efficiency |
| alpha_5y | risk_stats.alpha_5y | Yes (AlphaBreakdown) |
| beta_5y | risk_stats.beta_5y | No — show in Risk |
| std_dev_5y | risk_stats.std_dev_5y | No — show in Risk |
| sortino_5y | risk_stats.sortino_5y | No — show in Consistency |
| max_drawdown_5y | risk_stats.max_drawdown_5y | No — show in Resilience |
| treynor_5y | risk_stats.treynor_5y | No — show in Alpha |
| info_ratio_5y | risk_stats.info_ratio_5y | No — show in Alpha |
| tracking_error_5y | risk_stats.tracking_error_5y | No — show in Alpha |
| capture_up_5y | risk_stats.capture_up_5y | No — show in Risk |
| capture_down_5y | risk_stats.capture_down_5y | No — show in Resilience |
| correlation_5y | risk_stats.correlation_5y | No |
| r_squared_5y | risk_stats.r_squared_5y | No |
| kurtosis_5y | risk_stats.kurtosis_5y | No |
| skewness_5y | risk_stats.skewness_5y | No |

### 1.6 Debt Fund Metrics (5 fields)
**Backend:** `_snapshot_to_dict()` returns ytm, avg_eff_maturity, modified_duration, avg_credit_quality, prospective_div_yield
**Frontend gap:** PortfolioMetrics receives but doesn't display these bond metrics
**Where to surface:**
- PortfolioMetrics: Conditional "Bond Metrics" section when category is Debt
- HeroSection: YTM badge for debt funds

| Field | API Path | Display |
|-------|----------|---------|
| ytm | portfolio.ytm | X.XX% |
| avg_eff_maturity | portfolio.avg_eff_maturity | X.X years |
| modified_duration | portfolio.modified_duration | X.X years |
| avg_credit_quality | portfolio.avg_credit_quality | "AA", "AAA", etc. |
| prospective_div_yield | portfolio.prospective_div_yield | X.XX% |

### 1.7 Holdings Detail Fields (4 fields)
**Backend:** `_holding_to_dict()` returns all these
**Frontend gap:** HoldingsTable only shows name, weighting, sector, isin

| Field | API Path | Display |
|-------|----------|---------|
| num_shares | holdings[].num_shares | Share count |
| market_value | holdings[].market_value | ₹ value in Cr |
| coupon | holdings[].coupon | X.XX% (bond holdings) |
| maturity_date | holdings[].maturity_date | DD Mon YYYY (bond holdings) |

### 1.8 Portfolio Turnover (1 field)
**Backend:** `_snapshot_to_dict()` returns `turnover_ratio`; fund detail also returns `turnover_ratio` from fund_master
**Frontend gap:** Never shown anywhere
**Where to surface:**
- EfficiencyBreakdown in LensCard: "Portfolio Turnover: X%" with context
- PortfolioMetrics: Add as metric

| Field | API Path | Display |
|-------|----------|---------|
| turnover_ratio | portfolio.turnover_ratio / fundDetail.turnover_ratio | XX% |

---

## TIER 2: MEDIUM-VALUE (Nice to have, surface in detail views)

### 2.1 1Y Risk Metrics (already returned, never shown)

| Field | API Path |
|-------|----------|
| sharpe_1y | risk_stats.sharpe_1y |
| std_dev_1y | risk_stats.std_dev_1y |
| sortino_1y | risk_stats.sortino_1y |
| max_drawdown_1y | risk_stats.max_drawdown_1y |
| treynor_1y | risk_stats.treynor_1y |
| info_ratio_1y | risk_stats.info_ratio_1y |
| tracking_error_1y | risk_stats.tracking_error_1y |
| capture_up_1y | risk_stats.capture_up_1y |
| capture_down_1y | risk_stats.capture_down_1y |
| correlation_1y | risk_stats.correlation_1y |
| r_squared_1y | risk_stats.r_squared_1y |
| kurtosis_1y | risk_stats.kurtosis_1y |
| skewness_1y | risk_stats.skewness_1y |
| mean_1y | risk_stats.mean_1y |
| mean_3y | risk_stats.mean_3y |
| mean_5y | risk_stats.mean_5y |

### 2.2 Cumulative Returns (already returned, not shown)

| Field | API Path |
|-------|----------|
| cumulative_return_3y | returns.cumulative_return_3y |
| cumulative_return_5y | returns.cumulative_return_5y |
| cumulative_return_10y | returns.cumulative_return_10y |

### 2.3 Extended Returns (already returned, not shown in most components)

| Field | API Path |
|-------|----------|
| return_2y | returns.return_2y |
| return_4y | returns.return_4y |
| return_7y | returns.return_7y |
| return_10y | returns.return_10y |
| return_15y | returns.return_15y |
| return_20y | returns.return_20y |

### 2.4 10Y Risk Metrics (already returned)

| Field | API Path |
|-------|----------|
| alpha_10y | risk_stats.alpha_10y |
| beta_10y | risk_stats.beta_10y |
| treynor_10y | risk_stats.treynor_10y |
| info_ratio_10y | risk_stats.info_ratio_10y |
| tracking_error_10y | risk_stats.tracking_error_10y |
| capture_up_10y | risk_stats.capture_up_10y |

---

## TIER 3: NEEDS BACKEND WIRE-UP (In DB but not returned by API)

### 3.1 Fund Master Fields Not in `_to_fund_summary()` or `get_fund_detail()`

| Field | DB Table | Backend Fix Needed |
|-------|----------|-------------------|
| gross_expense_ratio | fund_master | Add to `get_fund_detail()` return dict |
| sip_available | fund_master | Add to `_to_fund_summary()` |
| lock_in_period | fund_master | Add to `get_fund_detail()` return dict |
| is_etf | fund_master | Add to `_to_fund_summary()` |
| previous_fund_name | fund_master | Add to `get_fund_detail()` return dict |
| distribution_status | fund_master | Add to `_to_fund_summary()` |
| closed_to_investors | fund_master | Add to `get_fund_detail()` return dict |
| is_insurance_product | fund_master | Add to `_to_fund_summary()` |
| performance_start_date | fund_master | Add to `get_fund_detail()` return dict |

### 3.2 Calendar Year Returns Not in `_nav_to_dict()`

| Field | DB Table | Backend Fix Needed |
|-------|----------|-------------------|
| calendar_year_return_1y - 10y (10 fields) | nav_daily | Add to `_nav_to_dict()` OR new endpoint |

### 3.3 Holdings Snapshot Missing Field

| Field | DB Table | Backend Fix Needed |
|-------|----------|-------------------|
| est_fund_net_flow | fund_holdings_snapshot | Add to `_snapshot_to_dict()` |

---

## IMPLEMENTATION PRIORITY

### Wave 1 — Pure frontend wiring (0 backend changes)
Total: ~50 fields, all already in API responses

1. **Absolute ranks in QuartileRibbon** — 11 fields
2. **Calendar year percentiles** — 11 fields (new small component)
3. **Style box badge** — 2 fields (HeroSection + PortfolioMetrics)
4. **Share change arrows in HoldingsTable** — 1 field
5. **5Y metrics in LensCard breakdowns** — 15 fields (expand existing rows)
6. **Debt fund metrics in PortfolioMetrics** — 5 fields (conditional section)
7. **Holdings detail: market_value, coupon, maturity** — 4 fields
8. **Turnover ratio in EfficiencyBreakdown** — 1 field

### Wave 2 — Small backend additions + frontend
Total: ~20 fields

1. **Fund master additions** — 9 fields (add to `get_fund_detail()` / `_to_fund_summary()`)
2. **Calendar year returns** — 10 fields (add to `_nav_to_dict()` or new endpoint)
3. **est_fund_net_flow** — 1 field (add to `_snapshot_to_dict()`)

### Wave 3 — Extended display
Total: ~35 fields (1Y/10Y risk metrics, cumulative returns, extended return periods)
These are lower priority — useful for a "Full Risk Dashboard" view.

---

## FIELD COUNT SUMMARY

| Category | Fields | Status |
|----------|--------|--------|
| Already returned by API, frontend ignores | ~50 | Wave 1 — frontend only |
| In DB, not returned by API | ~20 | Wave 2 — backend + frontend |
| Lower priority extended metrics | ~35 | Wave 3 — future enhancement |
| **Total unmapped** | **~105** | |
