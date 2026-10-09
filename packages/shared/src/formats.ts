export const FORMATS = ['portrait', 'landscape'] as const;
export type Format = (typeof FORMATS)[number];

export interface FormatSpec {
  readonly id: Format;
  readonly label: string;
  readonly ratio: string;
  readonly width: number;
  readonly height: number;
}

export const FORMAT_SPECS: Readonly<Record<Format, FormatSpec>> = {
  portrait: { id: 'portrait', label: 'Vertical', ratio: '9:16', width: 1080, height: 1920 },
  landscape: { id: 'landscape', label: 'Horizontal', ratio: '16:9', width: 1920, height: 1080 },
};

export const SUPPORTED_FPS = [30, 60] as const;
export type SupportedFps = (typeof SUPPORTED_FPS)[number];
export const DEFAULT_FPS: SupportedFps = 30;

/**
 * Safe areas (fraction of each dimension) that keep content clear of the UI chrome
 * social platforms paint over vertical video (Reels / Shorts / TikTok) and of the
 * title-safe region of widescreen video.
 */
export const SAFE_AREAS: Readonly<Record<Format, { top: number; right: number; bottom: number; left: number }>> = {
  portrait: { top: 0.11, right: 0.08, bottom: 0.17, left: 0.08 },
  landscape: { top: 0.08, right: 0.06, bottom: 0.08, left: 0.06 },
};

export const secondsToFrames = (seconds: number, fps: number): number => Math.max(1, Math.round(seconds * fps));
