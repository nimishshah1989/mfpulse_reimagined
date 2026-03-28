"""Morningstar CSV column header → database column name mappings.

One dict per feed type. Every Morningstar field that we store must appear here.
Fields we intentionally skip are documented in MASTER_FIELDS_SKIPPED.
"""

MASTER_FIELD_MAP: dict[str, str] = {
    # Identifiers
    "SecId": "mstar_id",
    "FundId": "fund_id",
    "ProviderCompanyID": "amc_id",
    "ProviderCompanyName": "amc_name",
    "LegalName": "legal_name",
    "FundName": "fund_name",
    "ISIN": "isin",
    "AMFICode": "amfi_code",
    # Classification
    "FundLevelCategoryName": "category_name",
    "BroadCategoryGroup": "broad_category",
    # Dates
    "InceptionDate": "inception_date",
    # Fund type
    "PurchaseMode": "purchase_mode",
    "IndexFund": "is_index_fund",
    "FundOfFunds": "is_fund_of_funds",
    "ExchangeTradedShare": "is_etf",
    "AvailableInsuranceProduct": "is_insurance_product",
    "SIPAvailability": "sip_available",
    # Costs & ratios
    "InterimNetExpenseRatio": "net_expense_ratio",
    "GrossExpenseRatio": "gross_expense_ratio",
    "InterimTurnoverRatio": "turnover_ratio",
    # Risk labels
    "IndianRiskLevel": "indian_risk_level",
    "india_benchmark_risk_level": "benchmark_risk_level",
    "india_fund_risk_level": "fund_risk_level",
    # Benchmark
    "PrimaryProspectusBenchmarks": "primary_benchmark",
    # Strategy text
    "InvestmentStrategy": "investment_strategy",
    "InvestmentPhilosophy": "investment_philosophy",
    # Managers
    "Managers": "managers",
    "CollegeEducationDetail": "manager_education",
    "year_of_birth": "manager_birth_year",
    "certification_name": "manager_certification",
    # Performance
    "PerformanceReady": "performance_ready",
    "PerformanceStartDate": "performance_start_date",
    "PreviousFundName": "previous_fund_name",
    "PreviousFundNameEndDate": "previous_name_end_date",
    # Fund structure
    "PricingFrequency": "pricing_frequency",
    "LegalStructure": "legal_structure",
    "DomicileId": "domicile_id",
    "ExchangeId": "exchange_id",
    # Access restrictions
    "ClosedToInvestors": "closed_to_investors",
    "InitialLockupPeriod": "lock_in_period",
    "DistributionStatus": "distribution_status",
    # Termination
    "TerminationDate": "termination_date",
}

MASTER_FIELDS_SKIPPED: list[dict[str, str]] = [
    # Administrative / company info — not needed for fund analysis or scoring
    {"field": "ProviderCompanyPhoneNumber", "reason": "AMC contact number — administrative"},
    {"field": "ProviderCompanyWebsite", "reason": "AMC website — administrative"},
    {"field": "ProviderCompanyCountryHeadquarter", "reason": "AMC country HQ — administrative"},
    {"field": "DistributorCompanies", "reason": "Distributor companies — administrative"},
    {"field": "RegistrationCompanies", "reason": "Registration companies — administrative"},
    {"field": "AuditorCompanies", "reason": "Auditor companies — administrative"},
    {"field": "CustodianCompanies", "reason": "Custodian companies — administrative"},
    {"field": "TransferAgentCompanies", "reason": "Transfer agent companies — administrative"},
    {"field": "TrusteeCompanies", "reason": "Trustee companies — administrative"},
    {"field": "AdministratorCompany", "reason": "Administrator company — administrative"},
    {"field": "AdvisorListCountryHeadquarter", "reason": "Advisor country HQ — administrative"},
    # Investment minimums / SIP / SWP / STP details — operational, not analytical
    {"field": "MinimumInitial", "reason": "Min initial investment — operational detail"},
    {"field": "MinimumSubsequent", "reason": "Min subsequent investment — operational detail"},
    {"field": "MinimumRedemptionAmount", "reason": "Min redemption amount — operational detail"},
    {"field": "AIP", "reason": "SIP frequency/tenure/amounts — operational detail"},
    {"field": "systematic_withdrawal_plan_indicator", "reason": "SWP availability — operational detail"},
    {"field": "systematic_withdrawal_amount", "reason": "SWP min amount — operational detail"},
    # Fee / load details beyond what we map
    {"field": "DeferLoads", "reason": "Exit load breakpoint details — complex nested structure"},
    {"field": "deferred_load_additional_details", "reason": "Exit load text — unstructured text"},
    {"field": "MaximumDeferLoad", "reason": "Max exit load — covered by load text"},
    {"field": "MaximumManagementFee", "reason": "Max mgmt fee — prospectus cap, not actual"},
    {"field": "ActualManagementFee", "reason": "Prospectus mgmt fee — we track net expense ratio instead"},
    # Dates / identifiers we don't need
    {"field": "ProspectusDate", "reason": "Prospectus date — not needed for scoring"},
    {"field": "LatestProspectusDate", "reason": "Latest prospectus date — not needed for scoring"},
    {"field": "AnnualReportDate", "reason": "Annual report date — not needed for scoring"},
    {"field": "FiscalYearEndMonth", "reason": "Fiscal year end — not needed for scoring"},
    {"field": "SubscriptionStartDate", "reason": "NFO subscription start — historical only"},
    {"field": "ipoDate", "reason": "NFO subscription end — historical only"},
    {"field": "OfferPrice", "reason": "NFO offer price — historical only"},
    # Alternate names / IDs
    {"field": "GlobalCategoryId", "reason": "Global category ID — we use FundLevelCategoryName instead"},
    {"field": "SFIN", "reason": "SEBI Fund Identification Number — we use ISIN + AMFI code"},
    {"field": "RTACode", "reason": "RTA code — operational detail"},
    {"field": "channel_partner_code", "reason": "Channel partner code — distribution detail"},
    {"field": "SalesArea", "reason": "Sales area country — always India for us"},
    {"field": "SecurityType", "reason": "Security type — always MF for this feed"},
    {"field": "OperationReady", "reason": "Morningstar internal readiness flag"},
    {"field": "FundStandardName", "reason": "Standard name — we use FundName"},
    {"field": "PurchaseCurrencyId", "reason": "Purchase currency — always INR for us"},
    {"field": "PurchaseCurrencyName", "reason": "Purchase currency name — always INR"},
    # Dividend details — separate tracking
    {"field": "Dividendinvestmentplan", "reason": "Dividend payout/reinvest — covered by DistributionStatus"},
    {"field": "DistributionFrequency", "reason": "Distribution frequency — covered by DistributionStatus"},
    {"field": "DividendDistributionFrequencyDetails", "reason": "Dividend freq details — not needed for scoring"},
    # Risk class (India-specific, beyond our 3 risk fields)
    {"field": "potential_risk_class_matrix", "reason": "SEBI risk-o-meter matrix — we track india_fund_risk_level"},
    # Dividend data in Performance feed
    {"field": "Dividend", "reason": "Fund dividend declared — not needed for NAV/return analysis"},
    {"field": "DividendDate", "reason": "Dividend date — not needed for scoring"},
    {"field": "DailyDividend", "reason": "Daily dividend — not needed for scoring"},
    {"field": "DailyDividendDate", "reason": "Daily dividend date — not needed for scoring"},
    {"field": "Dividendinvestment", "reason": "Dividend payout/reinvest in perf feed — not needed"},
    # 52-week dates (we keep high/low values but not dates)
    {"field": "NAV52wkHighDate", "reason": "52-week high date — we keep the NAV value only"},
    {"field": "NAV52wkLowDate", "reason": "52-week low date — we keep the NAV value only"},
    # ETF market price
    {"field": "DayEndMarketPriceDate", "reason": "ETF market price/date — we focus on NAV not market price"},
    # 15-year risk stats (too long a horizon for our scoring)
    {"field": "CaptureRatioUpside15Yr", "reason": "15yr horizon — beyond our scoring timeframes"},
    {"field": "InformationRatio15Yr", "reason": "15yr horizon — beyond our scoring timeframes"},
    {"field": "TrackingError15Yr", "reason": "15yr horizon — beyond our scoring timeframes"},
    {"field": "TreynorRatio15Yr", "reason": "15yr horizon — beyond our scoring timeframes"},
]

NAV_FIELD_MAP: dict[str, str] = {
    "SecId": "mstar_id",
    "DayEndNAV": "nav",
    "DayEndNAVDate": "nav_date",
    "NAVChange": "nav_change",
    "Return1Day": "return_1d",
    "Return1Week": "return_1w",
    "Return1Mth": "return_1m",
    "Return3Mth": "return_3m",
    "Return6Mth": "return_6m",
    "ReturnYTD": "return_ytd",
    "Return1Yr": "return_1y",
    "Return2Yr": "return_2y",
    "Return3Yr": "return_3y",
    "Return4Yr": "return_4y",
    "Return5Yr": "return_5y",
    "Return7Yr": "return_7y",
    "Return10Yr": "return_10y",
    "ReturnSinceInception": "return_since_inception",
    "CumulativeReturn3Yr": "cumulative_return_3y",
    "CumulativeReturn5Yr": "cumulative_return_5y",
    "CumulativeReturn10Yr": "cumulative_return_10y",
    "NAV52wkHigh": "nav_52wk_high",
    "NAV52wkLow": "nav_52wk_low",
    # Calendar year returns
    "Year1": "calendar_year_return_1y",
    "Year2": "calendar_year_return_2y",
    "Year3": "calendar_year_return_3y",
    "Year4": "calendar_year_return_4y",
    "Year5": "calendar_year_return_5y",
    "Year6": "calendar_year_return_6y",
    "Year7": "calendar_year_return_7y",
    "Year8": "calendar_year_return_8y",
    "Year9": "calendar_year_return_9y",
    "Year10": "calendar_year_return_10y",
}

RISK_STATS_FIELD_MAP: dict[str, str] = {
    "SecId": "mstar_id",
    "EndDate": "as_of_date",
    "SharpeRatio1Yr": "sharpe_1y",
    "SharpeRatio3Yr": "sharpe_3y",
    "SharpeRatio5Yr": "sharpe_5y",
    "Alpha3Yr": "alpha_3y",
    "Alpha5Yr": "alpha_5y",
    "Alpha10Yr": "alpha_10y",
    "Beta3Yr": "beta_3y",
    "Beta5Yr": "beta_5y",
    "Beta10Yr": "beta_10y",
    "StdDev1Yr": "std_dev_1y",
    "StdDev3Yr": "std_dev_3y",
    "StdDev5Yr": "std_dev_5y",
    "SortinoRatio1Yr": "sortino_1y",
    "SortinoRatio3Yr": "sortino_3y",
    "SortinoRatio5Yr": "sortino_5y",
    "MaxDrawdown1Yr": "max_drawdown_1y",
    "MaxDrawdown3Yr": "max_drawdown_3y",
    "MaxDrawdown5Yr": "max_drawdown_5y",
    "TreynorRatio1Yr": "treynor_1y",
    "TreynorRatio3Yr": "treynor_3y",
    "TreynorRatio5Yr": "treynor_5y",
    "TreynorRatio10Yr": "treynor_10y",
    "InformationRatio1Yr": "info_ratio_1y",
    "InformationRatio3Yr": "info_ratio_3y",
    "InformationRatio5Yr": "info_ratio_5y",
    "InformationRatio10Yr": "info_ratio_10y",
    "TrackingError1Yr": "tracking_error_1y",
    "TrackingError3Yr": "tracking_error_3y",
    "TrackingError5Yr": "tracking_error_5y",
    "TrackingError10Yr": "tracking_error_10y",
    "CaptureRatioUpside1Yr": "capture_up_1y",
    "CaptureRatioUpside3Yr": "capture_up_3y",
    "CaptureRatioUpside5Yr": "capture_up_5y",
    "CaptureRatioUpside10Yr": "capture_up_10y",
    "CaptureRatioDownside1Yr": "capture_down_1y",
    "CaptureRatioDownside3Yr": "capture_down_3y",
    "CaptureRatioDownside5Yr": "capture_down_5y",
    "Correlation1Yr": "correlation_1y",
    "Correlation3Yr": "correlation_3y",
    "Correlation5Yr": "correlation_5y",
    "Rsquared1Yr": "r_squared_1y",
    "Rsquared3Yr": "r_squared_3y",
    "Rsquared5Yr": "r_squared_5y",
    "Kurtosis1Yr": "kurtosis_1y",
    "Kurtosis3Yr": "kurtosis_3y",
    "Kurtosis5Yr": "kurtosis_5y",
    "Skewness1Yr": "skewness_1y",
    "Skewness3Yr": "skewness_3y",
    "Skewness5Yr": "skewness_5y",
    "Mean1Yr": "mean_1y",
    "Mean3Yr": "mean_3y",
    "Mean5Yr": "mean_5y",
}

RANK_FIELD_MAP: dict[str, str] = {
    "SecId": "mstar_id",
    "MonthEndDate": "as_of_date",
    "Rank1MthQuartile": "quartile_1m",
    "Rank3MthQuartile": "quartile_3m",
    "Rank6MthQuartile": "quartile_6m",
    "Rank1YrQuartile": "quartile_1y",
    "Rank2YrQuartile": "quartile_2y",
    "Rank3YrQuartile": "quartile_3y",
    "Rank4YrQuartile": "quartile_4y",
    "Rank5YrQuartile": "quartile_5y",
    "Rank7YrQuartile": "quartile_7y",
    "Rank10YrQuartile": "quartile_10y",
    "AbsRank1Mth": "abs_rank_1m",
    "AbsRank3Mth": "abs_rank_3m",
    "AbsRank6Mth": "abs_rank_6m",
    "AbsRankYTD": "abs_rank_ytd",
    "AbsRank1Yr": "abs_rank_1y",
    "AbsRank2Yr": "abs_rank_2y",
    "AbsRank3Yr": "abs_rank_3y",
    "AbsRank4Yr": "abs_rank_4y",
    "AbsRank5Yr": "abs_rank_5y",
    "AbsRank7Yr": "abs_rank_7y",
    "AbsRank10Yr": "abs_rank_10y",
    "RankYTD": "cal_year_pctile_ytd",
    "RankYr1": "cal_year_pctile_1y",
    "RankYr2": "cal_year_pctile_2y",
    "RankYr3": "cal_year_pctile_3y",
    "RankYr4": "cal_year_pctile_4y",
    "RankYr5": "cal_year_pctile_5y",
    "RankYr6": "cal_year_pctile_6y",
    "RankYr7": "cal_year_pctile_7y",
    "RankYr8": "cal_year_pctile_8y",
    "RankYr9": "cal_year_pctile_9y",
    "RankYr10": "cal_year_pctile_10y",
}

HOLDINGS_FIELD_MAP: dict[str, str] = {
    "MStarID": "mstar_id",
    "PortfolioDate": "portfolio_date",
    "NumberofHolding": "num_holdings",
    "NumberOfStockHoldings": "num_equity",
    "NumberOfBondHoldings": "num_bond",
    "EquityStyleBoxLongName": "equity_style_box",
    "FixedIncStyleBoxLongName": "bond_style_box",
    "AsOfOriginalReported": "aum",
    "AverageMarketCapMilLong": "avg_market_cap",
    "PERatioTTMLong": "pe_ratio",
    "PBRatioTTMLong": "pb_ratio",
    "PCRatioTTMLong": "pc_ratio",
    "PSRatioTTMLong": "ps_ratio",
    "ROETTMLong": "roe_ttm",
    "ROATTMLong": "roa_ttm",
    "NetMarginTrailingLong": "net_margin_ttm",
    "YieldtoMaturityLong": "ytm",
    "AverageEffMaturity": "avg_eff_maturity",
    "ModifiedDurationLong": "modified_duration",
    "AverageCreditQualityName": "avg_credit_quality",
    "ProspectiveDividendYield": "prospective_div_yield",
    "AnnualReportTurnoverRatio": "turnover_ratio",
    "EstFundLevelNetFlow": "est_fund_net_flow",
}

# Aliases for fields that appear under different names across APIs.
# These are merged into the primary map at runtime in the parser.
HOLDINGS_FIELD_ALIASES: dict[str, str] = {
    "MostCurrentPortfolioDate": "portfolio_date",
}

HOLDING_DETAIL_FIELD_MAP: dict[str, str] = {
    "HoldingDetail_Name": "holding_name",
    "HoldingDetail_ISIN": "isin",
    "HoldingDetail_HoldingType": "holding_type",
    "HoldingDetail_Weighting": "weighting_pct",
    "HoldingDetail_NumberOfShare": "num_shares",
    "HoldingDetail_MarketValue": "market_value",
    "HoldingDetail_GlobalSector": "global_sector",
    "HoldingDetail_Country": "country",
    "HoldingDetail_Currency": "currency",
    "HoldingDetail_Coupon": "coupon",
    "HoldingDetail_MaturityDate": "maturity_date",
    "HoldingDetail_IndianCreditQualityClassification": "credit_quality",
    "HoldingDetail_ShareChange": "share_change",
}

# Nested XML element names → DB columns for <HoldingDetail> child elements.
# The bulk Holdings Detail API returns holdings as nested XML, not pipe-delimited.
HOLDING_DETAIL_NESTED_MAP: dict[str, str] = {
    "Name": "holding_name",
    "ISIN": "isin",
    "HoldingType": "holding_type",
    "Weighting": "weighting_pct",
    "NumberOfShare": "num_shares",
    "MarketValue": "market_value",
    "GlobalSector": "global_sector",
    "Country": "country",
    "Currency": "currency",
    "Coupon": "coupon",
    "MaturityDate": "maturity_date",
    "IndianCreditQualityClassification": "credit_quality",
    "ShareChange": "share_change",
}

SECTOR_EXPOSURE_MAP: dict[str, str] = {
    "EquitySectorBasicMaterialsNet": "Basic Materials",
    "EquitySectorCommunicationServicesNet": "Communication Services",
    "EquitySectorConsumerCyclicalNet": "Consumer Cyclical",
    "EquitySectorConsumerDefensiveNet": "Consumer Defensive",
    "EquitySectorEnergyNet": "Energy",
    "EquitySectorFinancialServicesNet": "Financial Services",
    "EquitySectorHealthcareNet": "Healthcare",
    "EquitySectorIndustrialsNet": "Industrials",
    "EquitySectorRealEstateNet": "Real Estate",
    "EquitySectorTechnologyNet": "Technology",
    "EquitySectorUtilitiesNet": "Utilities",
}

ASSET_ALLOCATION_MAP: dict[str, str] = {
    "AssetAllocEquityNet": "equity_net",
    "AssetAllocBondNet": "bond_net",
    "AssetAllocCashNet": "cash_net",
    "AssetAllocOtherNet": "other_net",
    "IndiaLargeCapPct": "india_large_cap_pct",
    "IndiaMidCapPct": "india_mid_cap_pct",
    "IndiaSmallCapPct": "india_small_cap_pct",
}

CREDIT_QUALITY_MAP: dict[str, str] = {
    "CreditQualAAA": "aaa_pct",
    "CreditQualAA": "aa_pct",
    "CreditQualA": "a_pct",
    "CreditQualBBB": "bbb_pct",
    "CreditQualBB": "bb_pct",
    "CreditQualB": "b_pct",
    "CreditQualBelowB": "below_b_pct",
    "CreditQualNotRated": "not_rated_pct",
}

CATEGORY_RETURNS_FIELD_MAP: dict[str, str] = {
    "Categorycode": "category_code",
    "CategoryEndDate": "as_of_date",
    "CategoryReturn2Yr": "cat_return_2y",
    "CategoryReturn3Yr": "cat_return_3y",
    "CategoryReturn4Yr": "cat_return_4y",
    "CategoryReturn5Yr": "cat_return_5y",
    "CategoryReturn7Yr": "cat_return_7y",
    "CategoryReturn10Yr": "cat_return_10y",
    "CategoryCumulativeReturn2Yr": "cat_cumulative_2y",
    "CategoryCumulativeReturn3Yr": "cat_cumulative_3y",
    "CategoryCumulativeReturn4Yr": "cat_cumulative_4y",
    "CategoryCumulativeReturn5Yr": "cat_cumulative_5y",
    "CategoryCumulativeReturn7Yr": "cat_cumulative_7y",
    "CategoryCumulativeReturn10Yr": "cat_cumulative_10y",
}

# Map of feed type → (field_map, ORM model class name, key field in DB)
FEED_TYPE_CONFIG: dict[str, dict] = {
    "master": {
        "field_map": "MASTER_FIELD_MAP",
        "model": "FundMaster",
        "key_field": "mstar_id",
    },
    "nav": {
        "field_map": "NAV_FIELD_MAP",
        "model": "NavDaily",
        "key_field": "mstar_id",
    },
    "risk_stats": {
        "field_map": "RISK_STATS_FIELD_MAP",
        "model": "RiskStatsMonthly",
        "key_field": "mstar_id",
    },
    "ranks": {
        "field_map": "RANK_FIELD_MAP",
        "model": "RankMonthly",
        "key_field": "mstar_id",
    },
    "holdings": {
        "field_map": "HOLDINGS_FIELD_MAP",
        "model": "FundHoldingsSnapshot",
        "key_field": "mstar_id",
    },
    "category_returns": {
        "field_map": "CATEGORY_RETURNS_FIELD_MAP",
        "model": "CategoryReturnsDaily",
        "key_field": "category_code",
    },
}
