/**
 * Natural Language Search — parses user queries into structured filters.
 * Handles sector keywords, quantitative patterns, and fund characteristic queries.
 */

const SECTOR_KEYWORDS = {
  'technology': 'Technology',
  'tech': 'Technology',
  'it': 'Technology',
  'healthcare': 'Healthcare',
  'pharma': 'Healthcare',
  'financial': 'Financial Services',
  'banking': 'Financial Services',
  'bank': 'Financial Services',
  'energy': 'Energy',
  'oil': 'Energy',
  'consumer': 'Consumer Cyclical',
  'auto': 'Consumer Cyclical',
  'fmcg': 'Consumer Defensive',
  'staples': 'Consumer Defensive',
  'industrial': 'Industrials',
  'infra': 'Industrials',
  'infrastructure': 'Industrials',
  'real estate': 'Real Estate',
  'realty': 'Real Estate',
  'materials': 'Basic Materials',
  'metal': 'Basic Materials',
  'mining': 'Basic Materials',
  'telecom': 'Communication Services',
  'media': 'Communication Services',
  'utilities': 'Utilities',
  'power': 'Utilities',
};

const QUADRANT_KEYWORDS = {
  'leading': 'Leading',
  'leading sector': 'Leading',
  'winning': 'Leading',
  'improving': 'Improving',
  'recovering': 'Improving',
  'weakening': 'Weakening',
  'declining': 'Weakening',
  'lagging': 'Lagging',
  'underperforming': 'Lagging',
};

const LENS_KEYWORDS = {
  'alpha': 'alpha_score',
  'return': 'return_score',
  'risk': 'risk_score',
  'consistency': 'consistency_score',
  'consistent': 'consistency_score',
  'efficient': 'efficiency_score',
  'efficiency': 'efficiency_score',
  'cheap': 'efficiency_score',
  'expensive': 'efficiency_score',
  'resilient': 'resilience_score',
  'resilience': 'resilience_score',
  'safe': 'risk_score',
  'low risk': 'risk_score',
};

const TIER_KEYWORDS = {
  'leader': { class: 'return_class', value: 'LEADER' },
  'fortress': { class: 'resilience_class', value: 'FORTRESS' },
  'alpha machine': { class: 'alpha_class', value: 'ALPHA_MACHINE' },
  'rock solid': { class: 'consistency_class', value: 'ROCK_SOLID' },
  'sturdy': { class: 'resilience_class', value: 'STURDY' },
  'lean': { class: 'efficiency_class', value: 'LEAN' },
  'bloated': { class: 'efficiency_class', value: 'BLOATED' },
  'erratic': { class: 'consistency_class', value: 'ERRATIC' },
  'vulnerable': { class: 'resilience_class', value: 'VULNERABLE' },
};

// Numeric pattern: "alpha > 80", "sharpe > 1.5", "return > 15%", "drawdown < 15%"
const NUMERIC_PATTERN = /(\w[\w\s]*?)\s*(>|<|>=|<=|above|below|over|under)\s*(\d+\.?\d*)\s*%?/gi;

/**
 * Parse a natural language query into structured search filters.
 * Returns: { sectors: string[], quadrants: string[], lensFilters: object[], numericFilters: object[], keywords: string[] }
 */
export function parseNLQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const lower = query.toLowerCase().trim();
  if (lower.length < 2) return null;

  const result = {
    sectors: [],
    quadrants: [],
    lensFilters: [],
    numericFilters: [],
    categories: [],
    tierFilters: [],
    keywords: [],
    raw: query,
  };

  // Match sectors
  for (const [keyword, sector] of Object.entries(SECTOR_KEYWORDS)) {
    if (lower.includes(keyword) && !result.sectors.includes(sector)) {
      result.sectors.push(sector);
    }
  }

  // Match quadrants
  for (const [keyword, quadrant] of Object.entries(QUADRANT_KEYWORDS)) {
    if (lower.includes(keyword) && !result.quadrants.includes(quadrant)) {
      result.quadrants.push(quadrant);
    }
  }

  // Match lens keywords
  for (const [keyword, lensKey] of Object.entries(LENS_KEYWORDS)) {
    if (lower.includes(keyword)) {
      result.lensFilters.push({ key: lensKey, keyword });
    }
  }

  // Match tier keywords
  for (const [keyword, tier] of Object.entries(TIER_KEYWORDS)) {
    if (lower.includes(keyword)) {
      result.tierFilters.push(tier);
    }
  }

  // Match numeric patterns
  let match;
  while ((match = NUMERIC_PATTERN.exec(lower)) !== null) {
    const [, field, operator, value] = match;
    const fieldLower = field.trim();
    const numValue = parseFloat(value);

    // Map field names to actual keys
    const fieldMap = {
      'alpha': 'alpha_score',
      'return': 'return_1y',
      'risk': 'risk_score',
      'sharpe': 'sharpe_ratio',
      'drawdown': 'max_drawdown',
      'expense': 'net_expense_ratio',
      'consistency': 'consistency_score',
      'efficiency': 'efficiency_score',
    };

    const mappedField = fieldMap[fieldLower] || fieldLower;
    const op = ['>', 'above', 'over'].includes(operator) ? 'gt'
      : ['<', 'below', 'under'].includes(operator) ? 'lt'
      : operator === '>=' ? 'gte' : 'lte';

    result.numericFilters.push({ field: mappedField, operator: op, value: numValue });
  }

  // Category keywords
  const categoryPatterns = [
    { pattern: /small\s*cap/i, category: 'Small Cap' },
    { pattern: /large\s*cap/i, category: 'Large Cap' },
    { pattern: /mid\s*cap/i, category: 'Mid Cap' },
    { pattern: /flexi/i, category: 'Flexi Cap' },
    { pattern: /multi\s*cap/i, category: 'Multi Cap' },
    { pattern: /debt|bond/i, category: 'Debt' },
    { pattern: /hybrid|balanced/i, category: 'Hybrid' },
    { pattern: /index|passive/i, category: 'Index' },
    { pattern: /elss|tax/i, category: 'ELSS' },
  ];

  for (const { pattern, category } of categoryPatterns) {
    if (pattern.test(query)) {
      result.categories.push(category);
    }
  }

  // Extract any remaining keywords
  const stopWords = new Set(['fund', 'funds', 'with', 'the', 'a', 'an', 'in', 'of', 'for', 'and', 'or', 'that', 'are', 'is', 'has', 'have', 'sector', 'sectors']);
  const words = lower.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
  result.keywords = words;

  const hasFilters = result.sectors.length + result.quadrants.length + result.lensFilters.length + result.numericFilters.length + result.categories.length + result.tierFilters.length > 0;
  return hasFilters ? result : null;
}

/**
 * Apply parsed NL filters to a fund array.
 */
export function applyNLFilters(funds, filters) {
  if (!filters || !funds) return funds;

  let result = [...funds];

  // Category filter — normalize hyphens/spaces for fuzzy matching
  if (filters.categories.length > 0) {
    result = result.filter((f) => {
      const cat = (f.category_name || '').toLowerCase().replace(/[-\s]+/g, ' ');
      return filters.categories.some((c) => cat.includes(c.toLowerCase().replace(/[-\s]+/g, ' ')));
    });
  }

  // Numeric filters
  for (const nf of filters.numericFilters) {
    result = result.filter((f) => {
      const val = Number(f[nf.field]);
      if (isNaN(val)) return false;
      if (nf.operator === 'gt') return val > nf.value;
      if (nf.operator === 'lt') return val < nf.value;
      if (nf.operator === 'gte') return val >= nf.value;
      if (nf.operator === 'lte') return val <= nf.value;
      return true;
    });
  }

  // Tier filters
  if (filters.tierFilters?.length > 0) {
    result = result.filter((f) => {
      return filters.tierFilters.every((tf) => f[tf.class] === tf.value);
    });
  }

  // Lens score high filters (keywords like "high alpha" imply score > 70)
  if (filters.lensFilters.length > 0) {
    const highKeywords = ['high', 'strong', 'good', 'top', 'best', 'leader'];
    const lowKeywords = ['low', 'cheap', 'safe', 'conservative'];
    const queryLower = filters.raw.toLowerCase();

    for (const lf of filters.lensFilters) {
      const isHigh = highKeywords.some((k) => queryLower.includes(k));
      const isLow = lowKeywords.some((k) => queryLower.includes(k));

      if (isHigh) {
        result = result.filter((f) => Number(f[lf.key]) >= 70);
      } else if (isLow && lf.key === 'risk_score') {
        result = result.filter((f) => Number(f[lf.key]) >= 70); // high risk score = low risk
      } else if (isLow) {
        result = result.filter((f) => Number(f[lf.key]) <= 30);
      }
    }
  }

  return result;
}
