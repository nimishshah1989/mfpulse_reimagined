import { useState, useEffect } from 'react';
import SectionTitle from '../components/shared/SectionTitle';
import SourceCards from '../components/methodology/SourceCards';
import CollapsibleSection from '../components/methodology/CollapsibleSection';
import DataMapTable from '../components/methodology/DataMapTable';
import UpdateTimeline from '../components/methodology/UpdateTimeline';
import LensScoringTable from '../components/methodology/LensScoringTable';
import { fetchDataFreshness } from '../lib/api';
import { cachedFetch } from '../lib/cache';

/* ────────── Data Map Definitions ────────── */
const STD_COLS = [
  { key: 'field', label: 'Field' },
  { key: 'source', label: 'Source API' },
  { key: 'ms_field', label: 'Morningstar Field' },
  { key: 'db_column', label: 'DB Column' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'coverage', label: 'Coverage' },
];

const FUND_MASTER_ROWS = [
  { field: 'Fund Name', source: 'Identifier Data', ms_field: 'LegalName', db_column: 'fund_name', frequency: 'Weekly', coverage: '100%' },
  { field: 'AMC', source: 'Identifier Data', ms_field: 'ProviderCompany', db_column: 'amc_name', frequency: 'Weekly', coverage: '100%' },
  { field: 'ISIN', source: 'Identifier Data', ms_field: 'ISIN', db_column: 'isin', frequency: 'Weekly', coverage: '100%' },
  { field: 'AMFI Code', source: 'Identifier Data', ms_field: 'CustomFundCode1', db_column: 'amfi_code', frequency: 'Weekly', coverage: '98%' },
  { field: 'Category', source: 'Category Data', ms_field: 'FundLevelCategoryName', db_column: 'category_name', frequency: 'Weekly', coverage: '100%' },
  { field: 'Expense Ratio', source: 'Additional Data', ms_field: 'OngoingCharge', db_column: 'expense_ratio', frequency: 'Weekly', coverage: '95%' },
  { field: 'Benchmark', source: 'Additional Data', ms_field: 'BenchmarkName', db_column: 'benchmark', frequency: 'Weekly', coverage: '92%' },
  { field: 'Inception Date', source: 'Risk Stats', ms_field: 'InceptionDate', db_column: 'inception_date', frequency: 'Monthly', coverage: '99%' },
  { field: 'Fund Manager', source: 'Risk Stats', ms_field: 'ManagerName', db_column: 'manager_name', frequency: 'Monthly', coverage: '95%' },
];

const NAV_RETURNS_ROWS = [
  { field: 'NAV', source: 'Nav Data API', ms_field: 'DayEndPrice', db_column: 'nav', frequency: 'Daily', coverage: '100%' },
  { field: 'NAV (AMFI backup)', source: 'amfiindia.com', ms_field: 'Net Asset Value', db_column: 'nav', frequency: 'Daily', coverage: '100%' },
  { field: 'Return 1Y', source: 'Return Data', ms_field: 'ReturnM12', db_column: 'return_1y', frequency: 'Daily', coverage: '98%' },
  { field: 'Return 3Y', source: 'Return Data', ms_field: 'ReturnM36', db_column: 'return_3y', frequency: 'Daily', coverage: '95%' },
  { field: 'Return 5Y', source: 'Return Data', ms_field: 'ReturnM60', db_column: 'return_5y', frequency: 'Daily', coverage: '88%' },
  { field: 'Return YTD', source: 'Risk Stats', ms_field: 'ReturnYTD', db_column: 'return_ytd', frequency: 'Monthly', coverage: '97%' },
  { field: 'NAV 52W High', source: 'Nav Data', ms_field: 'HighPrice52Week', db_column: 'nav_52wk_high', frequency: 'Daily', coverage: '96%' },
  { field: 'NAV 52W Low', source: 'Nav Data', ms_field: 'LowPrice52Week', db_column: 'nav_52wk_low', frequency: 'Daily', coverage: '96%' },
];

const RISK_STATS_ROWS = [
  { field: 'Sharpe Ratio', source: 'Risk Stats', ms_field: 'SharpeM36', db_column: 'sharpe', frequency: 'Monthly', coverage: '92%' },
  { field: 'Alpha', source: 'Risk Stats', ms_field: 'AlphaM36', db_column: 'alpha', frequency: 'Monthly', coverage: '92%' },
  { field: 'Beta', source: 'Risk Stats', ms_field: 'BetaM36', db_column: 'beta', frequency: 'Monthly', coverage: '92%' },
  { field: 'Std Deviation', source: 'Risk Stats', ms_field: 'StandardDeviationM36', db_column: 'std_dev', frequency: 'Monthly', coverage: '92%' },
  { field: 'Max Drawdown', source: 'Risk Stats', ms_field: 'MaxDrawdown', db_column: 'max_drawdown', frequency: 'Monthly', coverage: '90%' },
  { field: 'Sortino', source: 'Risk Stats', ms_field: 'SortinoM36', db_column: 'sortino', frequency: 'Monthly', coverage: '90%' },
  { field: 'Up Capture', source: 'Risk Stats', ms_field: 'UpCaptureRatioM36', db_column: 'up_capture', frequency: 'Monthly', coverage: '88%' },
  { field: 'Down Capture', source: 'Risk Stats', ms_field: 'DownCaptureRatioM36', db_column: 'down_capture', frequency: 'Monthly', coverage: '88%' },
  { field: 'R-Squared', source: 'Risk Stats', ms_field: 'RSquaredM36', db_column: 'r_squared', frequency: 'Monthly', coverage: '88%' },
  { field: 'Info Ratio', source: 'Risk Stats', ms_field: 'InformationRatioM36', db_column: 'info_ratio', frequency: 'Monthly', coverage: '85%' },
  { field: 'Tracking Error', source: 'Risk Stats', ms_field: 'TrackingErrorM36', db_column: 'tracking_error', frequency: 'Monthly', coverage: '85%' },
  { field: 'Treynor', source: 'Risk Stats', ms_field: 'TreynorRatioM36', db_column: 'treynor', frequency: 'Monthly', coverage: '85%' },
];

const RANKINGS_ROWS = [
  { field: 'Quartile 1M', source: 'Rank Data', ms_field: 'PerformanceQuartileM1', db_column: 'quartile_1m', frequency: 'Monthly', coverage: '95%' },
  { field: 'Quartile 3M', source: 'Rank Data', ms_field: 'PerformanceQuartileM3', db_column: 'quartile_3m', frequency: 'Monthly', coverage: '95%' },
  { field: 'Quartile 1Y', source: 'Rank Data', ms_field: 'PerformanceQuartileM12', db_column: 'quartile_1y', frequency: 'Monthly', coverage: '95%' },
  { field: 'Quartile 3Y', source: 'Rank Data', ms_field: 'PerformanceQuartileM36', db_column: 'quartile_3y', frequency: 'Monthly', coverage: '90%' },
  { field: 'Quartile 5Y', source: 'Rank Data', ms_field: 'PerformanceQuartileM60', db_column: 'quartile_5y', frequency: 'Monthly', coverage: '82%' },
  { field: 'Category Rank %ile 1Y', source: 'Rank Data', ms_field: 'CategoryRankPercentileM12', db_column: 'rank_pctile_1y', frequency: 'Monthly', coverage: '95%' },
];

const HOLDINGS_ROWS = [
  { field: 'Security Name', source: 'Holdings API', ms_field: 'SecurityName', db_column: 'security_name', frequency: 'Monthly', coverage: '90%' },
  { field: 'Weight %', source: 'Holdings API', ms_field: 'WeightingPct', db_column: 'weight_pct', frequency: 'Monthly', coverage: '90%' },
  { field: 'Sector', source: 'Holdings API', ms_field: 'GlobalSectorName', db_column: 'sector_name', frequency: 'Monthly', coverage: '88%' },
  { field: 'Sector Exposure %', source: 'Holdings API', ms_field: 'FundSectorPct', db_column: 'sector_pct', frequency: 'Monthly', coverage: '88%' },
  { field: 'Asset Allocation', source: 'Holdings API', ms_field: 'AssetAllocationPct', db_column: 'asset_pct', frequency: 'Monthly', coverage: '92%' },
];

/* ────────── Freshness Badge ────────── */
function FreshnessBadge({ item }) {
  if (!item) return null;
  const statusColor = {
    fresh: 'bg-emerald-50 text-emerald-700',
    stale: 'bg-amber-50 text-amber-700',
    critical: 'bg-red-50 text-red-700',
  };
  const status = item.status || 'fresh';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[status] || statusColor.fresh}`}>
      {status.toUpperCase()} {'\u2014'} Last: {item.last_updated || 'Unknown'}
    </span>
  );
}

/* ────────── Page ────────── */
export default function MethodologyPage() {
  const [freshness, setFreshness] = useState(null);

  useEffect(() => {
    cachedFetch('methodology-freshness', fetchDataFreshness, 300)
      .then((res) => setFreshness(res.data || res))
      .catch(() => {});
  }, []);

  const getFreshness = (domain) => {
    if (!freshness || !Array.isArray(freshness)) return null;
    return freshness.find((f) => f.domain === domain || f.table === domain);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl border border-teal-100 p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">
          Data Methodology & Sources
        </h1>
        <p className="text-[13px] text-slate-500 leading-relaxed max-w-2xl">
          Every number in MF Pulse is sourced from Morningstar API Center and AMFI.
          Here is exactly where each data point comes from, how it maps to the database,
          and when it gets updated.
        </p>
      </div>

      {/* Source cards */}
      <div>
        <SectionTitle tip="Three data providers feed into MF Pulse">
          Data Sources
        </SectionTitle>
        <SourceCards />
      </div>

      {/* Data Maps */}
      <div className="space-y-3">
        <SectionTitle tip="Click each section to expand the field-level mapping table">
          Data Maps
        </SectionTitle>

        <CollapsibleSection
          title="Fund Master"
          subtitle="Morningstar APIs 1-3 -- Identifier, Additional, Category Data"
          defaultOpen
        >
          <div className="flex items-center gap-2 mb-3">
            <FreshnessBadge item={getFreshness('fund_master')} />
          </div>
          <DataMapTable columns={STD_COLS} rows={FUND_MASTER_ROWS} />
        </CollapsibleSection>

        <CollapsibleSection
          title="NAV & Returns"
          subtitle="Morningstar APIs 4-5 + AMFI daily feed"
        >
          <div className="flex items-center gap-2 mb-3">
            <FreshnessBadge item={getFreshness('nav_daily')} />
          </div>
          <DataMapTable columns={STD_COLS} rows={NAV_RETURNS_ROWS} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Risk Statistics"
          subtitle="Morningstar API 6 -- 12 risk metrics, 3Y period"
        >
          <div className="flex items-center gap-2 mb-3">
            <FreshnessBadge item={getFreshness('risk_stats_monthly')} />
          </div>
          <DataMapTable columns={STD_COLS} rows={RISK_STATS_ROWS} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Rankings"
          subtitle="Morningstar API 7 -- Quartile ranks and category percentiles"
        >
          <div className="flex items-center gap-2 mb-3">
            <FreshnessBadge item={getFreshness('rank_monthly')} />
          </div>
          <DataMapTable columns={STD_COLS} rows={RANKINGS_ROWS} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Holdings & Sectors"
          subtitle="Monthly holdings snapshot with sector and asset allocation"
        >
          <div className="flex items-center gap-2 mb-3">
            <FreshnessBadge item={getFreshness('fund_holdings_snapshot')} />
          </div>
          <DataMapTable columns={STD_COLS} rows={HOLDINGS_ROWS} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Lens Scoring (Internal Computation)"
          subtitle="Six independent lenses -- percentile rank within SEBI category"
        >
          <LensScoringTable />
        </CollapsibleSection>
      </div>

      {/* Update Schedule */}
      <div>
        <SectionTitle tip="When each data domain refreshes">
          Update Schedule
        </SectionTitle>
        <UpdateTimeline />
      </div>

      {/* Data Quality note */}
      <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Data Quality Notes</h3>
        <ul className="space-y-1.5 text-[12px] text-slate-500 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            Coverage percentages are based on the active fund universe (~2,500 open-ended schemes).
            Closed-end and FoF schemes may have lower coverage for certain fields.
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            Risk statistics require 3 years of NAV history. Funds with shorter track records
            will not have risk scores or lens classifications.
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            Multi-API nullable columns (nav, legal_name, category_name) exist because different
            APIs provide different column subsets. The batch upsert groups records by key signature.
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            All lens scores are recomputed after each risk stats ingestion. Historical lens
            scores are preserved for trend analysis.
          </li>
        </ul>
      </div>
    </div>
  );
}
