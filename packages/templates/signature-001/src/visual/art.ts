import type { FrameLayout } from '@lms/motion-core';

export { alignShift, alignX, blockAnchor } from '@lms/scene-kit';

/**
 * Art direction per format. These are deliberate, hand-tuned compositions — not a
 * scaled copy of one another. Sizes are in design units (u = 1px at 1080 short side).
 */

export const energyCore = (L: FrameLayout) =>
  L.isPortrait ? { x: L.cx, y: L.height * 0.355, R: 380 * L.u } : { x: L.width * 0.695, y: L.cy, R: 360 * L.u };

export const signatureMark = (L: FrameLayout) =>
  L.isPortrait ? { x: L.cx, y: L.height * 0.3, size: 330 * L.u } : { x: L.safe.left + 230 * L.u, y: L.cy, size: 400 * L.u };

