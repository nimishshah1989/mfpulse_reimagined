import { describe, it, expect } from '@jest/globals';
import { lensColor, lensLabel, lensBgColor, momentumColor } from '../lib/lens';

describe('lensColor', () => {
  it('returns deep teal for score >= 90', () => {
    expect(lensColor(90)).toBe('#085041');
    expect(lensColor(100)).toBe('#085041');
    expect(lensColor(95)).toBe('#085041');
  });

  it('returns teal for score >= 70 and < 90', () => {
    expect(lensColor(70)).toBe('#0d9488');
    expect(lensColor(89)).toBe('#0d9488');
    expect(lensColor(75)).toBe('#0d9488');
  });

  it('returns light teal for score >= 50 and < 70', () => {
    expect(lensColor(50)).toBe('#5DCAA5');
    expect(lensColor(69)).toBe('#5DCAA5');
    expect(lensColor(60)).toBe('#5DCAA5');
  });

  it('returns amber for score >= 30 and < 50', () => {
    expect(lensColor(30)).toBe('#BA7517');
    expect(lensColor(49)).toBe('#BA7517');
    expect(lensColor(40)).toBe('#BA7517');
  });

  it('returns red for score < 30', () => {
    expect(lensColor(29)).toBe('#E24B4A');
    expect(lensColor(0)).toBe('#E24B4A');
    expect(lensColor(10)).toBe('#E24B4A');
  });
});

describe('lensLabel', () => {
  it('returns Exceptional for score >= 90', () => {
    expect(lensLabel(90)).toBe('Exceptional');
    expect(lensLabel(100)).toBe('Exceptional');
    expect(lensLabel(95)).toBe('Exceptional');
  });

  it('returns Leader for score >= 75 and < 90', () => {
    expect(lensLabel(75)).toBe('Leader');
    expect(lensLabel(89)).toBe('Leader');
    expect(lensLabel(80)).toBe('Leader');
  });

  it('returns Strong for score >= 60 and < 75', () => {
    expect(lensLabel(60)).toBe('Strong');
    expect(lensLabel(74)).toBe('Strong');
    expect(lensLabel(67)).toBe('Strong');
  });

  it('returns Adequate for score >= 45 and < 60', () => {
    expect(lensLabel(45)).toBe('Adequate');
    expect(lensLabel(59)).toBe('Adequate');
    expect(lensLabel(52)).toBe('Adequate');
  });

  it('returns Weak for score >= 30 and < 45', () => {
    expect(lensLabel(30)).toBe('Weak');
    expect(lensLabel(44)).toBe('Weak');
    expect(lensLabel(37)).toBe('Weak');
  });

  it('returns Poor for score < 30', () => {
    expect(lensLabel(29)).toBe('Poor');
    expect(lensLabel(0)).toBe('Poor');
    expect(lensLabel(10)).toBe('Poor');
  });
});

describe('lensBgColor', () => {
  it('returns light green for score >= 50', () => {
    expect(lensBgColor(50)).toBe('#E1F5EE');
    expect(lensBgColor(100)).toBe('#E1F5EE');
    expect(lensBgColor(75)).toBe('#E1F5EE');
  });

  it('returns light amber for score >= 30 and < 50', () => {
    expect(lensBgColor(30)).toBe('#FAEEDA');
    expect(lensBgColor(49)).toBe('#FAEEDA');
    expect(lensBgColor(40)).toBe('#FAEEDA');
  });

  it('returns light red for score < 30', () => {
    expect(lensBgColor(29)).toBe('#FCEBEB');
    expect(lensBgColor(0)).toBe('#FCEBEB');
    expect(lensBgColor(10)).toBe('#FCEBEB');
  });
});

describe('momentumColor', () => {
  it('returns deep teal for momentum >= 5', () => {
    expect(momentumColor(5)).toBe('#085041');
    expect(momentumColor(10)).toBe('#085041');
    expect(momentumColor(7)).toBe('#085041');
  });

  it('returns teal for momentum >= 2 and < 5', () => {
    expect(momentumColor(2)).toBe('#0d9488');
    expect(momentumColor(4)).toBe('#0d9488');
    expect(momentumColor(3)).toBe('#0d9488');
  });

  it('returns light teal for momentum >= 0 and < 2', () => {
    expect(momentumColor(0)).toBe('#5DCAA5');
    expect(momentumColor(1)).toBe('#5DCAA5');
    expect(momentumColor(1.5)).toBe('#5DCAA5');
  });

  it('returns amber for momentum >= -2 and < 0', () => {
    expect(momentumColor(-1)).toBe('#BA7517');
    expect(momentumColor(-2)).toBe('#BA7517');
    expect(momentumColor(-0.5)).toBe('#BA7517');
  });

  it('returns red for momentum < -2', () => {
    expect(momentumColor(-3)).toBe('#E24B4A');
    expect(momentumColor(-10)).toBe('#E24B4A');
    expect(momentumColor(-2.1)).toBe('#E24B4A');
  });
});
