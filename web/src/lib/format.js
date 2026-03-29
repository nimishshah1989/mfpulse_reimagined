/**
 * Indian number formatting utilities.
 * ₹1,23,45,678 format — last 3 digits, then groups of 2.
 */
export function formatINR(num, decimals = 2) {
  if (num == null) return '\u2014';
  const n = Number(num);
  if (isNaN(n)) return '\u2014';
  const sign = n < 0 ? '\u2212' : '';
  const abs = Math.abs(n);
  const [intPart, decPart] = abs.toFixed(decimals).split('.');

  // Indian grouping: last 3 digits, then groups of 2
  let formatted;
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    const lastThree = intPart.slice(-3);
    let rest = intPart.slice(0, -3);
    // Insert commas every 2 digits from right in the rest
    const parts = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length > 0) parts.unshift(rest);
    formatted = parts.join(',') + ',' + lastThree;
  }

  return `${sign}\u20B9${formatted}${decPart ? '.' + decPart : ''}`;
}

/**
 * Smart AUM shorthand: ₹12.5Cr, ₹48.3L
 * Input is assumed to be in Crores.
 */
export function formatAUM(num) {
  if (num == null) return '\u2014';
  const n = Number(num);
  if (isNaN(n)) return '\u2014';
  const abs = Math.abs(n);
  const sign = n < 0 ? '\u2212' : '';
  if (abs >= 100)
    return `${sign}\u20B9${(abs / 1).toFixed(0)}Cr`;
  if (abs >= 1) return `${sign}\u20B9${abs.toFixed(1)}Cr`;
  return `${sign}\u20B9${(abs * 100).toFixed(1)}L`;
}

/**
 * Convert raw AUM (absolute rupees) to Crores then format.
 * Use this when the source value is in paisa/rupees (e.g. fund_holdings_snapshot.aum).
 */
export function formatAUMRaw(rawRupees) {
  if (rawRupees == null) return '\u2014';
  const n = Number(rawRupees);
  if (isNaN(n)) return '\u2014';
  return formatAUM(n / 10000000);
}

/**
 * Percentage display: +18.4% or −3.2%
 */
export function formatPct(num, decimals = 1) {
  if (num == null) return '\u2014';
  const n = Number(num);
  if (isNaN(n)) return '\u2014';
  return `${n >= 0 ? '+' : '\u2212'}${Math.abs(n).toFixed(decimals)}%`;
}

/**
 * Score display: 84
 */
export function formatScore(num) {
  if (num == null) return '\u2014';
  const n = Number(num);
  if (isNaN(n)) return '\u2014';
  return `${Math.round(n)}`;
}

/**
 * Compact number for fund counts: 3,124
 */
export function formatCount(num) {
  if (num == null) return '0';
  return Number(num).toLocaleString('en-IN');
}
