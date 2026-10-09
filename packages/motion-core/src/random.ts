import { fract, lerp } from './math';

/** FNV-1a string hash -> uint32. */
export const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const toSeed = (seed: string | number): number => (typeof seed === 'number' ? seed >>> 0 : hashString(seed));

/** Mulberry32 PRNG. Same seed -> same sequence, on every machine and every frame. */
export const createRng = (seed: string | number) => {
  let a = toSeed(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stateless random in [0,1) for (seed, index). */
export const randomAt = (seed: string | number, index: number): number => {
  let h = Math.imul(toSeed(seed) ^ Math.imul(index + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const randomRange = (seed: string | number, index: number, min: number, max: number): number =>
  lerp(min, max, randomAt(seed, index));

/** Smooth 1D value noise in [-1, 1]. Deterministic for a given seed. */
export const noise1D = (seed: string | number, x: number): number => {
  const i = Math.floor(x);
  const f = fract(x);
  const u = f * f * (3 - 2 * f);
  const a = randomAt(seed, i) * 2 - 1;
  const b = randomAt(seed, i + 1) * 2 - 1;
  return lerp(a, b, u);
};

/** Fractal (2 octave) 1D noise, nicer for organic drift. */
export const drift = (seed: string | number, x: number): number => noise1D(seed, x) * 0.7 + noise1D(`${seed}:2`, x * 2.13) * 0.3;
