import type { FontStretch, LineBreakMode } from '@lms/shared';
import { getFontsEpoch } from '../fonts';

export interface FontSpec {
  family: string;
  weight: number;
  italic?: boolean;
  stretch?: FontStretch;
}

/** CSS `font-stretch` percentages; canvas uses the matching keywords. */
export const STRETCH_PERCENT: Record<FontStretch, string> = {
  condensed: '75%',
  normal: '100%',
  expanded: '125%',
};

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();
let cacheEpoch = -1;
const REF_SIZE = 100;

const getCtx = (): CanvasRenderingContext2D | null => {
  if (ctx) return ctx;
  if (typeof document === 'undefined') return null;
  ctx = document.createElement('canvas').getContext('2d');
  return ctx;
};

/**
 * Width in px of `text` at 1px font size (without tracking). Uses canvas metrics of the
 * real loaded font. Falls back to a conservative estimate outside the browser.
 */
export const measureUnitWidth = (text: string, font: FontSpec): number => {
  const epoch = getFontsEpoch();
  if (epoch !== cacheEpoch) {
    cache.clear();
    cacheEpoch = epoch;
  }
  const key = `${font.family}|${font.weight}|${font.italic ? 1 : 0}|${font.stretch ?? 'normal'}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const c = getCtx();
  let width: number;
  if (!c) {
    const stretchK = font.stretch === 'expanded' ? 1.22 : font.stretch === 'condensed' ? 0.78 : 1;
    width = text.length * 0.62 * stretchK * (0.85 + font.weight / 3000);
  } else {
    c.font = `${font.italic ? 'italic ' : ''}${font.weight} ${REF_SIZE}px "${font.family}"`;
    // fontStretch is a separate canvas attribute; assigning `font` resets it.
    (c as CanvasRenderingContext2D & { fontStretch: string }).fontStretch =
      font.stretch === 'expanded' ? 'expanded' : font.stretch === 'condensed' ? 'condensed' : 'normal';
    width = c.measureText(text).width / REF_SIZE;
  }
  cache.set(key, width);
  return width;
};

/** Width at 1px including letter-spacing (CSS applies tracking after every character). */
export const lineUnitWidth = (line: string, font: FontSpec, trackingEm: number): number =>
  measureUnitWidth(line, font) + trackingEm * Array.from(line).length;

export interface TextLayoutInput {
  content: string;
  mode: LineBreakMode;
  font: FontSpec;
  uppercase: boolean;
  trackingEm: number;
  /** Preferred font size in px (already scaled by the user's size multiplier). */
  size: number;
  maxWidth: number;
  /** Optional bound on the total block height. */
  maxHeight?: number;
  lineHeight: number;
  minSize?: number;
}

export interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** Width of the widest line at the final size (px). */
  width: number;
  height: number;
}

const normalize = (s: string) => s.replace(/[ \t]+/g, ' ').trim();

export const splitByMode = (content: string, mode: Exclude<LineBreakMode, 'auto'>): string[] => {
  switch (mode) {
    case 'manual':
      return content.split(/\r?\n/).map(normalize).filter((l) => l.length > 0);
    case 'single':
      return [normalize(content.replace(/\r?\n/g, ' '))].filter((l) => l.length > 0);
    case 'words':
      return normalize(content.replace(/\r?\n/g, ' '))
        .split(' ')
        .filter((w) => w.length > 0);
  }
};

const greedyWrap = (content: string, font: FontSpec, tracking: number, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of splitByMode(content, 'manual')) {
    let current = '';
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || lineUnitWidth(candidate, font, tracking) * size <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
};

/**
 * Breaks and sizes a text block so it never overflows its box: the font shrinks until
 * the widest line (and the block height, when bounded) fits. This is what keeps user
 * edits from producing cut-off text in either format.
 */
export const layoutText = (input: TextLayoutInput): TextLayout => {
  const content = input.uppercase ? input.content.toLocaleUpperCase() : input.content;
  const minSize = input.minSize ?? 8;
  let size = input.size;
  const lines =
    input.mode === 'auto'
      ? greedyWrap(content, input.font, input.trackingEm, size, input.maxWidth)
      : splitByMode(content, input.mode);
  if (lines.length === 0) return { lines: [], fontSize: size, lineHeight: input.lineHeight, width: 0, height: 0 };

  const widest = Math.max(...lines.map((l) => lineUnitWidth(l, input.font, input.trackingEm)));
  if (widest * size > input.maxWidth) size = input.maxWidth / widest;
  if (input.maxHeight !== undefined) {
    const blockH = lines.length * input.lineHeight * size;
    if (blockH > input.maxHeight) size = input.maxHeight / (lines.length * input.lineHeight);
  }
  size = Math.max(minSize, size);
  return {
    lines,
    fontSize: size,
    lineHeight: input.lineHeight,
    width: widest * size,
    height: lines.length * input.lineHeight * size,
  };
};
