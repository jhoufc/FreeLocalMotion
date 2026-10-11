import { clamp, lerp } from './math';
import { ease } from './easing';

/**
 * Stylized bounce physics as a pure function of time (seconds): parabolic arcs between
 * impact points, heights decaying by `elasticity`, an anticipation crouch before launch
 * and squash & stretch derived from velocity and impacts. Same result at any fps or seek.
 */
export interface BounceConfig {
  /** Launch point (where the anticipation happens) and landing point (where it settles). */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Y of the floor the ball bounces on (screen space, y grows downwards). */
  floor: number;
  /** Height of the first arc above the floor (px). */
  height: number;
  /** Number of impacts before settling (≥ 1). */
  bounces: number;
  /** 0..1 — how much height each bounce keeps. */
  elasticity: number;
  /** Seconds from launch to final rest. */
  duration: number;
  /** Seconds of anticipation crouch before launch. */
  anticipation?: number;
}

export interface BounceState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Scale along the motion direction / across it (squash & stretch). */
  sx: number;
  sy: number;
  /** Rotation (deg) that aligns the stretch with the velocity. */
  rotate: number;
  /** 0..1 strength of the current impact (for dust, flashes…). */
  impact: number;
  /** Index of the current arc (-1 during anticipation), `bounces` once settled. */
  arc: number;
  settled: boolean;
}

interface Arc {
  t0: number;
  t1: number;
  x0: number;
  x1: number;
  h: number;
}

const buildArcs = (c: BounceConfig): Arc[] => {
  const n = Math.max(1, Math.round(c.bounces));
  const heights = Array.from({ length: n }, (_, i) => c.height * c.elasticity ** i);
  // Arc time ∝ sqrt(height) (ballistics), distance per arc ∝ arc time.
  const w = heights.map((h) => Math.sqrt(Math.max(1, h)));
  const total = w.reduce((a, b) => a + b, 0);
  const arcs: Arc[] = [];
  let t = 0;
  let x = c.from.x;
  for (let i = 0; i < n; i++) {
    const dt = (w[i]! / total) * c.duration;
    const dx = (w[i]! / total) * (c.to.x - c.from.x);
    arcs.push({ t0: t, t1: t + dt, x0: x, x1: x + dx, h: heights[i]! });
    t += dt;
    x += dx;
  }
  return arcs;
};

const position = (c: BounceConfig, arcs: Arc[], t: number) => {
  const first = arcs[0]!;
  const last = arcs[arcs.length - 1]!;
  if (t <= 0) {
    // The first arc starts at `from.y` (not the floor): a launch from a height.
    return { x: c.from.x, y: c.from.y, arc: -1 };
  }
  if (t >= last.t1) return { x: c.to.x, y: c.to.y, arc: arcs.length };
  const i = arcs.findIndex((a) => t < a.t1);
  const a = arcs[i]!;
  const u = (t - a.t0) / (a.t1 - a.t0);
  const x = lerp(a.x0, a.x1, u);
  if (i === 0) {
    // Launch arc: from the start height up to the apex, down to the floor.
    const apex = Math.min(c.from.y, c.floor) - first.h * 0.35;
    const y = u < 0.35 ? lerp(c.from.y, apex, ease.outCubic(u / 0.35)) : lerp(apex, c.floor, ease.inCubic((u - 0.35) / 0.65));
    return { x, y, arc: 0 };
  }
  // Symmetric parabola above the floor; the last arc lands on `to.y` (usually the floor).
  const end = i === arcs.length - 1 ? c.to.y : c.floor;
  const base = lerp(c.floor, end, u);
  return { x, y: base - 4 * a.h * u * (1 - u), arc: i };
};

export const bounceAt = (c: BounceConfig, tSeconds: number, intensity = 1): BounceState => {
  const ant = c.anticipation ?? 0;
  const arcs = buildArcs(c);
  const t = tSeconds - ant;
  const dt = 1 / 240;
  const p = position(c, arcs, t);
  const p0 = position(c, arcs, t - dt);
  const p1 = position(c, arcs, t + dt);
  const vx = (p1.x - p0.x) / (2 * dt);
  const vy = (p1.y - p0.y) / (2 * dt);
  const speed = Math.hypot(vx, vy);
  const settled = t >= arcs[arcs.length - 1]!.t1;

  // Impact: how close we are to an arc boundary (contact frames compress the ball).
  let impact = 0;
  for (let i = 1; i < arcs.length; i++) impact = Math.max(impact, 1 - clamp(Math.abs(t - arcs[i]!.t0) / 0.06));
  const landing = arcs[arcs.length - 1]!.t1;
  if (t > landing - 0.06) impact = Math.max(impact, (1 - clamp(Math.abs(t - landing) / 0.08)) * 0.8);
  impact *= clamp(1 - Math.max(0, p.arc - 1) * 0.18, 0.3, 1);

  // Anticipation: crouch (squash) before launch, released into the first stretch.
  const crouch = ant > 0 && tSeconds < ant ? Math.sin(Math.PI * clamp(tSeconds / ant)) * 0.9 : 0;
  // Settle: decaying wobble after rest (follow-through).
  const since = settled ? t - landing : 0;
  const wobble = settled ? Math.exp(-since * 9) * Math.sin(since * 34) * 0.16 : 0;

  const stretch = clamp(speed / 3500) * 0.45 * intensity;
  const squash = (impact * 0.42 + crouch * 0.28) * intensity;
  // Stretch is along the velocity; squash flattens against the floor.
  const along = 1 + stretch - squash * 0.2;
  const across = 1 / Math.sqrt(Math.max(0.2, along));
  const sx = (speed > 30 && impact < 0.3 ? along : 1 + squash) * (1 + wobble);
  const sy = (speed > 30 && impact < 0.3 ? across : 1 - squash) * (1 - wobble);
  const rotate = speed > 30 && impact < 0.3 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;
  return { x: p.x, y: p.y + crouch * 6, vx, vy, sx, sy, rotate, impact, arc: p.arc, settled };
};

/** Impact times (seconds, including anticipation) — for syncing dust, sound cues, flashes. */
export const bounceImpacts = (c: BounceConfig): number[] => buildArcs(c).map((a) => a.t1 + (c.anticipation ?? 0));
