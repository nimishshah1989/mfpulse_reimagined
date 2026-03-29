import { useState, useEffect } from 'react';
import { formatAUM } from '../../lib/format';

/**
 * PortfolioMetrics — shows fund portfolio-level metrics from holdings snapshot.
 * P/E, P/B, avg market cap, turnover, style box.
 *
 * Props:
 *   mstarId      string
 *   holdingsData object  — holdings snapshot data (from asset-allocation or dedicated endpoint)
 */

const EQUITY_METRICS = [
  { key: 'pe_ratio', label: 'P/E Ratio', format: (v) => Number(v).toFixed(1) },
  { key: 'pb_ratio', label: 'P/B Ratio', format: (v) => Number(v).toFixed(1) },
  { key: 'ps_ratio', label: 'P/S Ratio', format: (v) => Number(v).toFixed(1) },
  { key: 'pc_ratio', label: 'P/CF Ratio', format: (v) => Number(v).toFixed(1) },
  { key: 'avg_market_cap', label: 'Avg Market Cap', format: (v) => formatAUM(Number(v) / 10000000) },
  { key: 'roe_ttm', label: 'ROE (TTM)', format: (v) => `${Number(v).toFixed(1)}%` },
  { key: 'roa_ttm', label: 'ROA (TTM)', format: (v) => `${Number(v).toFixed(1)}%` },
  { key: 'net_margin_ttm', label: 'Net Margin', format: (v) => `${Number(v).toFixed(1)}%` },
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
  { key: 'num_holdings', label: 'Holdings', format: (v) => Number(v).toLocaleString('en-IN') },
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
          <p className="text-[10px] text-slate-400 mb-0.5">{m.label}</p>
          <p className="text-sm font-bold font-mono tabular-nums text-slate-800">
            {m.format(holdingsData[m.key])}
          </p>
        </div>
      ))}
    </div>
  );
}
