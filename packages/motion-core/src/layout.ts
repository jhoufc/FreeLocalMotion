import { useVideoConfig } from 'remotion';
import { computeFrameLayout, type FrameLayout, type Format } from '@lms/shared';

export { computeFrameLayout, type FrameLayout } from '@lms/shared';

export const useFrameLayout = (): FrameLayout => {
  const { width, height } = useVideoConfig();
  return computeFrameLayout(width, height);
};

/** Picks the value for the current format. The backbone of format-specific art direction. */
export const byFormat = <T,>(format: Format, values: { portrait: T; landscape: T }): T => values[format];
