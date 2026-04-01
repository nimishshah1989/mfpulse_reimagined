/**
 * Helper constants and functions for PerformanceChart.
 * Extracted to keep the main component under 300 lines.
 */

export const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y', 'since_inception'];

export const PERIOD_LABELS = {
  '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y',
  '3y': '3Y', '5y': '5Y', since_inception: 'MAX',
};

// Nifty 50 TRI approximate CAGR by period (used when no live benchmark data)
export const NIFTY_CAGR = {
  '1m': 12, '3m': 12, '6m': 12, '1y': 8,
  '3y': 12, '5y': 14, since_inception: 12,
};

/**
 * Synthesize a benchmark growth-of-10K series over the same dates as the fund.
 * Uses the annualised CAGR to compound daily: value = 10000 * (1 + cagr/100)^(days/365)
 */
export function synthBenchmarkSeries(dates, cagrPct) {
  if (!dates.length || cagrPct == null) return null;
  const t0 = new Date(dates[0]).getTime();
  const rate = 1 + Number(cagrPct) / 100;
  return dates.map((d) => {
    const days = (new Date(d).getTime() - t0) / 86400000;
    return Math.round(10000 * Math.pow(rate, days / 365));
  });
}

export function formatAxisDate(dateStr, period) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (period === '1m' || period === '3m') {
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }
  if (period === '6m' || period === '1y') {
    return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} '${String(d.getFullYear()).slice(2)}`;
}

/** Max data points to display — longer periods get downsampled */
export const MAX_DISPLAY_POINTS = 250;

/**
 * Downsample an array of NAV points while keeping first and last.
 */
export function downsample(allData, period) {
  const isShortPeriod = period === '1m' || period === '3m';
  if (isShortPeriod || allData.length <= MAX_DISPLAY_POINTS) {
    return allData;
  }
  const step = Math.ceil(allData.length / MAX_DISPLAY_POINTS);
  const sampled = [allData[0]];
  for (let i = step; i < allData.length - 1; i += step) {
    sampled.push(allData[i]);
  }
  sampled.push(allData[allData.length - 1]);
  return sampled;
}
