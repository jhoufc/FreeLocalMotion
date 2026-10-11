import { describe, expect, it } from 'vitest';
import { SHAPE_KINDS, blobPoints, bounceAt, bounceImpacts, countValue, formatNumber, lerpPoints, pointAlong, polylineLength, resample, shapePoints, type BounceConfig } from '../src';

const ball: BounceConfig = { from: { x: 0, y: 200 }, to: { x: 1000, y: 800 }, floor: 800, height: 500, bounces: 4, elasticity: 0.55, duration: 2, anticipation: 0.3 };

describe('bounce physics', () => {
  it('starts at the launch point, ends at rest on the landing point', () => {
    expect(bounceAt(ball, 0)).toMatchObject({ x: 0 });
    const end = bounceAt(ball, 2.6);
    expect(end).toMatchObject({ x: 1000, y: 800, settled: true });
  });

  it('touches the floor at every impact and compresses there (squash)', () => {
    let prev = Infinity;
    bounceImpacts(ball).slice(0, -1).forEach((ti, i) => {
      const s = bounceAt(ball, ti);
      expect(s.y).toBeCloseTo(800, 0);
      expect(s.impact).toBeGreaterThan(i === 0 ? 0.9 : 0.5);
      expect(s.impact).toBeLessThanOrEqual(prev); // later bounces are softer
      prev = s.impact;
      expect(s.sy).toBeLessThan(0.9);
      expect(s.sx).toBeGreaterThan(1.1);
    });
  });

  it('stretches along the velocity in flight and decays bounce heights', () => {
    const impacts = bounceImpacts(ball);
    const mid = (impacts[0]! + impacts[1]!) / 2;
    const fast = bounceAt(ball, impacts[0]! + 0.03);
    expect(Math.max(fast.sx, fast.sy)).toBeGreaterThan(1);
    const apex1 = bounceAt(ball, mid).y;
    const apex2 = bounceAt(ball, (impacts[1]! + impacts[2]!) / 2).y;
    expect(800 - apex1).toBeGreaterThan(800 - apex2);
  });

  it('crouches during anticipation and is deterministic', () => {
    expect(bounceAt(ball, 0.15).sy).toBeLessThan(1);
    expect(bounceAt(ball, 1.234)).toEqual(bounceAt(ball, 1.234));
  });
});

describe('shapes and morphing', () => {
  it('every shape resamples to the same point count (compatible morphs)', () => {
    for (const k of SHAPE_KINDS) {
      const pts = shapePoints(k, 96, 0, 0, 100);
      expect(pts, k).toHaveLength(96);
      for (const p of pts) expect(Number.isFinite(p.x) && Number.isFinite(p.y), k).toBe(true);
    }
    const mid = lerpPoints(shapePoints('circle', 96, 0, 0, 100), shapePoints('star', 96, 0, 0, 100), 0.5);
    expect(mid).toHaveLength(96);
  });

  it('resamples evenly and walks motion paths', () => {
    const r = resample([{ x: 0, y: 0 }, { x: 100, y: 0 }], 11);
    expect(r[5]).toEqual({ x: 50, y: 0 });
    expect(polylineLength(r)).toBeCloseTo(100);
    expect(pointAlong(r, 0.25)).toMatchObject({ x: 25, y: 0 });
  });

  it('organic blobs evolve with time but are seeded', () => {
    const a = blobPoints(0, 0, 100, 1, { seed: 's' });
    expect(blobPoints(0, 0, 100, 1, { seed: 's' })).toEqual(a);
    expect(blobPoints(0, 0, 100, 1.5, { seed: 's' })).not.toEqual(a);
  });
});

describe('counters', () => {
  it('counts deterministically and lands exactly on the target', () => {
    expect(countValue(0, 0.5, 1, 0, 100)).toBe(0);
    expect(countValue(1.5, 0.5, 1, 0, 100)).toBe(100);
    expect(countValue(1, 0.5, 1, 0, 100)).toBeGreaterThan(50);
    expect(formatNumber(12500.5, { decimals: 1, separator: 'dot' })).toBe('12.500,5');
  });
});
