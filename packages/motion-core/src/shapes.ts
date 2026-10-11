import { TAU, clamp, lerp } from './math';
import { noise1D } from './random';

/**
 * Geometry for morphing and motion paths. Every shape is produced as a polyline with the
 * same number of points, starting at the same angle and running in the same direction,
 * which is what makes any two of them interpolable point-to-point. Arbitrary SVG paths
 * are *not* supported as morph sources — only shapes from this vocabulary.
 */

export type Point = { x: number; y: number };

export const SHAPE_KINDS = ['line', 'circle', 'square', 'triangle', 'arrow', 'star', 'heart', 'wave', 'infinity', 'check', 'spark', 'chart'] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

/** Arc-length resampling of a polyline into `n` evenly spaced points. */
export const resample = (pts: readonly Point[], n: number, closed = false): Point[] => {
  const src = closed ? [...pts, pts[0]!] : [...pts];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < src.length; i++) {
    const d = Math.hypot(src[i]!.x - src[i - 1]!.x, src[i]!.y - src[i - 1]!.y);
    seg.push(d);
    total += d;
  }
  if (total === 0) return Array.from({ length: n }, () => ({ ...src[0]! }));
  const out: Point[] = [];
  const steps = closed ? n : n - 1;
  let si = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / steps) * total;
    while (si < seg.length - 1 && acc + seg[si]! < target) {
      acc += seg[si]!;
      si++;
    }
    const u = seg[si]! > 0 ? clamp((target - acc) / seg[si]!) : 0;
    out.push({ x: lerp(src[si]!.x, src[si + 1]!.x, u), y: lerp(src[si]!.y, src[si + 1]!.y, u) });
  }
  return out;
};

const polar = (cx: number, cy: number, r: number, a: number): Point => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });

/** Points of a unit-space shape (radius `r` around cx, cy), resampled to `n`. */
export const shapePoints = (kind: ShapeKind, n: number, cx: number, cy: number, r: number): Point[] => {
  const start = -Math.PI / 2;
  switch (kind) {
    case 'line':
      return resample([{ x: cx - r, y: cy }, { x: cx + r, y: cy }], n);
    case 'circle':
      return Array.from({ length: n }, (_, i) => polar(cx, cy, r, start + (i / n) * TAU));
    case 'square':
      return resample([polar(cx, cy, r * 1.25, start - Math.PI / 4), polar(cx, cy, r * 1.25, start + Math.PI / 4), polar(cx, cy, r * 1.25, start + (3 * Math.PI) / 4), polar(cx, cy, r * 1.25, start + (5 * Math.PI) / 4)], n, true);
    case 'triangle':
      return resample([0, 1, 2].map((i) => polar(cx, cy, r * 1.15, start + (i / 3) * TAU)), n, true);
    case 'star':
      return resample(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r * 0.45 : r * 1.1, start + (i / 10) * TAU)), n, true);
    case 'heart': {
      const pts = Array.from({ length: 120 }, (_, i) => {
        const t = (i / 120) * TAU;
        const x = 16 * Math.sin(t) ** 3;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        return { x: cx + (x / 17) * r, y: cy + (y / 17) * r - r * 0.05 };
      });
      return resample(pts, n, true);
    }
    case 'arrow':
      return resample(
        [
          { x: cx - r, y: cy - r * 0.18 },
          { x: cx + r * 0.25, y: cy - r * 0.18 },
          { x: cx + r * 0.25, y: cy - r * 0.55 },
          { x: cx + r, y: cy },
          { x: cx + r * 0.25, y: cy + r * 0.55 },
          { x: cx + r * 0.25, y: cy + r * 0.18 },
          { x: cx - r, y: cy + r * 0.18 },
        ],
        n,
        true,
      );
    case 'wave':
      return resample(Array.from({ length: 80 }, (_, i) => ({ x: cx - r + (i / 79) * 2 * r, y: cy + Math.sin((i / 79) * TAU * 1.5) * r * 0.35 })), n);
    case 'infinity':
      return resample(
        Array.from({ length: 120 }, (_, i) => {
          const t = (i / 120) * TAU;
          const d = 1 + Math.sin(t) ** 2;
          return { x: cx + (r * 1.2 * Math.cos(t)) / d, y: cy + (r * 1.2 * Math.sin(t) * Math.cos(t)) / d };
        }),
        n,
        true,
      );
    case 'check':
      return resample([{ x: cx - r * 0.8, y: cy }, { x: cx - r * 0.25, y: cy + r * 0.55 }, { x: cx + r * 0.85, y: cy - r * 0.6 }], n);
    case 'spark':
      return resample(Array.from({ length: 16 }, (_, i) => polar(cx, cy, i % 2 ? r * 0.18 : r * 1.1, start + (i / 16) * TAU)), n, true);
    case 'chart':
      return resample(
        [
          { x: cx - r, y: cy + r * 0.5 },
          { x: cx - r * 0.55, y: cy + r * 0.1 },
          { x: cx - r * 0.15, y: cy + r * 0.3 },
          { x: cx + r * 0.3, y: cy - r * 0.25 },
          { x: cx + r * 0.6, y: cy - r * 0.05 },
          { x: cx + r, y: cy - r * 0.6 },
        ],
        n,
      );
  }
};

export const CLOSED_SHAPES: ReadonlySet<ShapeKind> = new Set(['circle', 'square', 'triangle', 'arrow', 'star', 'heart', 'infinity', 'spark']);

/** Point-to-point interpolation of two compatible polylines (same length). */
export const lerpPoints = (a: readonly Point[], b: readonly Point[], t: number): Point[] => a.map((p, i) => ({ x: lerp(p.x, b[i]!.x, t), y: lerp(p.y, b[i]!.y, t) }));

export const pointsToPath = (pts: readonly Point[], closed = false): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + (closed ? ' Z' : '');

/** Total length of a polyline (for stroke draw). */
export const polylineLength = (pts: readonly Point[], closed = false): number => {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  if (closed && pts.length > 1) d += Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.y - pts[pts.length - 1]!.y);
  return d;
};

/** Point at arc-length fraction `u` of a polyline (motion paths). Also returns the tangent angle. */
export const pointAlong = (pts: readonly Point[], u: number): Point & { angle: number } => {
  const total = polylineLength(pts);
  let target = clamp(u) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (target <= d || i === pts.length - 1) {
      const k = d > 0 ? clamp(target / d) : 0;
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), angle: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    target -= d;
  }
  const p = pts[0]!;
  return { ...p, angle: 0 };
};

/** Cubic Bézier sampled into a polyline (motion paths with designed arcs). */
export const bezierPoints = (p0: Point, p1: Point, p2: Point, p3: Point, n = 64): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const m = 1 - t;
    return {
      x: m ** 3 * p0.x + 3 * m * m * t * p1.x + 3 * m * t * t * p2.x + t ** 3 * p3.x,
      y: m ** 3 * p0.y + 3 * m * m * t * p1.y + 3 * m * t * t * p2.y + t ** 3 * p3.y,
    };
  });

/**
 * Organic closed shape ("liquid" masks): a circle whose radius is modulated by seeded
 * noise that evolves with `t`. Deterministic for a given seed and time.
 */
export const blobPoints = (cx: number, cy: number, r: number, t: number, opts: { seed?: string; amplitude?: number; lobes?: number; n?: number } = {}): Point[] => {
  const n = opts.n ?? 96;
  const amp = opts.amplitude ?? 0.18;
  const lobes = opts.lobes ?? 3;
  const seed = opts.seed ?? 'blob';
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU;
    const k = 1 + amp * (noise1D(seed, Math.cos(a) * lobes + t * 0.9) * 0.6 + noise1D(`${seed}:b`, Math.sin(a) * lobes - t * 0.7) * 0.4);
    return { x: cx + Math.cos(a) * r * k, y: cy + Math.sin(a) * r * k };
  });
};

/** clip-path polygon() from points in px. */
export const polygonClip = (pts: readonly Point[]): string => `polygon(${pts.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`;
