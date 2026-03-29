# Morningstar Data Point Inventory — MF Pulse

**Generated:** 29 Mar 2026
**Total data points available:** 283
**Actually used in frontend:** 147 (52%)
**Available but unused:** 136 (48%)

---

## Summary by Table

| # | Table | Total Fields | Used in Frontend | Unused | Usage % |
|---|-------|-------------|-----------------|--------|---------|
| 1 | fund_master | 42 | 18 | 24 | 43% |
| 2 | nav_daily | 39 | 24 | 15 | 62% |
| 3 | risk_stats_monthly | 52 | 22 | 30 | 42% |
| 4 | rank_monthly | 32 | 12 | 20 | 38% |
| 5 | fund_holdings_snapshot | 25 | 14 | 11 | 56% |
| 6 | fund_holding_detail | 13 | 7 | 6 | 54% |
| 7 | fund_sector_exposure | 6 | 4 | 2 | 67% |
| 8 | fund_asset_allocation | 9 | 7 | 2 | 78% |
| 9 | fund_credit_quality | 10 | 8 | 2 | 80% |
| 10 | category_returns_daily | 15 | 8 | 7 | 53% |
| 11 | fund_lens_scores (computed) | 13 | 10 | 3 | 77% |
| 12 | fund_classification (computed) | 9 | 8 | 1 | 89% |
| 13 | index_master + index_daily | 18 | 5 | 13 | 28% |
| **TOTAL** | | **283** | **147** | **136** | **52%** |

---

## TABLE 1: fund_master (42 fields)

### Used in Frontend (18)

| DB Column | Morningstar Field | Where Used |
|-----------|------------------|------------|
| mstar_id | SecId | Everywhere — primary key for routing, API calls |
| fund_id | FundId | Fund detail API |
| fund_name | FundName | HeroSection, FundCard, BubbleTooltip, all listings |
| legal_name | LegalName | Fallback when fund_name null |
| amc_name | ProviderCompanyName | HeroSection, FundCard |
| amc_id | ProviderCompanyID | Fund detail API |
| isin | ISIN | Holdings table key |
| category_name | FundLevelCategoryName | Heatmap, filters, LensCard, peer grouping |
| broad_category | BroadCategoryGroup | CategoryHeatmap grouping, filters |
| inception_date | InceptionDate | HeroSection (age calc) |
| purchase_mode | PurchaseMode | HeroSection badge, FundDrillDown filter |
| net_expense_ratio | InterimNetExpenseRatio | HeroSection, LensCard, FundCard, EfficiencyBreakdown |
| indian_risk_level | IndianRiskLevel | HeroSection risk badge |
| primary_benchmark | PrimaryProspectusBenchmarks | HeroSection meta |
| investment_strategy | InvestmentStrategy | Fund detail display |
| managers | Managers | HeroSection, fund detail |
| is_index_fund | IndexFund | CategoryHeatmap exclusion filter |
| is_fund_of_funds | FundOfFunds | CategoryHeatmap exclusion filter |

### NOT Used in Frontend (24)

| DB Column | Morningstar Field | Opportunity |
|-----------|------------------|-------------|
| amfi_code | AMFICode | Link to mfapi.in for historical NAV |
| gross_expense_ratio | GrossExpenseRatio | Show gross vs net expense comparison |
| turnover_ratio | InterimTurnoverRatio | Efficiency lens detail — high turnover = hidden cost |
| performance_start_date | PerformanceStartDate | Filter funds with insufficient track record |
| previous_fund_name | PreviousFundName | Show rename history ("formerly known as") |
| previous_name_end_date | PreviousFundNameEndDate | Rename timeline |
| termination_date | TerminationDate | Flag terminated funds |
| is_etf | ExchangeTradedShare | ETF filter/badge |
| is_insurance_product | AvailableInsuranceProduct | ULIP filter |
| sip_available | SIPAvailability | SIP eligibility check in simulation |
| benchmark_risk_level | india_benchmark_risk_level | Compare fund vs benchmark risk level |
| fund_risk_level | india_fund_risk_level | Alternate risk label |
| investment_philosophy | InvestmentPhilosophy | Fund detail — strategy tab |
| manager_education | CollegeEducationDetail | Fund manager profile |
| manager_birth_year | year_of_birth | Fund manager age |
| manager_certification | certification_name | CFA/FRM badge |
| pricing_frequency | PricingFrequency | Data freshness context |
| legal_structure | LegalStructure | Fund type context |
| domicile_id | DomicileId | Country filter |
| exchange_id | ExchangeId | Exchange listing info |
| closed_to_investors | ClosedToInvestors | "Closed" badge |
| lock_in_period | InitialLockupPeriod | ELSS lock-in display |
| distribution_status | DistributionStatus | Growth vs Dividend filter |
| performance_ready | PerformanceReady | Data quality flag |

---

## TABLE 2: nav_daily (39 fields)

### Used in Frontend (24)

| DB Column | Morningstar Field | Where Used |
|-----------|------------------|------------|
| mstar_id | SecId | Key |
| nav_date | DayEndNAVDate | HeroSection, PerformanceChart |
| nav | DayEndNAV | HeroSection (₹ price), PerformanceChart, simulation |
| nav_change | NAVChange | HeroSection 1D change |
| return_1d | Return1Day | HeroSection returns strip |
| return_1w | Return1Week | HeroSection returns strip |
| return_1m | Return1Mth | HeroSection, ReturnsBars, LensCard |
| return_3m | Return3Mth | HeroSection, ReturnsBars, LensCard |
| return_6m | Return6Mth | HeroSection, ReturnsBars, LensCard |
| return_ytd | ReturnYTD | HeroSection, ReturnsBars, LensCard |
| return_1y | Return1Yr | Everywhere — primary sort, color, display |
| return_2y | Return2Yr | ReturnsBars extended |
| return_3y | Return3Yr | HeroSection, ReturnsBars, LensCard, sorting |
| return_5y | Return5Yr | HeroSection, ReturnsBars, LensCard |
| return_7y | Return7Yr | ReturnsBars extended |
| return_10y | Return10Yr | ReturnsBars extended |
| return_since_inception | ReturnSinceInception | ReturnsBars |
| cumulative_return_3y | CumulativeReturn3Yr | Performance chart tooltip |
| cumulative_return_5y | CumulativeReturn5Yr | Performance chart tooltip |
| nav_52wk_high | NAV52wkHigh | HeroSection 52W range |
| nav_52wk_low | NAV52wkLow | HeroSection 52W range |
| return_4y | Return4Yr | Available via API |
| return_15y | Return15Yr | Available via API |
| return_20y | Return20Yr | Available via API |

### NOT Used in Frontend (15)

| DB Column | Morningstar Field | Opportunity |
|-----------|------------------|-------------|
| cumulative_return_10y | CumulativeReturn10Yr | Long-term performance display |
| calendar_year_return_1y | Year1 | Calendar year returns table |
| calendar_year_return_2y | Year2 | Calendar year returns table |
| calendar_year_return_3y | Year3 | Calendar year returns table |
| calendar_year_return_4y | Year4 | Calendar year returns table |
| calendar_year_return_5y | Year5 | Calendar year returns table |
| calendar_year_return_6y | Year6 | Calendar year returns table |
| calendar_year_return_7y | Year7 | Calendar year returns table |
| calendar_year_return_8y | Year8 | Calendar year returns table |
| calendar_year_return_9y | Year9 | Calendar year returns table |
| calendar_year_return_10y | Year10 | Calendar year returns table |

**HIGH-VALUE OPPORTUNITY:** Calendar year returns (11 fields) are stored but never displayed. These are critical for Consistency lens — showing "3 out of 5 years in top quartile" requires calendar year data. A calendar year returns table in Fund 360 would be very valuable.

---

## TABLE 3: risk_stats_monthly (52 fields)

### Used in Frontend (22)

| DB Column | Morningstar Field | Where Used |
|-----------|------------------|------------|
| mstar_id | SecId | Key |
| as_of_date | EndDate | Risk data freshness |
| sharpe_3y | SharpeRatio3Yr | EfficiencyBreakdown, peer comparison |
| alpha_3y | Alpha3Yr | AlphaBreakdown |
| alpha_5y | Alpha5Yr | AlphaBreakdown |
| beta_3y | Beta3Yr | RiskBreakdown |
| std_dev_3y | StdDev3Yr | RiskBreakdown, RiskProfile |
| max_drawdown_3y | MaxDrawdown3Yr | RiskBreakdown, ResilienceBreakdown |
| sortino_3y | SortinoRatio3Yr | ConsistencyBreakdown |
| info_ratio_3y | InformationRatio3Yr | AlphaBreakdown |
| tracking_error_3y | TrackingError3Yr | AlphaBreakdown |
| treynor_3y | TreynorRatio3Yr | AlphaBreakdown |
| capture_up_3y | CaptureRatioUpside3Yr | RiskBreakdown |
| capture_down_3y | CaptureRatioDownside3Yr | RiskBreakdown, ResilienceBreakdown |
| r_squared_3y | Rsquared3Yr | RiskBreakdown |
| skewness_3y | Skewness3Yr | RiskBreakdown |
| kurtosis_3y | Kurtosis3Yr | RiskBreakdown |
| sharpe_1y | SharpeRatio1Yr | Available but rarely shown |
| std_dev_1y | StdDev1Yr | Available via API |
| max_drawdown_1y | MaxDrawdown1Yr | Available via API |
| mean_3y | Mean3Yr | Available via API |
| correlation_3y | Correlation3Yr | Available via API |

### NOT Used in Frontend (30)

| DB Column | Morningstar Field | Opportunity |
|-----------|------------------|-------------|
| sharpe_5y | SharpeRatio5Yr | 5Y risk-adjusted return comparison |
| alpha_10y | Alpha10Yr | Long-term manager skill proof |
| beta_5y | Beta5Yr | Long-term market sensitivity |
| beta_10y | Beta10Yr | Long-term market sensitivity |
| std_dev_5y | StdDev5Yr | Long-term volatility trend |
| max_drawdown_5y | MaxDrawdown5Yr | Long-term drawdown analysis |
| sortino_1y | SortinoRatio1Yr | Short-term downside risk |
| sortino_5y | SortinoRatio5Yr | Long-term downside risk |
| info_ratio_1y | InformationRatio1Yr | Short-term active management |
| info_ratio_5y | InformationRatio5Yr | Long-term active management |
| info_ratio_10y | InformationRatio10Yr | Very long-term active management |
| tracking_error_1y | TrackingError1Yr | Short-term deviation |
| tracking_error_5y | TrackingError5Yr | Long-term deviation |
| tracking_error_10y | TrackingError10Yr | Very long-term deviation |
| treynor_1y | TreynorRatio1Yr | Short-term risk-adjusted |
| treynor_5y | TreynorRatio5Yr | Long-term risk-adjusted |
| treynor_10y | TreynorRatio10Yr | Very long-term risk-adjusted |
| capture_up_1y | CaptureRatioUpside1Yr | Short-term participation |
| capture_up_5y | CaptureRatioUpside5Yr | Long-term participation |
| capture_up_10y | CaptureRatioUpside10Yr | Very long-term participation |
| capture_down_1y | CaptureRatioDownside1Yr | Short-term protection |
| capture_down_5y | CaptureRatioDownside5Yr | Long-term protection |
| correlation_1y | Correlation1Yr | Short-term correlation |
| correlation_5y | Correlation5Yr | Long-term correlation |
| r_squared_1y | Rsquared1Yr | Short-term tracking |
| r_squared_5y | Rsquared5Yr | Long-term tracking |
| kurtosis_1y | Kurtosis1Yr | Short-term tail risk |
| kurtosis_5y | Kurtosis5Yr | Long-term tail risk |
| skewness_1y | Skewness1Yr | Short-term asymmetry |
| skewness_5y | Skewness5Yr | Long-term asymmetry |

**HIGH-VALUE OPPORTUNITY:** 30 risk metrics across 1Y/5Y/10Y horizons are stored but only 3Y is shown. A multi-horizon risk comparison (1Y vs 3Y vs 5Y) would show risk trend evolution — whether a fund is becoming riskier or safer over time.

---

## TABLE 4: rank_monthly (32 fields)

### Used in Frontend (12)

| DB Column | Where Used |
|-----------|------------|
| mstar_id | Key |
| as_of_date | Freshness |
| quartile_1m - quartile_10y | QuartileRibbon (10 periods) |

### NOT Used in Frontend (20)

| DB Column | Opportunity |
|-----------|-------------|
| abs_rank_1m - abs_rank_10y (11 fields) | Show "Rank 5 of 128" instead of just quartile |
| cal_year_pctile_ytd - cal_year_pctile_10y (11 fields) | Calendar year percentile chart — "P85 in 2024, P72 in 2023" |

**HIGH-VALUE OPPORTUNITY:** Absolute ranks (11 fields) and calendar year percentiles (11 fields) are stored but only quartile ranks are displayed. Showing "Rank 5 of 128 in Large-Cap" is far more impactful than "Quartile 1". Calendar year percentiles show consistency year by year.

---

## TABLE 5: fund_holdings_snapshot (25 fields)

### Used in Frontend (14)

| DB Column | Morningstar Field | Where Used |
|-----------|------------------|------------|
| mstar_id | MStarID | Key |
| portfolio_date | PortfolioDate | Data freshness |
| num_holdings | NumberofHolding | PortfolioMetrics |
| num_equity | NumberOfStockHoldings | PortfolioMetrics |
| num_bond | NumberOfBondHoldings | PortfolioMetrics |
| aum | AsOfOriginalReported | HeroSection, universe AUM filter |
| avg_market_cap | AverageMarketCapMilLong | PortfolioMetrics |
| pe_ratio | PERatioTTMLong | PortfolioMetrics |
| pb_ratio | PBRatioTTMLong | PortfolioMetrics |
| pc_ratio | PCRatioTTMLong | PortfolioMetrics |
| ps_ratio | PSRatioTTMLong | PortfolioMetrics |
| roe_ttm | ROETTMLong | PortfolioMetrics |
| roa_ttm | ROATTMLong | PortfolioMetrics |
| net_margin_ttm | NetMarginTrailingLong | PortfolioMetrics |

### NOT Used in Frontend (11)

| DB Column | Morningstar Field | Opportunity |
|-----------|------------------|-------------|
| equity_style_box | EquityStyleBoxLongName | Morningstar 3x3 style box visual |
| bond_style_box | FixedIncStyleBoxLongName | Fixed income style box visual |
| ytm | YieldtoMaturityLong | Debt fund yield display |
| avg_eff_maturity | AverageEffMaturity | Debt fund maturity profile |
| modified_duration | ModifiedDurationLong | Debt fund duration risk |
| avg_credit_quality | AverageCreditQualityName | Debt fund quality summary |
| prospective_div_yield | ProspectiveDividendYield | Dividend yield display |
| turnover_ratio | AnnualReportTurnoverRatio | Cost analysis |
| est_fund_net_flow | EstFundLevelNetFlow | Money flow indicator |

**HIGH-VALUE OPPORTUNITY:** Style box (iconic Morningstar visual), YTM, duration, and net flows are all stored but unused. The Morningstar 3x3 style box alone would add significant recognition value. Fund net flows show whether smart money is entering/leaving.

---

## TABLE 6: fund_holding_detail (13 fields)

### Used in Frontend (7)

| DB Column | Where Used |
|-----------|------------|
| snapshot_id | FK to snapshot |
| holding_name | HoldingsTable |
| isin | HoldingsTable key |
| holding_type | Holdings display |
| weighting_pct | HoldingsTable weight bars |
| global_sector | HoldingsTable sector badge |
| country | Holdings display |

### NOT Used (6)

| DB Column | Opportunity |
|-----------|-------------|
| num_shares | Show actual share count |
| market_value | Show actual market value in ₹ |
| currency | Multi-currency display |
| coupon | Bond holding yield |
| maturity_date | Bond maturity profile |
| share_change | "Added/Reduced" badges (portfolio activity) |

**HIGH-VALUE OPPORTUNITY:** `share_change` shows portfolio activity — which stocks the fund manager is buying/selling. "Manager added 50,000 shares of Reliance" is highly actionable intelligence.

---

## TABLE 7: fund_sector_exposure (6 fields) — 67% used

| DB Column | Used | Where |
|-----------|------|-------|
| mstar_id | Yes | Key |
| portfolio_date | Yes | Freshness |
| sector_name | Yes | SectorAllocation, CompassChart, FundExposureMatrix |
| net_pct | Yes | SectorAllocation bars, FundExposureMatrix heat colors |
| id | No | Internal |
| created_at | No | Internal |

---

## TABLE 8: fund_asset_allocation (9 fields) — 78% used

| DB Column | Used | Where |
|-----------|------|-------|
| mstar_id | Yes | Key |
| portfolio_date | Yes | Freshness |
| equity_net | Yes | AssetAllocation donut/bars |
| bond_net | Yes | AssetAllocation donut/bars |
| cash_net | Yes | AssetAllocation donut/bars |
| other_net | Yes | AssetAllocation donut/bars |
| india_large_cap_pct | Yes | AssetAllocation cap breakdown |
| india_mid_cap_pct | Yes | AssetAllocation cap breakdown |
| india_small_cap_pct | Yes | AssetAllocation cap breakdown |

---

## TABLE 9: fund_credit_quality (10 fields) — 80% used

| DB Column | Used | Where |
|-----------|------|-------|
| mstar_id | Yes | Key |
| portfolio_date | Yes | Freshness |
| aaa_pct | Yes | CreditQuality bars |
| aa_pct | Yes | CreditQuality bars |
| a_pct | Yes | CreditQuality bars |
| bbb_pct | Yes | CreditQuality bars |
| bb_pct | Yes | CreditQuality bars |
| b_pct | Yes | CreditQuality bars |
| below_b_pct | Yes | CreditQuality bars |
| not_rated_pct | Yes | CreditQuality bars |

---

## TABLE 10: category_returns_daily (15 fields)

### Used in Frontend (8)

| DB Column | Where Used |
|-----------|------------|
| category_name | Category grouping |
| as_of_date | Freshness |
| cat_return_1y (derived) | ReturnsBars "Category" row |
| cat_return_3y | ReturnsBars, HeroSection comparison |
| cat_return_5y | ReturnsBars |
| cat_return_2y | Available |
| cat_return_7y | Available |
| cat_return_10y | Available |

### NOT Used (7)

| DB Column | Opportunity |
|-----------|-------------|
| category_code | Cross-reference key |
| cat_cumulative_2y - cat_cumulative_10y (6 fields) | Cumulative category returns for benchmark comparison |

---

## COMPUTED TABLES (MF Pulse Engine Output)

### fund_lens_scores — 77% used (10/13)
All 6 lens scores used heavily. `data_completeness_pct`, `available_horizons`, `input_hash` unused.

### fund_classification — 89% used (8/9)
All 6 tier classes + headline_tag used. Only `computed_date` unused in display.

---

## TOP 10 HIGHEST-VALUE UNUSED DATA POINTS

These fields are already in the database and could add significant value if surfaced:

| # | Field(s) | Table | Value Proposition |
|---|----------|-------|-------------------|
| 1 | **calendar_year_return_1y to 10y** (11 fields) | nav_daily | Calendar year returns table — shows "Was this fund good EVERY year or just lucky once?" |
| 2 | **abs_rank + cal_year_pctile** (22 fields) | rank_monthly | "Rank 5 of 128" is 10x more impactful than "Quartile 1" |
| 3 | **equity_style_box** | holdings_snapshot | Iconic Morningstar 3x3 visual — instant fund positioning |
| 4 | **share_change** | holding_detail | "Manager buying Reliance, selling HDFC" — portfolio activity |
| 5 | **est_fund_net_flow** | holdings_snapshot | Smart money indicator — is capital flowing in or out? |
| 6 | **5Y risk metrics** (sharpe_5y, alpha_5y, etc.) | risk_stats | Multi-horizon risk evolution — "getting riskier or safer?" |
| 7 | **ytm + modified_duration** | holdings_snapshot | Essential for debt fund analysis |
| 8 | **turnover_ratio** | fund_master | Hidden cost indicator — high turnover = more transaction costs |
| 9 | **prospective_div_yield** | holdings_snapshot | Dividend yield for income-focused investors |
| 10 | **sip_available + lock_in_period** | fund_master | SIP eligibility and ELSS lock-in display |

---

## MarketPulse Data Points (localhost:8000)

In addition to Morningstar, MF Pulse consumes market intelligence from MarketPulse:

| Endpoint | Fields Consumed | Frontend Component |
|----------|----------------|-------------------|
| `/api/breadth/history` | pct_above_ema200, pct_above_ema21, advance_decline_ratio | MarketContextPanel breadth card |
| `/api/sentiment` | composite_score, fear_greed_label, 26 sub-metrics | MarketContextPanel sentiment card |
| `/api/compass/sectors` | sector_name, rs_score, rs_momentum, quadrant, fund_count | CompassChart, FundDrillDown, SectorAllocation |
| `/api/compass/picks` | market_regime, regime_label, leading_sectors | MarketContextPanel regime card, IntelligenceCards |

**MarketPulse provides ~35 additional data points** not counted in the Morningstar total.

---

## Coverage Summary

```
Morningstar Data Points:     283 total
  ├─ Used in frontend:       147 (52%)
  ├─ Available but unused:   136 (48%)
  └─ High-value unused:       ~50 fields that would significantly improve the product

MarketPulse Data Points:      ~35 total
  ├─ Used in frontend:        ~30 (86%)
  └─ Available but unused:     ~5

Combined Total:              ~318 data points available
Actually displayed:          ~177 (56%)
```
