import { TAU } from './math';

export const polar = (cx: number, cy: number, r: number, angleRad: number): [number, number] => [
  cx + Math.cos(angleRad) * r,
  cy + Math.sin(angleRad) * r,
];

/** SVG arc path from `start` to `end` radians (clockwise). */
export const arcPath = (cx: number, cy: number, r: number, start: number, end: number): string => {
  const sweep = Math.max(0.0001, Math.min(TAU - 0.0001, end - start));
  const [x0, y0] = polar(cx, cy, r, start);
  const [x1, y1] = polar(cx, cy, r, start + sweep);
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** stroke-dasharray props that draw `progress` (0..1) of a path with known length. */
export const drawStroke = (progress: number, length: number): { strokeDasharray: string; strokeDashoffset: number } => ({
  strokeDasharray: `${length} ${length}`,
  strokeDashoffset: length * (1 - Math.max(0, Math.min(1, progress))),
});

export const circleLength = (r: number): number => TAU * r;

/* ------------------------------------------------------------------ */
/* 2.5D camera                                                         */
/* ------------------------------------------------------------------ */

export interface Camera {
  x: number;
  y: number;
  z: number;
  /** Focal length in px: a plane at distance == focal renders at scale 1. */
  focal: number;
  /** Roll in radians. */
  roll?: number;
}

export interface Projected {
  x: number;
  y: number;
  scale: number;
  /** Distance from the camera along z (> 0 means in front). */
  depth: number;
  visible: boolean;
}

/**
 * Perspective projection of a point / plane at (x, y, z) relative to the frame center.
 * Planes are flat cards, so the whole card is scaled uniformly: "2.5D".
 */
export const project = (p: { x: number; y: number; z: number }, cam: Camera): Projected => {
  const depth = p.z - cam.z;
  if (depth <= 1) return { x: 0, y: 0, scale: 0, depth, visible: false };
  const scale = cam.focal / depth;
  let x = (p.x - cam.x) * scale;
  let y = (p.y - cam.y) * scale;
  if (cam.roll) {
    const c = Math.cos(cam.roll);
    const s = Math.sin(cam.roll);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return { x, y, scale, depth, visible: true };
};

/** Fades planes that get too close to the lens or too far into the fog. */
export const depthOpacity = (depth: number, near: number, nearFade: number, far: number, farFade: number): number => {
  if (depth <= near) return 0;
  const a = Math.min(1, (depth - near) / nearFade);
  const b = Math.min(1, Math.max(0, (far - depth) / farFade));
  return Math.max(0, Math.min(a, b));
};
