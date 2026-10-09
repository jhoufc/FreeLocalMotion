import type { AnyScene, SceneAnimation, SceneType } from './schema';

/**
 * Choreography table — the single source of truth for *when* things happen.
 * The composition reads it to animate, the timeline reads it to draw layer clips and
 * markers, so what the user sees on the timeline is exactly what the video does.
 *
 * Times are seconds from the scene start, before `pace` scaling. Exits are expressed as
 * "seconds before the scene end" so longer scenes extend the hold, not the motion.
 */
export const CHOREO = {
  impact: {
    lightLine: { in: 0.08, dur: 0.6 },
    geometry: { in: 0.18, dur: 0.9 },
    particles: { in: 0.3, dur: 1 },
    kicker: { in: 0.42, dur: 0.6 },
    lineA: { in: 0.55, dur: 0.7 },
    lineB: { in: 1.2, dur: 0.75 },
    exit: 0.46,
  },
  energy: {
    collapse: { in: 0, dur: 0.38 },
    grid: { in: 0.18, dur: 0.8 },
    core: { in: 0.28, dur: 0.6 },
    rings: { in: 0.32, dur: 0.9 },
    orbiters: { in: 0.85, dur: 0.6 },
    lead: { in: 0.62, dur: 0.6 },
    headline: { in: 0.88, dur: 0.8 },
    exit: 0.5,
  },
  /** Transformation runs on a normalized 4-second clock (scaled to the scene duration). */
  transformation: {
    frames: { in: 0, dur: 4 },
    morph: { in: 0.3, dur: 3.2 },
    guides: { in: 0.45, dur: 2.6 },
    word1: { in: 0.12, dur: 0.75, hero: 0.95 },
    word2: { in: 1.25, dur: 0.6, hero: 1.95 },
    word3: { in: 2.25, dur: 0.7, hero: 2.95 },
    exit: 0.35,
  },
  signature: {
    shards: { in: 0.08, dur: 0.9 },
    markRing: { in: 0.38, dur: 0.75 },
    markDiamond: { in: 0.55, dur: 0.7 },
    markCore: { in: 0.78, dur: 0.5 },
    headline: { in: 0.98, dur: 0.75 },
    subtitle: { in: 1.7, dur: 0.6 },
    outro: 1.05,
  },
} as const;

export const TRANSFORMATION_CLOCK = 4;

/**
 * Transition-in duration of each scene type (seconds). The *previous* scene is kept on
 * screen for this long past its end so both can be composited (iris / light-line wipes).
 * The first scene of a video has nothing to transition from and starts clean.
 */
export const TRANSITION_IN: Record<SceneType, number> = {
  impact: 0,
  energy: 0,
  transformation: 0.5,
  signature: 0.6,
};

/** Entrance start time (seconds, scene-local) for an element, with pace + user delay applied. */
export const entranceAt = (base: number, animation: SceneAnimation, delay = 0): number => base / animation.pace + delay;

/** Maps a normalized transformation-clock time to scene seconds. */
export const transformationToScene = (tau: number, duration: number): number => (tau * duration) / TRANSFORMATION_CLOCK;

/**
 * Tail (seconds) the scene at `order` must stay rendered so the following scene can
 * composite its transition over it. `sequence` is the list of *enabled* scenes in order.
 */
export const nextSceneTransition = (sequence: readonly Pick<AnyScene, 'type'>[], order: number): number => {
  const next = sequence[order + 1];
  return next ? TRANSITION_IN[next.type] : 0;
};
