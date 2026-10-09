import { z } from 'zod';

export const THEME_TOKENS = ['background', 'foreground', 'accent', 'secondary', 'surface'] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];

const HEX = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const TOKEN = new RegExp(`^\\$(?:${THEME_TOKENS.join('|')})$`);

export const hexColorSchema = z.string().regex(HEX, 'Expected a hex color like #AABBCC');

/**
 * A color reference is either a literal hex color or a theme token (`$accent`).
 * Tokens let scenes inherit the palette, so changing the theme recolors everything
 * that was not explicitly overridden.
 */
export const colorRefSchema = z
  .string()
  .refine((v) => HEX.test(v) || TOKEN.test(v), 'Expected a hex color (#AABBCC) or a theme token ($accent)');
export type ColorRef = z.infer<typeof colorRefSchema>;

export const themeSchema = z.object({
  background: hexColorSchema,
  foreground: hexColorSchema,
  accent: hexColorSchema,
  secondary: hexColorSchema,
  surface: hexColorSchema,
});
export type Theme = z.infer<typeof themeSchema>;

/** Scene-level palette override. `null` means "inherit from the project theme". */
export const paletteOverrideSchema = z.object({
  background: hexColorSchema.nullable(),
  foreground: hexColorSchema.nullable(),
  accent: hexColorSchema.nullable(),
  secondary: hexColorSchema.nullable(),
  surface: hexColorSchema.nullable(),
});
export type PaletteOverride = z.infer<typeof paletteOverrideSchema>;

export const emptyPaletteOverride = (): PaletteOverride => ({
  background: null,
  foreground: null,
  accent: null,
  secondary: null,
  surface: null,
});

export const isThemeToken = (ref: string): ref is `$${ThemeToken}` => TOKEN.test(ref);

export const mergePalette = (theme: Theme, override?: PaletteOverride | null): Theme => {
  if (!override) return theme;
  return {
    background: override.background ?? theme.background,
    foreground: override.foreground ?? theme.foreground,
    accent: override.accent ?? theme.accent,
    secondary: override.secondary ?? theme.secondary,
    surface: override.surface ?? theme.surface,
  };
};

export const resolveColor = (ref: ColorRef, palette: Theme): string => {
  if (isThemeToken(ref)) return palette[ref.slice(1) as ThemeToken];
  return ref;
};

/** Parses #RRGGBB / #RRGGBBAA into 0-255 channels (alpha 0-1). */
export const parseHex = (hex: string): { r: number; g: number; b: number; a: number } => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
};

export const withAlpha = (hex: string, alpha: number): string => {
  const { r, g, b, a } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha * a)).toFixed(4)})`;
};

const toHex2 = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');

/** Linear RGB mix between two hex colors. Deterministic, used for choreographed color shifts. */
export const mixHex = (from: string, to: string, t: number): string => {
  const a = parseHex(from);
  const b = parseHex(to);
  const k = Math.max(0, Math.min(1, t));
  return `#${toHex2(a.r + (b.r - a.r) * k)}${toHex2(a.g + (b.g - a.g) * k)}${toHex2(a.b + (b.b - a.b) * k)}`;
};

/** WCAG relative luminance, used by the editor to warn about low-contrast text. */
export const relativeLuminance = (hex: string): number => {
  const { r, g, b } = parseHex(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
