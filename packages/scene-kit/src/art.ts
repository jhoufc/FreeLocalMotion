import type { FrameLayout, LayoutOverride } from '@lms/shared';

/** Anchor point of a text block, honoring the user's bounded layout overrides. */
export const blockAnchor = (L: FrameLayout, o: LayoutOverride, base: { x: number; y: number }) => ({
  x: base.x + o.offsetX * L.safe.width,
  y: base.y + o.offsetY * L.safe.height,
});

/** Horizontal anchor for an alignment inside the safe area. */
export const alignX = (L: FrameLayout, align: LayoutOverride['align'], inset = 0) =>
  align === 'start' ? L.safe.left + inset : align === 'end' ? L.width - L.safe.right - inset : L.cx;

/** translate(-x%) for an alignment, so a block's anchor is its start/center/end edge. */
export const alignShift = (align: LayoutOverride['align']) => (align === 'start' ? '0%' : align === 'end' ? '-100%' : '-50%');

/** CSS text-align for an alignment. */
export const textAlign = (align: LayoutOverride['align']) => (align === 'start' ? 'left' : align === 'end' ? 'right' : 'center');

/** Anchor x of a text column that starts at `left` and is `width` wide, for an alignment. */
export const columnX = (left: number, width: number, align: LayoutOverride['align']) => (align === 'start' ? left : align === 'end' ? left + width : left + width / 2);
