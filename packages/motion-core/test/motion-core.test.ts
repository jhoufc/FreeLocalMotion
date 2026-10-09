import { describe, expect, it } from 'vitest';
import { SPRINGS, ease, keyframes, layoutText, noise1D, progress, randomAt, splitByMode, springAt, springWithIntensity, stagger, velocityOf } from '../src';

describe('spring (closed form)', () => {
  it('starts at 0 and settles at 1', () => {
    expect(springAt(0)).toBe(0);
    expect(springAt(-1)).toBe(0);
    expect(springAt(3, SPRINGS.type)).toBeCloseTo(1, 4);
    expect(springAt(5, SPRINGS.heavy)).toBeCloseTo(1, 3);
  });

  it('overshoots when underdamped and never when critical', () => {
    const peak = (cfg: Parameters<typeof springAt>[1]) => Math.max(...Array.from({ length: 300 }, (_, i) => springAt(i / 100, cfg)));
    expect(peak(SPRINGS.bouncy)).toBeGreaterThan(1.05);
    expect(peak(SPRINGS.critical)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('is frame-rate independent: same time -> same value at 30 and 60 fps', () => {
    for (let f = 0; f < 60; f++) expect(springAt(f / 30)).toBe(springAt((f * 2) / 60));
  });

  it('intensity 0 removes overshoot', () => {
    const values = Array.from({ length: 300 }, (_, i) => springWithIntensity(i / 100, SPRINGS.bouncy, 0));
    expect(Math.max(...values)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('reports velocity', () => {
    expect(velocityOf((t) => t * 10, 0.5)).toBeCloseTo(10, 5);
  });
});

describe('tweening', () => {
  it('clamps progress', () => {
    expect(progress(-1, 0, 1)).toBe(0);
    expect(progress(0.5, 0, 1)).toBe(0.5);
    expect(progress(2, 0, 1)).toBe(1);
    expect(progress(1, 1, 0)).toBe(1);
  });
  it('evaluates multi-segment keyframes', () => {
    const k = [
      [0, 0],
      [1, 10, ease.linear],
      [2, 0, ease.linear],
    ] as const;
    expect(keyframes(-1, k)).toBe(0);
    expect(keyframes(0.5, k)).toBe(5);
    expect(keyframes(1.5, k)).toBe(5);
    expect(keyframes(9, k)).toBe(0);
  });
  it('back easing overshoots and lands on 1', () => {
    const b = ease.back(1.7);
    expect(b(1)).toBeCloseTo(1, 10);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => b(i / 100)))).toBeGreaterThan(1);
  });
});

describe('determinism', () => {
  it('seeded random is stable and uniform-ish', () => {
    expect(randomAt('seed', 3)).toBe(randomAt('seed', 3));
    expect(randomAt('seed', 3)).not.toBe(randomAt('seed', 4));
    const avg = Array.from({ length: 2000 }, (_, i) => randomAt('x', i)).reduce((a, b) => a + b, 0) / 2000;
    expect(avg).toBeGreaterThan(0.45);
    expect(avg).toBeLessThan(0.55);
  });
  it('noise is continuous and bounded', () => {
    const a = noise1D('n', 1.2);
    const b = noise1D('n', 1.2001);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
    for (let i = 0; i < 200; i++) expect(Math.abs(noise1D('n', i * 0.37))).toBeLessThanOrEqual(1);
  });
  it('stagger origins', () => {
    expect(stagger(0, 5, { each: 0.1 })).toBe(0);
    expect(stagger(4, 5, { each: 0.1 })).toBeCloseTo(0.4);
    expect(stagger(4, 5, { each: 0.1, from: 'end' })).toBe(0);
    expect(stagger(2, 5, { each: 0.1, from: 'center' })).toBe(0);
  });
});

describe('text layout', () => {
  const font = { family: 'Test', weight: 900, stretch: 'expanded' as const };
  it('splits by line-break mode', () => {
    expect(splitByMode('Motion without\nlimits.', 'manual')).toEqual(['Motion without', 'limits.']);
    expect(splitByMode('Motion without\nlimits.', 'single')).toEqual(['Motion without limits.']);
    expect(splitByMode('Motion  without\nlimits.', 'words')).toEqual(['Motion', 'without', 'limits.']);
  });
  it('never exceeds the box: shrinks long text to fit', () => {
    const base = { mode: 'single' as const, font, uppercase: true, trackingEm: 0, size: 200, maxWidth: 900, lineHeight: 0.9 };
    const short = layoutText({ ...base, content: 'Hi' });
    const long = layoutText({ ...base, content: 'An extremely long headline that would overflow' });
    expect(short.fontSize).toBe(200);
    expect(long.fontSize).toBeLessThan(200);
    expect(long.width).toBeLessThanOrEqual(900 + 1e-6);
  });
  it('respects max height', () => {
    const r = layoutText({ content: 'a b c d e f', mode: 'words', font, uppercase: false, trackingEm: 0, size: 300, maxWidth: 5000, maxHeight: 600, lineHeight: 1 });
    expect(r.lines).toHaveLength(6);
    expect(r.height).toBeLessThanOrEqual(600 + 1e-6);
  });
  it('auto mode wraps greedily', () => {
    const r = layoutText({ content: 'one two three four five six', mode: 'auto', font, uppercase: false, trackingEm: 0, size: 100, maxWidth: 800, lineHeight: 1 });
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.width).toBeLessThanOrEqual(800 + 1e-6);
  });
});
