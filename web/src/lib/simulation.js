const PERIOD_YEARS = { '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10, max: 25 };

export function computeStartDate(period) {
  const today = new Date();
  const years = PERIOD_YEARS[period] || 5;
  const start = new Date(today);
  start.setFullYear(today.getFullYear() - years);
  return start.toISOString().split('T')[0];
}

export function assemblePayload(fund, config, rules, period) {
  if (!fund) return null;
  return {
    mstar_id: fund.mstar_id,
    sip_amount: config.sipAmount,
    sip_day: config.sipDay,
    lumpsum_amount: config.lumpsumAmount,
    lumpsum_deploy_pct: config.lumpsumDeployPct,
    start_date: computeStartDate(period),
    end_date: new Date().toISOString().split('T')[0],
    signal_rules: rules,
  };
}

export function resampleTimeline(timeline, targetPoints = 120) {
  if (!timeline || timeline.length <= targetPoints) return timeline || [];
  const step = Math.floor(timeline.length / targetPoints);
  return timeline.filter((_, i) => i % step === 0 || i === timeline.length - 1);
}

export const SIGNAL_COLORS = {
  breadth: '#dc2626',
  sentiment: '#f59e0b',
  vix: '#7c3aed',
  sector: '#0d9488',
};

export function getSignalColor(trigger) {
  if (!trigger) return '#94a3b8';
  const t = trigger.toLowerCase();
  if (t.includes('breadth')) return SIGNAL_COLORS.breadth;
  if (t.includes('sentiment')) return SIGNAL_COLORS.sentiment;
  if (t.includes('vix')) return SIGNAL_COLORS.vix;
  if (t.includes('sector')) return SIGNAL_COLORS.sector;
  return '#94a3b8';
}

export const MODE_COLORS = {
  SIP: '#0d9488',
  SIP_SIGNAL: '#059669',
  LUMPSUM: '#f59e0b',
  HYBRID: '#7c3aed',
  // API compare_modes uses lowercase keys
  pure_sip: '#0d9488',
  sip_signal: '#059669',
  lumpsum: '#f59e0b',
  hybrid: '#7c3aed',
};

export const MODE_LABELS = {
  SIP: 'Pure SIP',
  SIP_SIGNAL: 'SIP + Signal',
  LUMPSUM: 'Lumpsum',
  HYBRID: 'Hybrid',
  // API compare_modes uses lowercase keys
  pure_sip: 'Pure SIP',
  sip_signal: 'SIP + Signal',
  lumpsum: 'Lumpsum',
  hybrid: 'Hybrid',
};

export function findBestMode(results) {
  if (!results) return null;
  let best = null;
  let bestXirr = -Infinity;
  for (const [mode, data] of Object.entries(results)) {
    const xirr = data?.summary?.xirr_pct ?? data?.xirr_pct ?? -Infinity;
    if (xirr > bestXirr) {
      bestXirr = xirr;
      best = mode;
    }
  }
  return best;
}

export const SIGNAL_SOURCES = [
  'breadth_21ema', 'breadth_50ema', 'breadth_200ema',
  'sentiment_composite', 'vix_level', 'nifty_vs_200sma',
];

export const OPERATORS = ['BELOW', 'ABOVE', 'CROSSES_BELOW', 'CROSSES_ABOVE'];

export const EMPTY_RULE = {
  name: 'New Rule',
  conditions: [{ signal_name: 'breadth_21ema', operator: 'BELOW', threshold: 40 }],
  logic: 'AND',
  multiplier: 2,
  cooloff_days: 30,
};

export const DEFAULT_CONFIG = {
  sipAmount: 10000,
  lumpsumAmount: 500000,
  lumpsumDeployPct: 25,
  sipDay: 5,
  autoSimulate: true,
};
