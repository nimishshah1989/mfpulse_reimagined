import { useState, useEffect } from 'react';
import { fetchStrategies } from '../../lib/api';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatINR } from '../../lib/format';

function deriveAlerts(strategies, breadth, sentiment) {
  const alerts = [];
  const breadthPct = breadth?.pct_above_21ema ?? breadth?.current?.pct_above_21ema;
  const sentimentScore = sentiment?.composite_score ?? sentiment?.score;

  (strategies || []).forEach((strat) => {
    const rules = strat.rules || [];
    rules.forEach((rule) => {
      (rule.conditions || []).forEach((cond) => {
        let currentValue = null;
        if (cond.signal_name.includes('breadth') && breadthPct != null) {
          currentValue = breadthPct;
        } else if (cond.signal_name.includes('sentiment') && sentimentScore != null) {
          currentValue = sentimentScore;
        }

        if (currentValue == null) return;

        const threshold = cond.threshold;
        const distance = Math.abs(currentValue - threshold);
        const pctDistance = (distance / threshold) * 100;
        const isTriggered =
          (cond.operator === 'BELOW' && currentValue < threshold) ||
          (cond.operator === 'ABOVE' && currentValue > threshold) ||
          (cond.operator === 'CROSSES_BELOW' && currentValue < threshold) ||
          (cond.operator === 'CROSSES_ABOVE' && currentValue > threshold);

        if (isTriggered) {
          alerts.push({
            strategyName: strat.name,
            ruleName: rule.name,
            severity: 'fired',
            message: `${cond.signal_name} ${cond.operator} ${threshold} — TRIGGERED (current: ${currentValue.toFixed(1)})`,
            multiplier: rule.multiplier,
            sipAmount: strat.config?.sipAmount || strat.sip_amount,
          });
        } else if (pctDistance < 15) {
          alerts.push({
            strategyName: strat.name,
            ruleName: rule.name,
            severity: 'approaching',
            message: `${cond.signal_name} approaching ${threshold} (current: ${currentValue.toFixed(1)}, ${pctDistance.toFixed(0)}% away)`,
          });
        }
      });
    });
  });

  return alerts;
}

export default function StrategyAlerts({ breadth, sentiment }) {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStrategies()
      .then((res) => setStrategies(res.data || []))
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <SkeletonLoader className="h-32 rounded-xl" />;
  }

  const alerts = deriveAlerts(strategies, breadth, sentiment);

  if (alerts.length === 0 && strategies.length === 0) {
    return (
      <Card title="Strategy Alerts">
        <p className="text-xs text-slate-400">No strategies configured. Create a strategy to see alerts.</p>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card title="Strategy Alerts">
        <p className="text-xs text-slate-400">No conditions approaching thresholds across {strategies.length} strategies.</p>
      </Card>
    );
  }

  return (
    <Card title="Strategy Alerts">
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`p-2.5 rounded-lg border-l-4 ${
              alert.severity === 'fired'
                ? 'border-l-red-500 bg-red-50'
                : 'border-l-amber-500 bg-amber-50'
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-semibold text-slate-700">{alert.strategyName}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                alert.severity === 'fired'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {alert.severity === 'fired' ? 'FIRED' : 'APPROACHING'}
              </span>
            </div>
            <p className="text-xs text-slate-600">{alert.message}</p>
            {alert.severity === 'fired' && alert.sipAmount && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Deploy: {alert.multiplier}x = {formatINR(alert.sipAmount * alert.multiplier, 0)}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
