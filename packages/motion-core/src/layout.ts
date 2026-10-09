import { useVideoConfig } from 'remotion';
import { SAFE_AREAS, type Format } from '@lms/shared';

export interface FrameLayout {
  format: Format;
  isPortrait: boolean;
  width: number;
  height: number;
  cx: number;
  cy: number;
  /**
   * Design unit: 1u = 1px on a 1080px short side. Templates author sizes in `u`, so a
   * 4K render or a different resolution scales consistently.
   */
  u: number;
  safe: { top: number; right: number; bottom: number; left: number; width: number; height: number };
}

export const computeFrameLayout = (width: number, height: number): FrameLayout => {
  const format: Format = width >= height ? 'landscape' : 'portrait';
  const s = SAFE_AREAS[format];
  const top = s.top * height;
  const bottom = s.bottom * height;
  const left = s.left * width;
  const right = s.right * width;
  return {
    format,
    isPortrait: format === 'portrait',
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    u: Math.min(width, height) / 1080,
    safe: { top, right, bottom, left, width: width - left - right, height: height - top - bottom },
  };
};

export const useFrameLayout = (): FrameLayout => {
  const { width, height } = useVideoConfig();
  return computeFrameLayout(width, height);
};

/** Picks the value for the current format. The backbone of format-specific art direction. */
export const byFormat = <T,>(format: Format, values: { portrait: T; landscape: T }): T => values[format];
