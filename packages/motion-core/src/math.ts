export const clamp = (v: number, min = 0, max = 1): number => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v: number, inMin: number, inMax: number, outMin: number, outMax: number, clamped = true): number => {
  const t = invLerp(inMin, inMax, v);
  return lerp(outMin, outMax, clamped ? clamp(t) : t);
};
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp(invLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
};
/** Fractional part, always positive. */
export const fract = (v: number): number => v - Math.floor(v);
export const TAU = Math.PI * 2;
export const degToRad = (d: number): number => (d * Math.PI) / 180;

/** Rounds to a fixed number of decimals — keeps generated CSS strings compact and stable. */
export const round = (v: number, decimals = 3): number => {
  const k = 10 ** decimals;
  return Math.round(v * k) / k;
};
