import type { FrameLayout } from '@lms/motion-core';
import type { LayoutOverride } from '@lms/shared';

/**
 * Art direction per format. These are deliberate, hand-tuned compositions — not a
 * scaled copy of one another. Sizes are in design units (u = 1px at 1080 short side).
 */

/** Anchor point of a text block, honoring the user's bounded layout overrides. */
export const blockAnchor = (L: FrameLayout, o: LayoutOverride, base: { x: number; y: number }) => ({
  x: base.x + o.offsetX * L.safe.width,
  y: base.y + o.offsetY * L.safe.height,
});

/** Horizontal anchor for an alignment inside the safe area. */
export const alignX = (L: FrameLayout, align: LayoutOverride['align'], inset = 0) =>
  align === 'start' ? L.safe.left + inset : align === 'end' ? L.width - L.safe.right - inset : L.cx;

export const energyCore = (L: FrameLayout) =>
  L.isPortrait ? { x: L.cx, y: L.height * 0.355, R: 380 * L.u } : { x: L.width * 0.695, y: L.cy, R: 360 * L.u };

export const signatureMark = (L: FrameLayout) =>
  L.isPortrait ? { x: L.cx, y: L.height * 0.3, size: 330 * L.u } : { x: L.safe.left + 230 * L.u, y: L.cy, size: 400 * L.u };

/** translate(-x%) for an alignment, so a block's anchor is its start/center/end edge. */
export const alignShift = (align: LayoutOverride['align']) => (align === 'start' ? '0%' : align === 'end' ? '-100%' : '-50%');
