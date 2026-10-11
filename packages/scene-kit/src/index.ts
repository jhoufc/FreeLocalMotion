import type { CompositionStyle } from '@lms/template-sdk';
import { DISPLAY, MONO, TEXT } from './fonts';

export { DISPLAY, MONO, TEXT, TYPEFACES, kitFonts, type TypefaceId } from './fonts';
export { SceneBackground } from './Background';
export { FinishOverlays, Soundtrack } from './overlays';
export { TextBlock, alignItems, useTextLayout, type ResolvedText, type TextBox } from './TextBlock';
export * from './art';
export * from './motionText';
export * from './fields';

/** Style used by templates that do not define their own (and free compositions by default). */
export const DEFAULT_STYLE: CompositionStyle = {
  typography: { display: DISPLAY, text: TEXT, mono: MONO },
  background: null,
};
