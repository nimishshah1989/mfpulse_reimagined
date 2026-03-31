/**
 * NL Parser for Strategy FundSelector — parses natural language into visual token pills.
 * Returns structured tokens with type, label, value, and color for display and API query building.
 */

const CATEGORIES = {
  'large cap': 'Large Cap',
  'largecap': 'Large Cap',
  'flexi cap': 'Flexi Cap',
  'flexicap': 'Flexi Cap',
  'mid cap': 'Mid Cap',
  'midcap': 'Mid Cap',
  'small cap': 'Small Cap',
  'smallcap': 'Small Cap',
  'small mid cap': 'Small Cap',
  'elss': 'ELSS',
  'tax sav': 'ELSS',
  'balanced': 'Balanced Advantage',
  'multi cap': 'Multi Cap',
  'multicap': 'Multi Cap',
  'large & mid': 'Large & Mid Cap',
  'large and mid': 'Large & Mid Cap',
  'value': 'Value',
  'contra': 'Contra',
  'focused': 'Focused Fund',
  'dividend yield': 'Dividend Yield',
  'sectoral': 'Sector',
  'thematic': 'Thematic',
  'index': 'Index Funds',
  'debt': 'Debt',
  'liquid': 'Liquid',
  'gilt': 'Gilt',
  'hybrid': 'Hybrid',
  'equity': 'Equity',
};

const TIERS = {
  'leader': { class: 'return_class', value: 'LEADER' },
  'alpha machine': { class: 'alpha_class', value: 'ALPHA_MACHINE' },
  'rock solid': { class: 'consistency_class', value: 'ROCK_SOLID' },
  'fortress': { class: 'resilience_class', value: 'FORTRESS' },
  'low risk': { class: 'risk_class', value: 'LOW_RISK' },
  'lean': { class: 'efficiency_class', value: 'LEAN' },
  'consistent': { class: 'consistency_class', value: 'CONSISTENT' },
  'strong': { class: 'return_class', value: 'STRONG' },
};

const METRIC_PATTERNS = [
  { regex: /sharpe\s*[>>=]+\s*([\d.]+)/i, label: 'Sharpe', key: 'sharpe_3y_min' },
  { regex: /alpha\s*[>>=]+\s*([\d.]+)/i, label: 'Alpha', key: 'alpha_3y_min' },
  { regex: /return\s*[>>=]+\s*([\d.]+)/i, label: 'Return', key: 'return_1y_min' },
  { regex: /aum\s*[>>=]+\s*([\d.]+)/i, label: 'AUM', key: 'aum_min' },
];

export const TOKEN_COLORS = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

/**
 * Parse a natural language query string into an array of typed tokens.
 * Each token: { type, label, value, color }
 */
export function parseNLQuery(query) {
  const tokens = [];
  const q = query.toLowerCase();

  // Category detection
  for (const [keyword, category] of Object.entries(CATEGORIES)) {
    if (q.includes(keyword)) {
      tokens.push({ type: 'category', label: category, value: category, color: 'blue' });
    }
  }

  // Plan detection
  if (q.includes('direct')) {
    tokens.push({ type: 'plan', label: 'Direct', value: 'Direct', color: 'slate' });
  } else if (q.includes('regular')) {
    tokens.push({ type: 'plan', label: 'Regular', value: 'Regular', color: 'slate' });
  }

  // Tier detection — check longer keywords first to avoid partial matches
  const sortedTiers = Object.entries(TIERS).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, tier] of sortedTiers) {
    if (q.includes(keyword)) {
      const alreadyMatched = tokens.some(
        (t) => t.type === 'tier' && t.value.class === tier.class && t.value.value === tier.value
      );
      if (!alreadyMatched) {
        tokens.push({
          type: 'tier',
          label: tier.value.replace(/_/g, ' '),
          value: tier,
          color: 'emerald',
        });
      }
    }
  }

  // Metric filters
  for (const { regex, label, key } of METRIC_PATTERNS) {
    const match = q.match(regex);
    if (match) {
      tokens.push({
        type: 'metric',
        label: `${label} > ${match[1]}`,
        value: { [key]: Number(match[1]) },
        color: 'purple',
      });
    }
  }

  // Sort detection
  if (q.includes('top') || q.includes('best')) {
    if (q.includes('alpha')) {
      tokens.push({ type: 'sort', label: 'Sort: Alpha', value: { sort_by: 'alpha_score', sort_dir: 'desc' }, color: 'indigo' });
    } else if (q.includes('return')) {
      tokens.push({ type: 'sort', label: 'Sort: Return', value: { sort_by: 'return_score', sort_dir: 'desc' }, color: 'indigo' });
    } else if (q.includes('sharpe')) {
      tokens.push({ type: 'sort', label: 'Sort: Sharpe', value: { sort_by: 'efficiency_score', sort_dir: 'desc' }, color: 'indigo' });
    } else {
      tokens.push({ type: 'sort', label: 'Sort: Return', value: { sort_by: 'return_score', sort_dir: 'desc' }, color: 'indigo' });
    }
  }

  // Limit detection
  const limitMatch = q.match(/top\s+(\d+)/i);
  if (limitMatch) {
    tokens.push({ type: 'limit', label: `Top ${limitMatch[1]}`, value: Number(limitMatch[1]), color: 'amber' });
  }

  return tokens;
}

/**
 * Convert token array into API search params object.
 */
export function tokensToSearchParams(tokens) {
  const params = {};
  for (const token of tokens) {
    if (token.type === 'category') params.category = token.value;
    if (token.type === 'plan') params.purchase_mode = token.value === 'Direct' ? 2 : 1;
    if (token.type === 'tier') {
      params[token.value.class] = token.value.value;
    }
    if (token.type === 'metric') Object.assign(params, token.value);
    if (token.type === 'sort') Object.assign(params, token.value);
    if (token.type === 'limit') params.limit = token.value;
  }
  if (!params.limit) params.limit = 20;
  return params;
}
