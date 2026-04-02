import { describe, it, expect } from '@jest/globals';
import {
  computeStartDate,
  assemblePayload,
  resampleTimeline,
  getSignalColor,
  findBestMode,
  SIGNAL_COLORS,
  MODE_COLORS,
  MODE_LABELS,
  DEFAULT_CONFIG,
  EMPTY_RULE,
} from '../lib/simulation';

describe('computeStartDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = computeStartDate('5Y');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('5Y is approximately 5 years before today', () => {
    const result = new Date(computeStartDate('5Y'));
    const now = new Date();
    const diffYears = (now - result) / (365.25 * 24 * 3600 * 1000);
    expect(diffYears).toBeCloseTo(5, 1);
  });

  it('10Y is approximately 10 years before today', () => {
    const result = new Date(computeStartDate('10Y'));
    const now = new Date();
    const diffYears = (now - result) / (365.25 * 24 * 3600 * 1000);
    expect(diffYears).toBeCloseTo(10, 1);
  });

  it('defaults to 5Y for unknown period', () => {
    const result = new Date(computeStartDate('unknown'));
    const now = new Date();
    const diffYears = (now - result) / (365.25 * 24 * 3600 * 1000);
    expect(diffYears).toBeCloseTo(5, 1);
  });
});

describe('assemblePayload', () => {
  const fund = { mstar_id: 'F001' };
  const config = { sipAmount: 10000, sipDay: 5, lumpsumAmount: 500000, lumpsumDeployPct: 25 };
  const rules = [EMPTY_RULE];

  it('returns null when fund is null', () => {
    expect(assemblePayload(null, config, rules, '5Y')).toBeNull();
  });

  it('assembles correct payload shape', () => {
    const payload = assemblePayload(fund, config, rules, '5Y');
    expect(payload.mstar_id).toBe('F001');
    expect(payload.sip_amount).toBe(10000);
    expect(payload.sip_day).toBe(5);
    expect(payload.lumpsum_amount).toBe(500000);
    expect(payload.lumpsum_deploy_pct).toBe(25);
    expect(payload.signal_rules).toEqual(rules);
    expect(payload.start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('resampleTimeline', () => {
  it('returns original if below target', () => {
    const data = [1, 2, 3];
    expect(resampleTimeline(data, 120)).toEqual(data);
  });

  it('returns empty array for null', () => {
    expect(resampleTimeline(null)).toEqual([]);
  });

  it('resamples large arrays', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i);
    const result = resampleTimeline(data, 120);
    expect(result.length).toBeLessThanOrEqual(130);
    expect(result.length).toBeGreaterThanOrEqual(100);
    // Last element is always included
    expect(result[result.length - 1]).toBe(999);
  });
});

describe('getSignalColor', () => {
  it('maps breadth to red', () => {
    expect(getSignalColor('breadth_21ema')).toBe(SIGNAL_COLORS.breadth);
  });

  it('maps sentiment to amber', () => {
    expect(getSignalColor('sentiment_composite')).toBe(SIGNAL_COLORS.sentiment);
  });

  it('maps vix to purple', () => {
    expect(getSignalColor('vix_level')).toBe(SIGNAL_COLORS.vix);
  });

  it('maps sector to teal', () => {
    expect(getSignalColor('sector_rotation')).toBe(SIGNAL_COLORS.sector);
  });

  it('returns slate for unknown trigger', () => {
    expect(getSignalColor('unknown')).toBe('#94a3b8');
  });

  it('handles null trigger', () => {
    expect(getSignalColor(null)).toBe('#94a3b8');
  });
});

describe('findBestMode', () => {
  it('returns null when results is null', () => {
    expect(findBestMode(null)).toBeNull();
  });

  it('finds mode with highest XIRR', () => {
    const results = {
      SIP: { summary: { xirr_pct: 12 } },
      SIP_SIGNAL: { summary: { xirr_pct: 18 } },
      LUMPSUM: { summary: { xirr_pct: 15 } },
      HYBRID: { summary: { xirr_pct: 16 } },
    };
    expect(findBestMode(results)).toBe('SIP_SIGNAL');
  });

  it('handles flat xirr_pct (no summary wrapper)', () => {
    const results = {
      SIP: { xirr_pct: 10 },
      SIP_SIGNAL: { xirr_pct: 20 },
    };
    expect(findBestMode(results)).toBe('SIP_SIGNAL');
  });
});

describe('constants', () => {
  it('MODE_COLORS has 4 entries', () => {
    expect(Object.keys(MODE_COLORS)).toHaveLength(4);
  });

  it('MODE_LABELS has human-readable names', () => {
    expect(MODE_LABELS.SIP).toBe('Pure SIP');
    expect(MODE_LABELS.HYBRID).toBe('Hybrid');
  });

  it('DEFAULT_CONFIG has valid defaults', () => {
    expect(DEFAULT_CONFIG.sipAmount).toBe(10000);
    expect(DEFAULT_CONFIG.autoSimulate).toBe(true);
  });
});
