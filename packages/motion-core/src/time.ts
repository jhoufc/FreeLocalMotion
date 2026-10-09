import { useCurrentFrame, useVideoConfig } from 'remotion';

export interface TimeInfo {
  /** Local frame (relative to the enclosing Sequence). */
  frame: number;
  fps: number;
  /** Local time in seconds. Templates author motion in seconds so 30/60 fps behave identically. */
  t: number;
  /** Duration of the enclosing Sequence, seconds. */
  duration: number;
  durationInFrames: number;
}

export const useTime = (): TimeInfo => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return { frame, fps, t: frame / fps, duration: durationInFrames / fps, durationInFrames };
};
