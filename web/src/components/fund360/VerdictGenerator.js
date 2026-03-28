const LENS_KEYS = [
  'return_score',
  'risk_score',
  'consistency_score',
  'alpha_score',
  'efficiency_score',
  'resilience_score',
];

const STRENGTH_PHRASES = {
  return_score: 'strong returns',
  risk_score: 'controlled risk',
  consistency_score: 'consistent delivery',
  alpha_score: 'genuine alpha generation',
  efficiency_score: 'lean cost structure',
  resilience_score: 'strong downside protection',
};

const WEAKNESS_PHRASES = {
  return_score: 'below-average returns',
  risk_score: 'elevated volatility',
  consistency_score: 'inconsistent performance',
  alpha_score: 'limited manager skill',
  efficiency_score: 'high cost drag',
  resilience_score: 'poor downside protection',
};

/**
 * Generates a narrative verdict for a fund based on its six lens scores.
 *
 * @param {Object|null|undefined} fund - Fund object with lens score keys
 * @returns {string} - Narrative verdict string
 */
export function generateVerdict(fund) {
  if (!fund) {
    return 'Insufficient data to generate a verdict for this fund.';
  }

  // Resolve scores, defaulting missing/null values to 0
  const scores = LENS_KEYS.map((key) => {
    const raw = fund[key];
    return typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0;
  });

  const hasAnyScore = LENS_KEYS.some((key) => {
    const raw = fund[key];
    return typeof raw === 'number' && !Number.isNaN(raw) && raw > 0;
  });

  if (!hasAnyScore) {
    return 'Insufficient data to generate a verdict for this fund.';
  }

  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  // 1. Character
  let character;
  if (avg > 75) {
    character = 'strong';
  } else if (avg > 55) {
    character = 'adequate';
  } else {
    character = 'below-average';
  }

  // 2. Ranked entries for strengths/weaknesses
  const ranked = LENS_KEYS.map((key, i) => ({ key, score: scores[i] })).sort(
    (a, b) => b.score - a.score
  );

  const top2 = ranked.slice(0, 2);
  const bottom2 = ranked.slice(-2);

  const strengthParts = top2
    .filter((e) => e.score > 0)
    .map((e) => STRENGTH_PHRASES[e.key]);

  const weaknessParts = bottom2
    .filter((e) => e.score < 60)
    .map((e) => WEAKNESS_PHRASES[e.key]);

  // 3. Expense flag
  const effScore = typeof fund.efficiency_score === 'number' ? fund.efficiency_score : 0;
  const expenseFlag = effScore < 40;

  // 4. Bottom line recommendation
  let bottomLine;
  if (avg > 70) {
    bottomLine = 'Suitable as a core allocation.';
  } else if (avg > 50) {
    bottomLine = 'An adequate holding; monitor for improvement.';
  } else {
    bottomLine = 'Consider switching to a stronger alternative.';
  }

  // 5. Assemble narrative
  const parts = [];

  const charPhrase =
    character === 'strong'
      ? `This fund demonstrates strong overall quality`
      : character === 'adequate'
      ? `This fund shows adequate overall quality`
      : `This fund shows below-average overall quality`;

  if (strengthParts.length > 0) {
    parts.push(`${charPhrase}, with standout ${strengthParts.join(' and ')}.`);
  } else {
    parts.push(`${charPhrase}.`);
  }

  if (weaknessParts.length > 0) {
    parts.push(`Key concerns include ${weaknessParts.join(' and ')}.`);
  }

  if (expenseFlag) {
    parts.push('High cost drag on returns warrants attention to expense ratios.');
  }

  parts.push(bottomLine);

  return parts.join(' ');
}
