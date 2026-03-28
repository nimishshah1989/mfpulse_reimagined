import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { fetchStrategies } from '../../lib/api';
import Card from '../shared/Card';
import SkeletonLoader from '../shared/SkeletonLoader';
import { formatINR } from '../../lib/format';

function classifyAlert(cond, isTriggered) {
  // Buy signals: breadth/sentiment conditions that suggest deployment
  const isBuySignal =
    (cond.signal_name.includes('sentiment') && cond.operator === 'BELOW') ||
    (cond.signal_name.includes('breadth') && cond.operator === 'BELOW');

  if (isTriggered) {
    return isBuySignal ? 'buy' : 'sell';
  }
  return 'caution';
}

function alertConfig(type) {
  switch (type) {
    case 'buy':
      return {
        borderColor: 'border-l-emerald-500',
        bg: 'bg-emerald-50',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-700',
        badgeLabel: 'BUY SIGNAL',
        icon: (
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
          </svg>
        ),
      };
    case 'sell':
      return {
        borderColor: 'border-l-red-500',
        bg: 'bg-red-50',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-700',
        badgeLabel: 'SELL SIGNAL',
        icon: (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ),
      };
    default:
      return {
        borderColor: 'border-l-amber-500',
        bg: 'bg-amber-50',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-700',
        badgeLabel: 'APPROACHING',
        icon: (
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
  }
}

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
          const alertType = classifyAlert(cond, true);
          alerts.push({
            strategyId: strat.id,
            strategyName: strat.name,
            ruleName: rule.name,
            signalName: cond.signal_name,
            operator: cond.operator,
            threshold,
            currentValue,
            type: alertType,
            message: `${cond.signal_name} ${cond.operator} ${threshold}`,
            action: alertType === 'buy'
              ? `Deploy ${rule.multiplier}x SIP amount`
              : 'Consider reducing position',
            multiplier: rule.multiplier,
            sipAmount: strat.config?.sipAmount || strat.sip_amount,
          });
        } else if (pctDistance < 15) {
          alerts.push({
            strategyId: strat.id,
            strategyName: strat.name,
            ruleName: rule.name,
            signalName: cond.signal_name,
            operator: cond.operator,
            threshold,
            currentValue,
            type: 'caution',
            message: `${cond.signal_name} approaching ${threshold} (${pctDistance.toFixed(0)}% away)`,
            action: 'Monitor closely',
          });
        }
      });
    });
  });

  return alerts;
}

function AlertCard({ alert, onNavigate }) {
  const config = alertConfig(alert.type);

  return (
    <div className={`border-l-4 ${config.borderColor} ${config.bg} rounded-lg p-3`}>
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="text-xs font-bold text-slate-800">{alert.strategyName}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.badgeBg} ${config.badgeText}`}>
          {config.badgeLabel}
        </span>
      </div>

      <div className="ml-6 space-y-1">
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">{alert.ruleName}:</span>{' '}
          {alert.message}
        </p>
        <p className="text-xs text-slate-500">
          Current: <span className="font-mono tabular-nums font-medium">{alert.currentValue?.toFixed(1)}</span>
        </p>

        {/* Suggested action */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] font-medium text-slate-600">
            {alert.action}
            {alert.sipAmount && alert.multiplier && (
              <span className="ml-1 font-mono tabular-nums text-slate-800">
                ({formatINR(alert.sipAmount * alert.multiplier, 0)})
              </span>
            )}
          </p>
          {alert.strategyId && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate(`/strategies?id=${alert.strategyId}`)}
              className="text-[10px] text-teal-600 hover:text-teal-700 font-medium"
            >
              View Strategy →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StrategyAlerts({ breadth, sentiment }) {
  const router = useRouter();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStrategies()
      .then((res) => setStrategies(res.data || []))
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  }, []);

  const handleNavigate = (route) => router.push(route);

  if (loading) {
    return <SkeletonLoader className="h-32 rounded-xl" />;
  }

  const alerts = deriveAlerts(strategies, breadth, sentiment);

  if (alerts.length === 0 && strategies.length === 0) {
    return (
      <Card>
        <div className="text-center py-4">
          <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="text-xs text-slate-400">No strategies configured yet.</p>
          <button
            type="button"
            onClick={() => handleNavigate('/strategies')}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium mt-1"
          >
            Create your first strategy →
          </button>
        </div>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <div className="text-center py-4">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-xs text-slate-500">All clear across {strategies.length} strategies.</p>
          <p className="text-[10px] text-slate-400 mt-0.5">No conditions approaching thresholds.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-2.5">
        {alerts.slice(0, 5).map((alert, i) => (
          <AlertCard key={i} alert={alert} onNavigate={handleNavigate} />
        ))}
        {alerts.length > 5 && (
          <p className="text-[10px] text-slate-400 text-center pt-1">
            +{alerts.length - 5} more alerts
          </p>
        )}
      </div>
    </Card>
  );
}
