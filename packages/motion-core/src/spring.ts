/**
 * Closed-form damped harmonic oscillator from 0 to 1.
 *
 * Unlike step-integrated springs, this is a pure function of time in seconds, so it is
 * identical at 30 fps, 60 fps or when seeking to an arbitrary frame.
 */
export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export const SPRINGS = {
  /** Subtle overshoot, settles quickly. Default for typography. */
  type: { stiffness: 210, damping: 20, mass: 1 },
  /** Heavier, cinematic settle. */
  heavy: { stiffness: 120, damping: 18, mass: 1.4 },
  /** Snappy UI-like motion. */
  snappy: { stiffness: 420, damping: 32, mass: 1 },
  /** Noticeably bouncy, for accents. */
  bouncy: { stiffness: 260, damping: 12, mass: 1 },
  /** No overshoot. */
  critical: { stiffness: 200, damping: 2 * Math.sqrt(200), mass: 1 },
} as const satisfies Record<string, Required<SpringConfig>>;

export const springAt = (t: number, config: SpringConfig = SPRINGS.type): number => {
  if (t <= 0) return 0;
  const k = config.stiffness ?? 170;
  const c = config.damping ?? 26;
  const m = config.mass ?? 1;
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  const c2 = r1 / (r1 - r2);
  const c1 = 1 - c2;
  return 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
};

/**
 * Spring with an "intensity" knob: 0 = no overshoot (critically damped), 1 = config as
 * given, up to 2 = twice the overshoot. Lets editors expose overshoot safely.
 */
export const springWithIntensity = (t: number, config: SpringConfig, intensity: number): number => {
  const base = springAt(t, config);
  const critical = springAt(t, {
    stiffness: config.stiffness ?? 170,
    mass: config.mass ?? 1,
    damping: 2 * Math.sqrt((config.stiffness ?? 170) * (config.mass ?? 1)),
  });
  return critical + (base - critical) * intensity;
};

/** Numerical derivative (units per second). Used for velocity-driven motion blur. */
export const velocityOf = (fn: (t: number) => number, t: number, dt = 1 / 240): number => (fn(t + dt) - fn(t - dt)) / (2 * dt);
