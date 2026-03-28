import { describe, it, expect } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';

describe('LensCircle component', () => {
  it('exports a default function', async () => {
    const mod = await import('../components/shared/LensCircle');
    expect(typeof mod.default).toBe('function');
  });

  it('renders with score and label', async () => {
    const { default: LensCircle } = await import('../components/shared/LensCircle');
    const { container } = render(<LensCircle score={80} label="Ret" />);
    expect(container.firstChild).toBeTruthy();
    expect(container.textContent).toContain('Ret');
  });

  it('applies sm size classes by default', async () => {
    const { default: LensCircle } = await import('../components/shared/LensCircle');
    const { container } = render(<LensCircle score={80} label="Ret" />);
    const el = container.firstChild;
    expect(el.className).toContain('w-6');
    expect(el.className).toContain('h-6');
  });

  it('applies md size classes when size="md"', async () => {
    const { default: LensCircle } = await import('../components/shared/LensCircle');
    const { container } = render(<LensCircle score={80} label="Ret" size="md" />);
    const el = container.firstChild;
    expect(el.className).toContain('w-8');
    expect(el.className).toContain('h-8');
  });

  it('sets backgroundColor style via lensColor', async () => {
    const { default: LensCircle } = await import('../components/shared/LensCircle');
    const { container } = render(<LensCircle score={80} label="Ret" />);
    const el = container.firstChild;
    // score=80 → lensColor returns '#0d9488'
    expect(el.style.backgroundColor).toBe('rgb(13, 148, 136)');
  });

  it('renders title attribute with score', async () => {
    const { default: LensCircle } = await import('../components/shared/LensCircle');
    const { container } = render(<LensCircle score={75} label="Alp" />);
    const el = container.firstChild;
    expect(el.getAttribute('title')).toBe('Alp: 75');
  });

  it('rounds score in title', async () => {
    const { default: LensCircle } = await import('../components/shared/LensCircle');
    const { container } = render(<LensCircle score={75.7} label="Con" />);
    const el = container.firstChild;
    expect(el.getAttribute('title')).toBe('Con: 76');
  });
});

describe('TierBadge component', () => {
  it('exports a default function', async () => {
    const mod = await import('../components/shared/TierBadge');
    expect(typeof mod.default).toBe('function');
  });

  it('renders tier text', async () => {
    const { default: TierBadge } = await import('../components/shared/TierBadge');
    const { container } = render(<TierBadge tier="Leader" score={80} />);
    expect(container.textContent).toContain('Leader');
  });

  it('applies backgroundColor from lensBgColor', async () => {
    const { default: TierBadge } = await import('../components/shared/TierBadge');
    const { container } = render(<TierBadge tier="Leader" score={80} />);
    const el = container.firstChild;
    // score=80 → lensBgColor returns '#E1F5EE' → rgb(225, 245, 238)
    expect(el.style.backgroundColor).toBe('rgb(225, 245, 238)');
  });

  it('applies color from lensColor', async () => {
    const { default: TierBadge } = await import('../components/shared/TierBadge');
    const { container } = render(<TierBadge tier="Leader" score={80} />);
    const el = container.firstChild;
    // score=80 → lensColor returns '#0d9488' → rgb(13, 148, 136)
    expect(el.style.color).toBe('rgb(13, 148, 136)');
  });

  it('renders as a span element', async () => {
    const { default: TierBadge } = await import('../components/shared/TierBadge');
    const { container } = render(<TierBadge tier="Weak" score={25} />);
    expect(container.firstChild.tagName.toLowerCase()).toBe('span');
  });

  it('applies pill styling classes', async () => {
    const { default: TierBadge } = await import('../components/shared/TierBadge');
    const { container } = render(<TierBadge tier="Strong" score={65} />);
    const el = container.firstChild;
    expect(el.className).toContain('rounded-full');
    expect(el.className).toContain('font-semibold');
  });
});
