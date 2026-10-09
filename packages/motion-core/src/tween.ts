import { ease, type EasingFn } from './easing';
import { clamp, lerp } from './math';

/** 0..1 progress of a window starting at `start` lasting `duration` seconds. */
export const progress = (t: number, start: number, duration: number, easing: EasingFn = ease.linear): number => {
  if (duration <= 0) return t >= start ? 1 : 0;
  return easing(clamp((t - start) / duration));
};

/** Value tween over a time window. */
export const tween = (t: number, start: number, duration: number, from: number, to: number, easing: EasingFn = ease.cinematic): number =>
  lerp(from, to, progress(t, start, duration, easing));

export type Keyframe = readonly [time: number, value: number, easing?: EasingFn];

/**
 * Multi-segment keyframes. Each keyframe's easing applies to the segment that *ends* at
 * it, mirroring how motion designers think ("ease into this pose").
 */
export const keyframes = (t: number, frames: readonly Keyframe[]): number => {
  if (frames.length === 0) return 0;
  const first = frames[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!;
    const next = frames[i]!;
    if (t <= next[0]) {
      const e = next[2] ?? ease.inOut;
      return lerp(prev[1], next[1], e(clamp((t - prev[0]) / (next[0] - prev[0]))));
    }
  }
  return frames[frames.length - 1]![1];
};

/**
 * Entrance / exit envelope for scene elements: 0 before `inStart`, rises to 1, holds,
 * then falls back to 0 ending at `outEnd`. Exit is anchored to the scene end so
 * changing a scene's duration only lengthens the hold, never desynchronizes motion.
 */
export const envelope = (
  t: number,
  opts: { inStart: number; inDuration: number; outEnd: number; outDuration: number; easeIn?: EasingFn; easeOut?: EasingFn },
): number => {
  const a = progress(t, opts.inStart, opts.inDuration, opts.easeIn ?? ease.cinematic);
  const b = 1 - progress(t, opts.outEnd - opts.outDuration, opts.outDuration, opts.easeOut ?? ease.inCubic);
  return Math.min(a, b);
};
