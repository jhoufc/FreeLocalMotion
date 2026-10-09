import { Easing } from 'remotion';

export type EasingFn = (t: number) => number;

/**
 * Curated easing vocabulary. Motion with identity comes from few, consistent curves:
 * `cinematic` for most entrances, `snap` for decisive moves, `back` for overshoot.
 */
export const ease = {
  linear: (t: number) => t,
  /** Fast start, long elegant settle. The house curve. */
  cinematic: Easing.bezier(0.16, 1, 0.3, 1),
  /** Anticipation-free hard cut feel, for camera moves and wipes. */
  snap: Easing.bezier(0.7, 0, 0.2, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  outQuart: (t: number) => 1 - (1 - t) ** 4,
  inQuart: (t: number) => t ** 4,
  inOutQuart: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t ** 3,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  /** Overshoot. `s` ~1.2 is subtle, ~2.5 is bouncy. */
  back:
    (s = 1.4): EasingFn =>
    (t: number) => {
      const c3 = s + 1;
      return 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2;
    },
  /** Pulls back before moving forward. */
  anticipate:
    (s = 1.2): EasingFn =>
    (t: number) =>
      t * t * ((s + 1) * t - s),
} as const;

export type NamedEasing = Exclude<keyof typeof ease, 'back' | 'anticipate'>;
