import { describe, it, expect } from '@jest/globals';
import { deriveActionCards, getMarketSummary } from '../lib/signals';

describe('deriveActionCards', () => {
  it('returns neutral card when no data provided', () => {
    const cards = deriveActionCards({});
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe('neutral');
    expect(cards[0].severity).toBe('green');
  });

  it('returns breadth-high card when breadth > 55', () => {
    const cards = deriveActionCards({ breadth: { pct_above_21ema: 65 } });
    expect(cards.some((c) => c.id === 'breadth-high')).toBe(true);
    expect(cards.find((c) => c.id === 'breadth-high').severity).toBe('green');
  });

  it('returns breadth-low card when breadth < 40', () => {
    const cards = deriveActionCards({ breadth: { pct_above_21ema: 30 } });
    expect(cards.some((c) => c.id === 'breadth-low')).toBe(true);
    expect(cards.find((c) => c.id === 'breadth-low').severity).toBe('red');
  });

  it('handles nested breadth structure', () => {
    const cards = deriveActionCards({ breadth: { current: { pct_above_21ema: 70 } } });
    expect(cards.some((c) => c.id === 'breadth-high')).toBe(true);
  });

  it('returns sentiment-fear card when sentiment < 30', () => {
    const cards = deriveActionCards({ sentiment: { composite_score: 20 } });
    expect(cards.some((c) => c.id === 'sentiment-fear')).toBe(true);
    expect(cards.find((c) => c.id === 'sentiment-fear').severity).toBe('green');
  });

  it('returns sentiment-euphoria card when sentiment > 75', () => {
    const cards = deriveActionCards({ sentiment: { score: 85 } });
    expect(cards.some((c) => c.id === 'sentiment-euphoria')).toBe(true);
    expect(cards.find((c) => c.id === 'sentiment-euphoria').severity).toBe('amber');
  });

  it('returns sector cards for Leading quadrant', () => {
    const cards = deriveActionCards({
      sectors: [
        { sector_name: 'IT', quadrant: 'Leading', rs_score: 78 },
        { sector_name: 'Pharma', quadrant: 'Lagging', rs_score: 30 },
      ],
    });
    expect(cards.some((c) => c.id === 'sector-IT')).toBe(true);
    expect(cards.some((c) => c.id === 'sector-Pharma')).toBe(false);
  });

  it('includes fund suggestions from topFundsByLens', () => {
    const cards = deriveActionCards({
      breadth: { pct_above_21ema: 70 },
      topFundsByLens: {
        return_score: [
          { mstar_id: 'F001', fund_name: 'Fund A' },
          { mstar_id: 'F002', fund_name: 'Fund B' },
          { mstar_id: 'F003', fund_name: 'Fund C' },
          { mstar_id: 'F004', fund_name: 'Fund D' },
        ],
      },
    });
    const card = cards.find((c) => c.id === 'breadth-high');
    expect(card.funds).toHaveLength(3);
  });

  it('returns multiple cards when multiple signals fire', () => {
    const cards = deriveActionCards({
      breadth: { pct_above_21ema: 70 },
      sentiment: { composite_score: 20 },
      sectors: [{ sector_name: 'Banks', quadrant: 'Leading', rs_score: 80 }],
    });
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('each card has required fields', () => {
    const cards = deriveActionCards({ breadth: { pct_above_21ema: 60 } });
    cards.forEach((card) => {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('severity');
      expect(card).toHaveProperty('title');
      expect(card).toHaveProperty('description');
      expect(card).toHaveProperty('actions');
    });
  });
});

describe('getMarketSummary', () => {
  it('returns Unknown for missing regime', () => {
    const summary = getMarketSummary(null, null, null);
    expect(summary.regimeLabel).toBe('Unknown');
    expect(summary.breadthPct).toBeNull();
    expect(summary.sentimentScore).toBeNull();
  });

  it('extracts regime label', () => {
    const summary = getMarketSummary({ regime_label: 'Bullish' }, null, null);
    expect(summary.regimeLabel).toBe('Bullish');
  });

  it('extracts breadth from flat structure', () => {
    const summary = getMarketSummary(null, { pct_above_21ema: 62 }, null);
    expect(summary.breadthPct).toBe(62);
  });

  it('extracts breadth from nested structure', () => {
    const summary = getMarketSummary(null, { current: { pct_above_21ema: 55 } }, null);
    expect(summary.breadthPct).toBe(55);
  });

  it('extracts sentiment from composite_score', () => {
    const summary = getMarketSummary(null, null, { composite_score: 45 });
    expect(summary.sentimentScore).toBe(45);
  });

  it('extracts sentiment from score fallback', () => {
    const summary = getMarketSummary(null, null, { score: 60 });
    expect(summary.sentimentScore).toBe(60);
  });
});
