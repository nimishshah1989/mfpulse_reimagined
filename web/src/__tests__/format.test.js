import { formatINR, formatAUM, formatPct, formatScore, formatCount } from '../lib/format';

describe('formatINR', () => {
  test('formats with Indian grouping', () => {
    expect(formatINR(123456789, 0)).toBe('\u20B912,34,56,789');
  });

  test('formats small numbers', () => {
    expect(formatINR(1234.56)).toBe('\u20B91,234.56');
  });

  test('handles negative numbers with minus sign', () => {
    expect(formatINR(-5000, 0)).toBe('\u2212\u20B95,000');
  });

  test('handles null', () => {
    expect(formatINR(null)).toBe('\u2014');
  });

  test('handles undefined', () => {
    expect(formatINR(undefined)).toBe('\u2014');
  });

  test('handles zero', () => {
    expect(formatINR(0, 0)).toBe('\u20B90');
  });

  test('handles string numbers from Decimal serialization', () => {
    expect(formatINR('250000', 0)).toBe('\u20B92,50,000');
  });
});

describe('formatAUM', () => {
  test('formats crores', () => {
    expect(formatAUM(1500)).toBe('\u20B91500Cr');
  });

  test('formats small crore amounts', () => {
    expect(formatAUM(5.5)).toBe('\u20B95.5Cr');
  });

  test('formats lakhs', () => {
    expect(formatAUM(0.5)).toBe('\u20B950.0L');
  });

  test('handles null', () => {
    expect(formatAUM(null)).toBe('\u2014');
  });
});

describe('formatPct', () => {
  test('formats positive percentage', () => {
    expect(formatPct(18.4)).toBe('+18.4%');
  });

  test('formats negative percentage with minus sign', () => {
    expect(formatPct(-3.2)).toBe('\u22123.2%');
  });

  test('formats zero as positive', () => {
    expect(formatPct(0)).toBe('+0.0%');
  });

  test('handles null', () => {
    expect(formatPct(null)).toBe('\u2014');
  });

  test('handles string numbers from Decimal serialization', () => {
    expect(formatPct('12.34')).toBe('+12.3%');
  });
});

describe('formatScore', () => {
  test('rounds to integer', () => {
    expect(formatScore(84.6)).toBe('85');
  });

  test('handles null', () => {
    expect(formatScore(null)).toBe('\u2014');
  });

  test('handles string numbers', () => {
    expect(formatScore('72.3')).toBe('72');
  });
});

describe('formatCount', () => {
  test('formats with Indian locale', () => {
    expect(formatCount(3124)).toBe('3,124');
  });

  test('handles null', () => {
    expect(formatCount(null)).toBe('0');
  });
});
