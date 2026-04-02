import { formatAUM, formatCount } from '../../lib/format';
import InfoIcon from '../shared/InfoIcon';

/**
 * PortfolioMetrics — shows fund portfolio-level metrics from holdings snapshot.
 * P/E, P/B, avg market cap, turnover, style box.
 *
 * Props:
 *   mstarId      string
 *   holdingsData object  — holdings snapshot data (from asset-allocation or dedicated endpoint)
 */

const EQUITY_METRICS = [
  { key: 'pe_ratio', label: 'P/E Ratio', format: (v) => Number(v).toFixed(1), tip: 'Price-to-Earnings. Lower = cheaper. Compare within same category.' },
  { key: 'pb_ratio', label: 'P/B Ratio', format: (v) => Number(v).toFixed(1), tip: 'Price-to-Book. Lower = more value-oriented. >4 is expensive for most categories.' },
  { key: 'ps_ratio', label: 'P/S Ratio', format: (v) => Number(v).toFixed(1), tip: 'Price-to-Sales. Useful for growth companies with low/no earnings.' },
  { key: 'pc_ratio', label: 'P/CF Ratio', format: (v) => Number(v).toFixed(1), tip: 'Price-to-Cash-Flow. Harder to manipulate than P/E. Lower = better value.' },
  { key: 'avg_market_cap', label: 'Avg Market Cap', format: (v) => formatAUM(Number(v) / 10000000), tip: 'Weighted average market cap of holdings. Shows if fund leans large/mid/small cap.' },
  { key: 'roe_ttm', label: 'ROE (TTM)', format: (v) => `${Number(v).toFixed(1)}%`, tip: 'Return on Equity — how efficiently the portfolio companies use shareholder money. Higher = better.' },
  { key: 'roa_ttm', label: 'ROA (TTM)', format: (v) => `${Number(v).toFixed(1)}%`, tip: 'Return on Assets — overall efficiency. Especially meaningful for banks/financials.' },
  { key: 'net_margin_ttm', label: 'Net Margin', format: (v) => `${Number(v).toFixed(1)}%`, tip: 'Average net profit margin of portfolio companies. Higher = more profitable businesses.' },
];

const BOND_METRICS = [
  { key: 'ytm', label: 'Yield to Maturity', format: (v) => `${Number(v).toFixed(2)}%` },
  { key: 'modified_duration', label: 'Mod. Duration', format: (v) => `${Number(v).toFixed(2)} yrs` },
  { key: 'avg_eff_maturity', label: 'Avg Maturity', format: (v) => `${Number(v).toFixed(2)} yrs` },
  { key: 'avg_credit_quality', label: 'Avg Credit Quality', format: (v) => v },
];

const COMMON_METRICS = [
  { key: 'equity_style_box', label: 'Style Box', format: (v) => v },
  { key: 'bond_style_box', label: 'FI Style Box', format: (v) => v },
  { key: 'num_holdings', label: 'Holdings', format: (v) => formatCount(v) },
  { key: 'turnover_ratio', label: 'Turnover', format: (v) => `${Number(v).toFixed(0)}%` },
  { key: 'prospective_div_yield', label: 'Div Yield', format: (v) => `${Number(v).toFixed(2)}%` },
  { key: 'est_fund_net_flow', label: 'Est. Net Flow', format: (v) => formatAUM(Number(v) / 10000000) },
];

const METRICS = [...EQUITY_METRICS, ...BOND_METRICS, ...COMMON_METRICS];

export default function PortfolioMetrics({ holdingsData }) {
  if (!holdingsData) return null;

  const available = METRICS.filter((m) => holdingsData[m.key] != null);
  if (available.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {available.map((m) => (
        <div key={m.key} className="p-2.5 bg-slate-50 rounded-lg">
          <p className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-0.5">{m.label} {m.tip && <InfoIcon tip={m.tip} />}</p>
          <p className="text-sm font-bold font-mono tabular-nums text-slate-800">
            {m.format(holdingsData[m.key])}
          </p>
        </div>
      ))}
    </div>
  );
}
