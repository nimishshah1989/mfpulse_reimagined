import { useState, useEffect } from 'react';
import { fetchFundIntelligence } from '../../lib/api';
import { formatPct, formatINR } from '../../lib/format';

const SIGNAL_COLORS = {
  bullish: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '↑' },
  defensive: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '↓' },
  volatile: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '↕' },
  neutral: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: '→' },
};

export default function IntelligenceCards({ mstarId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mstarId) return;
    let cancelled = false;
    setLoading(true);
    fetchFundIntelligence(mstarId)
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mstarId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { regime_signal, better_alternatives, sip_intelligence } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Regime Signal */}
      <div className={`rounded-xl border p-4 ${regime_signal ? SIGNAL_COLORS[regime_signal.signal]?.bg || 'bg-slate-50' : 'bg-slate-50'} ${regime_signal ? SIGNAL_COLORS[regime_signal.signal]?.border || 'border-slate-200' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{regime_signal ? SIGNAL_COLORS[regime_signal.signal]?.icon || '→' : '→'}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Regime Signal</span>
        </div>
        {regime_signal ? (
          <>
            <p className={`text-sm font-medium ${SIGNAL_COLORS[regime_signal.signal]?.text || 'text-slate-700'} mb-2`}>
              {regime_signal.verdict}
            </p>
            <div className="flex gap-4 text-[11px] text-slate-500">
              <span>Up Capture: <span className="font-bold font-mono tabular-nums text-slate-700">{regime_signal.capture_up_3y != null ? Number(regime_signal.capture_up_3y).toFixed(1) : '—'}</span></span>
              <span>Down Capture: <span className="font-bold font-mono tabular-nums text-slate-700">{regime_signal.capture_down_3y != null ? Number(regime_signal.capture_down_3y).toFixed(1) : '—'}</span></span>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">Insufficient data for regime analysis</p>
        )}
      </div>

      {/* Card 2: Better Alternatives */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⚖</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Category Ranking</span>
        </div>
        {better_alternatives ? (
          <>
            <p className="text-xs text-slate-500 mb-2">
              Rank <span className="font-bold text-slate-800">#{better_alternatives.fund_rank || '—'}</span> of {better_alternatives.total_in_category} by Sharpe (3Y) in {better_alternatives.category_name}
            </p>
            <div className="space-y-1.5">
              {better_alternatives.top_3?.map((f, i) => (
                <div key={f.mstar_id} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 truncate max-w-[180px]">
                    <span className="font-bold text-teal-600 mr-1">#{i + 1}</span>
                    {f.fund_name}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-700">
                    {f.sharpe_3y != null ? Number(f.sharpe_3y).toFixed(2) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">No peer comparison data available</p>
        )}
      </div>

      {/* Card 3: SIP Intelligence */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">💰</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">SIP Backtest</span>
        </div>
        {sip_intelligence ? (
          <>
            <p className="text-xs text-slate-500 mb-2">
              {formatINR(sip_intelligence.monthly_sip || 0, 0)}/mo for {sip_intelligence.period_years || 5}Y
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-400">Invested</p>
                <p className="text-sm font-bold font-mono tabular-nums text-slate-700">
                  ₹{(Number(sip_intelligence.invested || 0) / 100000).toFixed(1)}L
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Current Value</p>
                <p className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                  ₹{(Number(sip_intelligence.current_value || 0) / 100000).toFixed(1)}L
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">XIRR</p>
                <p className={`text-sm font-bold font-mono tabular-nums ${Number(sip_intelligence.xirr) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {sip_intelligence.xirr}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Gain</p>
                <p className={`text-sm font-bold font-mono tabular-nums ${Number(sip_intelligence.gain_pct) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  +{sip_intelligence.gain_pct}%
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">5Y return data required for SIP estimate</p>
        )}
      </div>
    </div>
  );
}
