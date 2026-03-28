import { describe, it, expect } from '@jest/globals';
import { generateVerdict } from '../components/fund360/VerdictGenerator';

const HIGH_SCORE_FUND = {
  return_score: 88,
  risk_score: 82,
  consistency_score: 90,
  alpha_score: 78,
  efficiency_score: 85,
  resilience_score: 92,
};

const LOW_SCORE_FUND = {
  return_score: 22,
  risk_score: 18,
  consistency_score: 25,
  alpha_score: 20,
  efficiency_score: 15,
  resilience_score: 28,
};

const MIXED_FUND = {
  return_score: 80,
  risk_score: 30,
  consistency_score: 72,
  alpha_score: 25,
  efficiency_score: 65,
  resilience_score: 45,
};

const EXPENSIVE_FUND = {
  return_score: 70,
  risk_score: 68,
  consistency_score: 65,
  alpha_score: 72,
  efficiency_score: 35,
  resilience_score: 60,
};

describe('generateVerdict', () => {
  describe('high-score fund', () => {
    it('returns a non-empty string', () => {
      const result = generateVerdict(HIGH_SCORE_FUND);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('mentions strong character for high avg score', () => {
      const result = generateVerdict(HIGH_SCORE_FUND);
      expect(result).toMatch(/strong|exceptional|leader/i);
    });

    it('recommends core allocation for avg > 70', () => {
      const result = generateVerdict(HIGH_SCORE_FUND);
      expect(result).toMatch(/core allocation/i);
    });

    it('highlights top strengths', () => {
      const result = generateVerdict(HIGH_SCORE_FUND);
      // resilience_score=92 and consistency_score=90 are top 2
      expect(result).toMatch(/downside protection|consistent delivery/i);
    });
  });

  describe('low-score fund', () => {
    it('returns a string', () => {
      const result = generateVerdict(LOW_SCORE_FUND);
      expect(typeof result).toBe('string');
    });

    it('mentions below-average character', () => {
      const result = generateVerdict(LOW_SCORE_FUND);
      expect(result).toMatch(/below.?average/i);
    });

    it('recommends switching for avg < 50', () => {
      const result = generateVerdict(LOW_SCORE_FUND);
      expect(result).toMatch(/switch|consider alternatives/i);
    });

    it('flags high cost drag when efficiency < 40', () => {
      const result = generateVerdict(LOW_SCORE_FUND);
      expect(result).toMatch(/cost drag|expense/i);
    });
  });

  describe('mixed fund', () => {
    it('returns a string', () => {
      const result = generateVerdict(MIXED_FUND);
      expect(typeof result).toBe('string');
    });

    it('mentions adequate character for avg 55-75', () => {
      const result = generateVerdict(MIXED_FUND);
      // avg = (80+30+72+25+65+45)/6 = 52.8 — below-average
      expect(result).toMatch(/below.?average|adequate/i);
    });

    it('highlights the weakness of low alpha and risk', () => {
      const result = generateVerdict(MIXED_FUND);
      // alpha_score=25 and risk_score=30 are weakest
      expect(result).toMatch(/manager skill|volatility/i);
    });
  });

  describe('expensive fund', () => {
    it('flags cost drag when efficiency_score < 40', () => {
      const result = generateVerdict(EXPENSIVE_FUND);
      expect(result).toMatch(/cost drag|expense/i);
    });

    it('still produces a verdict string', () => {
      expect(typeof generateVerdict(EXPENSIVE_FUND)).toBe('string');
    });
  });

  describe('null/missing handling', () => {
    it('handles null scores gracefully', () => {
      const fund = {
        return_score: null,
        risk_score: null,
        consistency_score: null,
        alpha_score: null,
        efficiency_score: null,
        resilience_score: null,
      };
      expect(() => generateVerdict(fund)).not.toThrow();
      expect(typeof generateVerdict(fund)).toBe('string');
    });

    it('handles missing keys gracefully', () => {
      expect(() => generateVerdict({})).not.toThrow();
      expect(typeof generateVerdict({})).toBe('string');
    });

    it('handles undefined input gracefully', () => {
      expect(() => generateVerdict(undefined)).not.toThrow();
      expect(typeof generateVerdict(undefined)).toBe('string');
    });

    it('handles partial scores', () => {
      const fund = { return_score: 80, consistency_score: 70 };
      expect(() => generateVerdict(fund)).not.toThrow();
      expect(typeof generateVerdict(fund)).toBe('string');
    });
  });
});
