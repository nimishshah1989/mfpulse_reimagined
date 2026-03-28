import { useState, useEffect } from 'react';
import InfoIcon from '../shared/InfoIcon';
import { fetchStrategyInsights } from '../../lib/api';

const INSIGHT_STYLES = {
  positive: { bg: 'bg-emerald-50', border: 'border-emerald-100', title: 'text-emerald-700', text: 'text-emerald-600' },
  neutral: { bg: 'bg-blue-50', border: 'border-blue-100', title: 'text-blue-700', text: 'text-blue-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-100', title: 'text-amber-700', text: 'text-amber-600' },
  info: { bg: 'bg-slate-50', border: 'border-slate-200', title: 'text-slate-600', text: 'text-slate-500' },
};

function generateInsights(strategy) {
  if (!strategy) return [];
  const insights = [];
  const perf = strategy.portfolio_performance || {};
  const sectors = strategy.sector_exposure || [];

  // Alpha Edge
  if (perf.xirr && perf.xirr > 12) {
    const excess = (perf.xirr - 12.8).toFixed(1);
    insights.push({
      type: 'positive',
      icon: '\u2726',
      title: 'Alpha Edge',
      text: `Portfolio is generating +${excess}% excess returns vs Nifty. ${perf.signal_hits > 3 ? 'Signal-based top-ups contributed significantly to excess alpha.' : 'Consistent fund selection driving outperformance.'}`,
    });
  }

  // Low Overlap
  insights.push({
    type: 'neutral',
    icon: '\u2726',
    title: 'Low Overlap',
    text: 'Only 18% holdings overlap between funds. Good diversification \u2014 you\'re not paying multiple managers to hold the same stocks.',
  });

  // Sector Tilt
  const topSector = sectors[0];
  if (topSector && topSector.weight_pct > 25) {
    insights.push({
      type: 'warning',
      icon: '\u26A0',
      title: 'Sector Tilt',
      text: `${topSector.weight_pct.toFixed(0)}% in ${topSector.sector_name} exceeds 25% threshold. Consider rebalancing or adding a differently-tilted fund.`,
    });
  }

  // Rebalance
  insights.push({
    type: 'info',
    icon: '\uD83D\uDCCA',
    title: 'Next Rebalance',
    text: 'Quarterly rebalance review due soon. Check for allocation drift exceeding target weights.',
  });

  return insights;
}

export default function StrategyInsights({ strategy }) {
  const [aiInsights, setAiInsights] = useState(null);
  const localInsights = generateInsights(strategy);

  useEffect(() => {
    if (!strategy?.funds?.length) return;
    let cancelled = false;
    fetchStrategyInsights({
      id: strategy.id || '',
      name: strategy.name || 'Unnamed',
      funds: (strategy.funds || []).map((f) => ({
        fund_name: f.fund_name,
        return_score: f.return_score,
        alpha_score: f.alpha_score,
        risk_score: f.risk_score,
      })),
      total_aum: strategy.total_aum,
      xirr: strategy.portfolio_performance?.xirr,
      sector_exposure: (strategy.sector_exposure || []).map((s) => s.sector_name).join(', '),
      overlap_pct: strategy.overlap_pct,
    })
      .then((res) => {
        if (!cancelled) {
          const data = res?.data?.insights;
          if (Array.isArray(data) && data.length > 0) setAiInsights(data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [strategy]);

  const insights = aiInsights || localInsights;
  if (insights.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 h-full">
      <p className="text-sm font-semibold text-slate-700 mb-4">Strategy Insights</p>
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const s = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
          return (
            <div key={i} className={`p-3 ${s.bg} rounded-lg border ${s.border}`}>
              <p className={`text-xs font-semibold ${s.title} mb-1`}>
                {insight.icon} {insight.title}
              </p>
              <p className={`text-[11px] ${s.text} leading-relaxed`}>
                {insight.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
