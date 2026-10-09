import { z } from 'zod';
import { colorRefSchema, hexColorSchema } from './color';

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

/**
 * How a text element breaks into lines, per format.
 * - manual: respect the line breaks typed by the user
 * - single: everything on one line (auto-fitted to width)
 * - words:  one word per line (stacked editorial look)
 * - auto:   greedy wrap at the template's max width
 */
export const LINE_BREAK_MODES = ['manual', 'single', 'words', 'auto'] as const;
export const lineBreakModeSchema = z.enum(LINE_BREAK_MODES);
export type LineBreakMode = z.infer<typeof lineBreakModeSchema>;

export const FONT_STRETCHES = ['condensed', 'normal', 'expanded'] as const;
export const fontStretchSchema = z.enum(FONT_STRETCHES);
export type FontStretch = z.infer<typeof fontStretchSchema>;

export const perFormatSchema = <T extends z.ZodType>(inner: T) => z.object({ portrait: inner, landscape: inner });

export const textElementSchema = z.object({
  visible: z.boolean(),
  content: z.string().max(240),
  color: colorRefSchema,
  weight: z.number().int().min(100).max(900),
  italic: z.boolean(),
  uppercase: z.boolean(),
  stretch: fontStretchSchema,
  /** Multiplier on top of the size the template computes for the layout. */
  sizeScale: z.number().min(0.4).max(1.6),
  /** Letter spacing in em. */
  tracking: z.number().min(-0.12).max(0.5),
  breaks: perFormatSchema(lineBreakModeSchema),
  /** Extra entrance delay, in seconds, bounded by the template's field descriptor. */
  delay: z.number().min(0).max(2),
});
export type TextElement = z.infer<typeof textElementSchema>;

/* ------------------------------------------------------------------ */
/* Graphic elements                                                    */
/* ------------------------------------------------------------------ */

export const graphicElementSchema = z.object({
  visible: z.boolean(),
  color: colorRefSchema,
  opacity: z.number().min(0).max(1),
  /** Generic "amount" knob each template maps to something meaningful (density, glow, amplitude...). */
  intensity: z.number().min(0).max(2),
});
export type GraphicElement = z.infer<typeof graphicElementSchema>;

/* ------------------------------------------------------------------ */
/* Backgrounds                                                         */
/* ------------------------------------------------------------------ */

export const BACKGROUND_MODES = ['procedural', 'solid', 'gradient', 'image'] as const;
export const backgroundModeSchema = z.enum(BACKGROUND_MODES);
export type BackgroundMode = z.infer<typeof backgroundModeSchema>;

export const gradientStopSchema = z.object({
  color: colorRefSchema,
  position: z.number().min(0).max(1),
});
export type GradientStop = z.infer<typeof gradientStopSchema>;

/**
 * Every mode keeps its own settings so switching modes in the inspector is lossless.
 */
export const backgroundSchema = z.object({
  mode: backgroundModeSchema,
  procedural: z.object({
    variant: z.string().min(1),
    base: colorRefSchema,
    intensity: z.number().min(0).max(2),
  }),
  solid: z.object({ color: colorRefSchema }),
  gradient: z.object({
    kind: z.enum(['linear', 'radial']),
    angle: z.number().min(0).max(360),
    /** Degrees per second of slow rotation, 0 = static. Gives gradients direction and life. */
    drift: z.number().min(0).max(60),
    stops: z.array(gradientStopSchema).min(2).max(5),
  }),
  image: z.object({
    assetId: z.string().nullable(),
    fit: z.enum(['cover', 'contain']),
    scale: z.number().min(0.5).max(3),
    /** Offset of the image focal point, -1..1 of the free space. */
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
    opacity: z.number().min(0).max(1),
    blur: z.number().min(0).max(40),
    /** Slow push-in amount over the scene (0 = still). */
    motion: z.number().min(0).max(0.3),
    overlayColor: hexColorSchema,
    overlayOpacity: z.number().min(0).max(1),
  }),
  /** Whether the template texture (grain, grid) is painted over non-procedural backgrounds. */
  texture: z.boolean(),
});
export type Background = z.infer<typeof backgroundSchema>;

export const createBackground = (overrides: {
  variant: string;
  mode?: BackgroundMode;
  base?: string;
  intensity?: number;
}): Background => ({
  mode: overrides.mode ?? 'procedural',
  procedural: { variant: overrides.variant, base: overrides.base ?? '$background', intensity: overrides.intensity ?? 1 },
  solid: { color: '$background' },
  gradient: {
    kind: 'linear',
    angle: 145,
    drift: 6,
    stops: [
      { color: '$background', position: 0 },
      { color: '$surface', position: 0.62 },
      { color: '$secondary', position: 1 },
    ],
  },
  image: {
    assetId: null,
    fit: 'cover',
    scale: 1,
    x: 0,
    y: 0,
    opacity: 1,
    blur: 0,
    motion: 0.06,
    overlayColor: '#080A10',
    overlayOpacity: 0.55,
  },
  texture: true,
});

/* ------------------------------------------------------------------ */
/* Layout overrides                                                    */
/* ------------------------------------------------------------------ */

export const ALIGNMENTS = ['start', 'center', 'end'] as const;
export const alignmentSchema = z.enum(ALIGNMENTS);
export type Alignment = z.infer<typeof alignmentSchema>;

/**
 * Per-format art-direction knobs. Templates own the actual layout; these are bounded
 * nudges the user can apply without breaking the composition.
 */
export const layoutOverrideSchema = z.object({
  align: alignmentSchema,
  /** Scales the whole typographic block. */
  scale: z.number().min(0.7).max(1.3),
  /** Offsets as a fraction of the safe area. */
  offsetX: z.number().min(-0.25).max(0.25),
  offsetY: z.number().min(-0.25).max(0.25),
});
export type LayoutOverride = z.infer<typeof layoutOverrideSchema>;

export const sceneLayoutSchema = z.object({
  portrait: layoutOverrideSchema,
  landscape: layoutOverrideSchema,
});
export type SceneLayout = z.infer<typeof sceneLayoutSchema>;
