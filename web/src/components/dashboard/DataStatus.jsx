import { useState, useEffect } from 'react';
import SkeletonLoader from '../shared/SkeletonLoader';
import { fetchRegimeActions } from '../../lib/api';
import { cachedFetch } from '../../lib/cache';

// ─── Regime-Aware Actions ───

const REGIME_ACTIONS = {
  'RISK-ON': [
    {
      icon: '\u25B2',
      iconColor: 'text-emerald-600',
      title: 'Increase Equity SIP',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      titleColor: 'text-emerald-800',
      textColor: 'text-emerald-700',
      body: 'Risk-On regime + improving breadth. SIPs started now benefit from momentum. Consider stepping up by 20%.',
    },
    {
      icon: '\u25CF',
      iconColor: 'text-sky-600',
      title: 'Rotate into Leading Sectors',
      bg: 'bg-sky-50',
      border: 'border-sky-100',
      titleColor: 'text-sky-800',
      textColor: 'text-sky-700',
      body: 'Leading sectors show 3M momentum. Funds overweight in these sectors benefit from rotation tailwinds.',
    },
    {
      icon: '\u25BC',
      iconColor: 'text-amber-600',
      title: 'Review Weakening Sectors',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700',
      body: 'Sectors in Weakening quadrant losing momentum. Funds with heavy exposure flagged. Review allocation.',
    },
  ],
  BULL: [
    {
      icon: '\u25B2',
      iconColor: 'text-emerald-600',
      title: 'Stay Invested',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      titleColor: 'text-emerald-800',
      textColor: 'text-emerald-700',
      body: 'Bull regime continues. Stay invested with existing SIPs. Avoid timing the market.',
    },
  ],
  CORRECTION: [
    {
      icon: '\u25BC',
      iconColor: 'text-amber-600',
      title: 'Accumulate on Dips',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700',
      body: 'Correction regime \u2014 use SIP top-ups on dips. Focus on Consistent Alpha and Low-Risk Leader buckets.',
    },
  ],
  BEAR: [
    {
      icon: '\u25BC',
      iconColor: 'text-red-600',
      title: 'Defensive Posture',
      bg: 'bg-red-50',
      border: 'border-red-100',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
      body: 'Bear regime \u2014 reduce risk. Shift to Fortress Funds and low-volatility strategies.',
    },
  ],
  NEUTRAL: [
    {
      icon: '\u25CF',
      iconColor: 'text-blue-600',
      title: 'Continue SIPs',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
      body: 'Neutral regime \u2014 continue systematic investment. No major allocation changes needed.',
    },
  ],
};

function RegimeActions({ regime, leading, weakening }) {
  const regimeKey = (regime?.market_regime || regime?.regime || 'NEUTRAL').toUpperCase().replace(/\s+/g, '-');
  let actions = REGIME_ACTIONS[regimeKey] || REGIME_ACTIONS.NEUTRAL;

  // Inject sector names if available
  if (leading && leading.length > 0 && actions.length >= 2) {
    const sectorNames = leading.slice(0, 2).map((s) => typeof s === 'string' ? s : s.sector || s.name || '').filter(Boolean);
    if (sectorNames.length > 0) {
      actions = actions.map((a, i) => {
        if (i === 1 && a.title.includes('Sector')) {
          return {
            ...a,
            body: `${sectorNames.join(' & ')} in Leading quadrant. Funds with overweight in these sectors have 3M momentum.`,
          };
        }
        return a;
      });
    }
  }

  if (weakening && weakening.length > 0 && actions.length >= 3) {
    const sectorNames = weakening.slice(0, 2).map((s) => typeof s === 'string' ? s : s.sector || s.name || '').filter(Boolean);
    if (sectorNames.length > 0) {
      actions = actions.map((a, i) => {
        if (i === 2 && a.title.includes('Weakening')) {
          return {
            ...a,
            body: `${sectorNames.join(' & ')} weakening. Funds with >25% exposure in these sectors flagged. Review portfolio allocation.`,
          };
        }
        return a;
      });
    }
  }

  const [aiActions, setAiActions] = useState(null);

  useEffect(() => {
    cachedFetch('regime-actions', fetchRegimeActions, 3600)
      .then((res) => {
        const data = res?.data?.actions;
        if (Array.isArray(data) && data.length > 0) setAiActions(data);
      })
      .catch(() => {});
  }, []);

  const displayActions = aiActions
    ? aiActions.map((a) => {
        const type = a.action_type || a.type || 'neutral';
        const styles = {
          positive: { bg: 'bg-emerald-50', border: 'border-emerald-100', iconColor: 'text-emerald-600', icon: '\u25B2', titleColor: 'text-emerald-800', textColor: 'text-emerald-700' },
          warning: { bg: 'bg-amber-50', border: 'border-amber-100', iconColor: 'text-amber-600', icon: '\u26A0', titleColor: 'text-amber-800', textColor: 'text-amber-700' },
          neutral: { bg: 'bg-sky-50', border: 'border-sky-100', iconColor: 'text-sky-600', icon: '\u25CF', titleColor: 'text-sky-800', textColor: 'text-sky-700' },
        };
        const s = styles[type] || styles.neutral;
        return { ...s, title: a.title, body: a.description };
      })
    : actions;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="section-title">Regime-Aware Actions</p>
        {aiActions && <span className="text-[9px] text-teal-500">{'\u2726'} AI-powered</span>}
      </div>
      <div className="space-y-3">
        {displayActions.map((action, idx) => (
          <div key={idx} className={`p-3 rounded-lg ${action.bg} border ${action.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm ${action.iconColor}`}>{action.icon}</span>
              <p className={`text-xs font-semibold ${action.titleColor}`}>{action.title}</p>
            </div>
            <p className={`text-[11px] ${action.textColor} leading-relaxed`}>
              {action.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Data Freshness ───

function getStatusConfig(dateStr) {
  if (!dateStr) return { dot: 'bg-red-500', label: 'No data' };
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (ageDays < 1) return { dot: 'bg-emerald-500', label: 'Fresh' };
  if (ageDays < 3) return { dot: 'bg-emerald-500', label: 'Fresh' };
  if (ageDays < 30) return { dot: 'bg-amber-500', label: 'Monthly' };
  return { dot: 'bg-red-500', label: 'Stale' };
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function FreshnessRow({ label, dateStr, statusLabel }) {
  const config = getStatusConfig(dateStr);
  const displayLabel = statusLabel || config.label;
  const labelColor = displayLabel === 'Fresh' || displayLabel === 'Live'
    ? 'text-emerald-600'
    : displayLabel === 'Monthly'
      ? 'text-amber-600'
      : displayLabel === 'Stale' || displayLabel === 'No data'
        ? 'text-red-600'
        : 'text-slate-500';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`freshness-dot ${config.dot}`} />
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-xs font-medium text-slate-700 tabular-nums">
          {formatDate(dateStr)}
        </span>
        <span className={`text-[10px] ml-1 ${labelColor}`}>
          {displayLabel}
        </span>
      </div>
    </div>
  );
}

function DataFreshness({ freshness, onRefreshNav, onRecomputeLens, refreshing, recomputing }) {
  if (!freshness) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonLoader className="h-36 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="section-title mb-3">Data Freshness</p>
      <div className="space-y-2.5">
        <FreshnessRow label="NAV Data" dateStr={freshness.nav_last_date} />
        <FreshnessRow label="Lens Scores" dateStr={freshness.lens_computed_at} />
        <FreshnessRow
          label="Holdings"
          dateStr={freshness.holdings_last_date || freshness.risk_stats_last_date}
          statusLabel="Monthly"
        />
        <FreshnessRow label="Risk Stats" dateStr={freshness.risk_stats_last_date} statusLabel="Monthly" />
        <FreshnessRow label="MarketPulse" dateStr={freshness.market_pulse_at} statusLabel="Live" />
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
        <button
          type="button"
          className="flex-1 py-2 text-[11px] font-medium text-teal-700 bg-teal-50 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-50"
          onClick={onRefreshNav}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh NAV'}
        </button>
        <button
          type="button"
          className="flex-1 py-2 text-[11px] font-medium text-slate-600 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
          onClick={onRecomputeLens}
          disabled={recomputing}
        >
          {recomputing ? 'Computing...' : 'Recompute Lens'}
        </button>
      </div>
    </div>
  );
}

// ─── Combined Export ───

export default function DataStatus({
  regime,
  freshness,
  onRefreshNav,
  onRecomputeLens,
  refreshing,
  recomputing,
  leadingSectors,
  weakeningSectors,
}) {
  return (
    <div className="space-y-4">
      <RegimeActions
        regime={regime}
        leading={leadingSectors}
        weakening={weakeningSectors}
      />
      <DataFreshness
        freshness={freshness}
        onRefreshNav={onRefreshNav}
        onRecomputeLens={onRecomputeLens}
        refreshing={refreshing}
        recomputing={recomputing}
      />
    </div>
  );
}
