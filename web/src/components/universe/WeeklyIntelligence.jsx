/**
 * WeeklyIntelligence — Claude-powered actionable intelligence cards.
 * Each point: headline, insight, action, recommended funds.
 * Fetched from /api/v1/claude/weekly-intelligence (cached 24h server-side).
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { fetchWeeklyIntelligence } from '../../lib/api';
import { cachedFetch } from '../../lib/cache';
import { formatPct, formatAUM } from '../../lib/format';
import { scoreColor } from '../../lib/lens';

const URGENCY_STYLES = {
  high: { border: '#047857', bg: '#ecfdf5', label: 'HIGH', labelColor: '#047857' },
  medium: { border: '#d97706', bg: '#fffbeb', label: 'MEDIUM', labelColor: '#d97706' },
  low: { border: '#64748b', bg: '#f8fafc', label: 'LOW', labelColor: '#64748b' },
};

function IntelligenceCard({ point, index }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const urgency = URGENCY_STYLES[point.urgency] || URGENCY_STYLES.medium;
  const funds = point.recommended_funds || [];

  return (
    <div
      className="glass-card overflow-hidden transition-all"
      style={{ borderLeft: `3px solid ${urgency.border}` }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-slate-50/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-[10px] font-extrabold text-slate-300 tabular-nums mt-0.5 shrink-0">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{ color: urgency.labelColor, background: urgency.bg }}
              >
                {urgency.label}
              </span>
              {point.fund_type && (
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {point.fund_type}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-800 leading-tight">
              {point.headline}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {point.insight}
            </p>
          </div>
          <svg
            className={`w-3.5 h-3.5 text-slate-300 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Expanded: action + recommended funds */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          {/* Action */}
          <div className="flex items-start gap-2 mt-3 mb-3 px-3 py-2.5 rounded-lg" style={{ background: urgency.bg }}>
            <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0 mt-0.5">Action</span>
            <p className="text-[11px] font-semibold text-slate-700 leading-relaxed">
              {point.action}
            </p>
          </div>

          {/* Recommended funds */}
          {funds.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Recommended Funds
              </p>
              <div className="divide-y divide-slate-100">
                {funds.map((f, i) => {
                  const aumCr = (Number(f.aum) || 0) / 1e7;
                  return (
                    <div
                      key={f.mstar_id || i}
                      className="flex items-center gap-2 py-2 hover:bg-slate-50/60 cursor-pointer transition-colors group"
                      onClick={() => router.push(`/fund360?fund=${f.mstar_id}`)}
                    >
                      <span className="text-[10px] font-bold text-slate-300 w-4 text-right tabular-nums shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {(f.fund_name || '').replace(/ - Direct.*| Direct.*/, '').slice(0, 30)}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 tabular-nums shrink-0">
                        {formatAUM(aumCr)}
                      </span>
                      {f.return_1y != null && (
                        <span className={`text-[10px] font-bold tabular-nums shrink-0 ${Number(f.return_1y) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatPct(f.return_1y)}
                        </span>
                      )}
                      {f.alpha_score != null && (
                        <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: scoreColor(f.alpha_score) }}>
                          A:{Math.round(f.alpha_score)}
                        </span>
                      )}
                      <svg className="w-3 h-3 text-slate-300 group-hover:text-teal-500 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WeeklyIntelligence() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await cachedFetch('weekly-intelligence', fetchWeeklyIntelligence, 3600);
        setPoints(res?.data?.points || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-5">
        <p className="section-title mb-3">Weekly Intelligence</p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || points.length === 0) {
    return null; // Hide if no data — don't show empty state
  }

  // Split into high urgency (shown first) and rest
  const highPoints = points.filter((p) => p.urgency === 'high');
  const otherPoints = points.filter((p) => p.urgency !== 'high');
  const ordered = [...highPoints, ...otherPoints];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="section-title">Weekly Intelligence</p>
          <p className="text-[11px] text-slate-400">
            AI-generated insights from market sentiment, sector rotation, and fund performance data
          </p>
        </div>
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">
          {ordered.length} insights
        </span>
      </div>
      <div className="space-y-2">
        {ordered.map((point, idx) => (
          <IntelligenceCard key={idx} point={point} index={idx} />
        ))}
      </div>
    </div>
  );
}
