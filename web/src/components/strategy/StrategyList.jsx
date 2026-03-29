import { useMemo, useState } from 'react';
import InfoIcon from '../shared/InfoIcon';
import SectionTitle from '../shared/SectionTitle';
import SkeletonLoader from '../shared/SkeletonLoader';
import EmptyState from '../shared/EmptyState';
import { formatINR, formatPct } from '../../lib/format';

const TEMPLATES = [
  {
    id: 'conservative',
    emoji: '\uD83D\uDEE1\uFE0F',
    name: 'Conservative Growth',
    description: 'Low-risk large caps with consistent track records. Focus on capital preservation with steady returns.',
    tags: [
      { label: 'Low Risk', bg: 'bg-blue-50', text: 'text-blue-600' },
      { label: '12-14% CAGR', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    ],
    query: 'Large cap funds with low risk scores, consistent returns, and expense ratio below 1%',
  },
  {
    id: 'alpha',
    emoji: '\uD83C\uDFAF',
    name: 'Alpha Hunters',
    description: 'Funds with proven manager skill. High alpha, positive info ratio, across cap sizes.',
    tags: [
      { label: 'Alpha Focus', bg: 'bg-teal-50', text: 'text-teal-600' },
      { label: '16-20% CAGR', bg: 'bg-amber-50', text: 'text-amber-600' },
    ],
    query: 'Funds with alpha score above 75 and positive information ratio across all cap sizes',
  },
  {
    id: 'sector',
    emoji: '\uD83D\uDD04',
    name: 'Sector Rotation',
    description: 'Leverage MarketPulse sector signals to rotate into leading sectors and out of lagging ones.',
    tags: [
      { label: 'Signal-Driven', bg: 'bg-amber-50', text: 'text-amber-600' },
      { label: 'Dynamic', bg: 'bg-purple-50', text: 'text-purple-600' },
    ],
    query: 'Top 3 leading sectors from MarketPulse compass, pick best fund per sector',
  },
  {
    id: 'allweather',
    emoji: '\u26A1',
    name: 'All-Weather',
    description: 'Resilient funds that perform across market regimes. Fortress resilience + rock-solid consistency.',
    tags: [
      { label: 'Resilient', bg: 'bg-purple-50', text: 'text-purple-600' },
      { label: 'All Regimes', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    ],
    query: 'Funds with fortress resilience and rock-solid consistency across all market regimes',
  },
];

const STATUS_STYLES = {
  LIVE: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  BACKTESTING: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
};

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-600' },
  { bg: 'bg-teal-100', text: 'text-teal-600' },
  { bg: 'bg-amber-100', text: 'text-amber-600' },
  { bg: 'bg-purple-100', text: 'text-purple-600' },
  { bg: 'bg-red-100', text: 'text-red-600' },
  { bg: 'bg-indigo-100', text: 'text-indigo-600' },
];

function getInitials(name) {
  if (!name) return '??';
  const words = name.split(' ').filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatShortDate(dateStr) {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function TemplateCard({ template: t, onLoadTemplate }) {
  const [clicked, setClicked] = useState(false);
  return (
    <div
      onClick={() => { setClicked(true); onLoadTemplate(t); }}
      className={`bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-teal-300 hover:shadow-md transition-all group ${clicked ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-lg">
          {clicked ? (
            <svg className="animate-spin w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : t.emoji}
        </div>
        <span className="text-sm font-semibold text-slate-700">{t.name}</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed mb-3">{t.description}</p>
      <div className="flex items-center gap-2">
        {t.tags.map((tag, i) => (
          <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${tag.bg} ${tag.text}`}>
            {tag.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function StrategyList({
  strategies,
  loading,
  error,
  onNewStrategy,
  onSelectStrategy,
  onLoadTemplate,
}) {
  const totalAUM = useMemo(() => {
    return strategies.reduce((sum, s) => sum + (s.total_aum || 0), 0);
  }, [strategies]);

  const totalXirr = useMemo(() => {
    const live = strategies.filter((s) => s.xirr != null);
    if (live.length === 0) return null;
    return live.reduce((sum, s) => sum + s.xirr, 0) / live.length;
  }, [strategies]);

  return (
    <div className="space-y-5 animate-in">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Strategy Builder</h1>
            <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
              Design model portfolios using natural language. Tell us what you want &mdash; we'll find the best funds, configure investments, and track performance. Think of it as your AI-powered fund manager assistant.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={onNewStrategy}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" />
                </svg>
                New Strategy
              </button>
              <span className="text-xs text-slate-500">or use a template below</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">Total AUM Across Strategies</p>
            <p className="text-3xl font-bold tabular-nums">
              {totalAUM > 0 ? formatINR(totalAUM, 0) : '\u2014'}
            </p>
            {totalXirr != null && (
              <p className={`text-xs mt-1 ${totalXirr >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalXirr >= 0 ? '\u2191' : '\u2193'} {Math.abs(totalXirr).toFixed(1)}% overall XIRR
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Start Templates */}
      <div>
        <SectionTitle
          tip="Pre-built strategy templates based on common investment approaches. Click to start with a template \u2014 you can customize everything after."
        >
          Quick Start Templates
        </SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} onLoadTemplate={onLoadTemplate} />
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonLoader key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && strategies.length === 0 && !error && (
        <EmptyState
          message="No strategies yet. Create your first model portfolio."
          action="Create Strategy"
          onAction={onNewStrategy}
        />
      )}

      {/* Strategy Cards */}
      {!loading && strategies.length > 0 && (
        <div>
          <SectionTitle
            right={
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{strategies.length} strateg{strategies.length === 1 ? 'y' : 'ies'}</span>
              </div>
            }
          >
            Your Strategies
          </SectionTitle>
          <div className="space-y-3">
            {strategies.map((s) => {
              const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.DRAFT;
              const isDraft = s.status === 'DRAFT';
              const fundList = s.funds || [];

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectStrategy(s)}
                  className={`bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:border-teal-200 hover:shadow-md transition-all ${isDraft ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-slate-800">{s.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                          {s.status}
                        </span>
                      </div>
                      {s.description && (
                        <p className="text-xs text-slate-500">&ldquo;{s.description}&rdquo;</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {s.status === 'BACKTESTING' ? 'Backtest XIRR' : s.status === 'LIVE' ? 'Portfolio XIRR' : 'Status'}
                      </p>
                      {s.xirr != null ? (
                        <p className={`text-xl font-bold tabular-nums ${s.xirr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {Math.abs(s.xirr).toFixed(1)}%
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-slate-500">Needs fund selection</p>
                      )}
                    </div>
                  </div>

                  {!isDraft && (
                    <>
                      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-400">AUM</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {s.total_aum ? formatINR(s.total_aum, 0) : '\u2014'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Funds</p>
                          <p className="text-sm font-semibold">{fundList.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">SIP Monthly</p>
                          <p className="text-sm font-semibold tabular-nums">{s.sip_monthly ? formatINR(s.sip_monthly, 0) : '\u2014'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Max Drawdown</p>
                          <p className={`text-sm font-semibold tabular-nums ${s.max_drawdown != null ? 'text-red-500' : ''}`}>
                            {s.max_drawdown != null ? `${s.max_drawdown.toFixed(1)}%` : '\u2014'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Sharpe</p>
                          <p className="text-sm font-semibold tabular-nums">{s.sharpe != null ? s.sharpe.toFixed(2) : '\u2014'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Since</p>
                          <p className="text-sm font-semibold">{formatShortDate(s.created_at)}</p>
                        </div>
                      </div>

                      {/* Fund Avatar Strip */}
                      {fundList.length > 0 && (
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {fundList.slice(0, 6).map((f, i) => {
                              const colors = AVATAR_COLORS[i % AVATAR_COLORS.length];
                              return (
                                <div
                                  key={f.mstar_id || i}
                                  className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold ${colors.bg} ${colors.text}`}
                                >
                                  {getInitials(f.fund_name)}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-xs text-slate-400 truncate">
                            {fundList.map((f) => f.fund_name?.replace(/ Fund$/, '').replace(/ Direct.*$/, '') || '').join(', ')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
