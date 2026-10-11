import type { CSSProperties, ReactNode, SVGProps } from 'react';
import { round } from '../math';

/**
 * Small motion components that are pure functions of their inputs (no clocks, no state),
 * so they render identically in the Player and in headless Chrome.
 */

/**
 * Echo trail: renders `count` copies of a moving element sampled at past times, fading
 * out. `render(time, index)` must place the element for that time (index 0 = current).
 */
export const EchoTrail = ({
  t,
  count,
  spacing,
  decay = 0.55,
  render,
}: {
  t: number;
  count: number;
  /** Seconds between echoes. */
  spacing: number;
  decay?: number;
  render: (time: number, index: number) => ReactNode;
}) => (
  <>
    {Array.from({ length: Math.max(0, count) }, (_, k) => count - k).map((i) => (
      <div key={i} style={{ position: 'absolute', inset: 0, opacity: round(decay ** i, 4), pointerEvents: 'none' }}>
        {render(t - i * spacing, i)}
      </div>
    ))}
    <div style={{ position: 'absolute', inset: 0 }}>{render(t, 0)}</div>
  </>
);

/** 2D camera: pan (x, y in px), zoom and roll applied around the frame center. */
export interface Camera2D {
  x: number;
  y: number;
  zoom: number;
  rotate?: number;
}

export const cameraTransform = (cam: Camera2D): string =>
  `scale(${round(cam.zoom, 5)}) rotate(${round(cam.rotate ?? 0, 4)}deg) translate(${round(-cam.x, 2)}px, ${round(-cam.y, 2)}px)`;

/** Layer that moves with the camera at a fraction of its pan (`depth` 0 = fixed, 1 = with the camera). */
export const ParallaxLayer = ({ cam, depth, children, style }: { cam: Camera2D; depth: number; children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      transform: `translate(${round(-cam.x * depth, 2)}px, ${round(-cam.y * depth, 2)}px) scale(${round(1 + (cam.zoom - 1) * depth, 5)})`,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Circular progress (0..1) drawn with a normalized path length. */
export const ProgressRing = ({
  cx,
  cy,
  r,
  value,
  width,
  color,
  track,
  rotate = -90,
}: {
  cx: number;
  cy: number;
  r: number;
  value: number;
  width: number;
  color: string;
  track?: string;
  rotate?: number;
}) => (
  <g transform={`rotate(${rotate} ${cx} ${cy})`}>
    {track ? <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={width} /> : null}
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={`${round(Math.max(0, Math.min(1, value)), 5)} 1`} />
  </g>
);

/** SVG path that draws itself: `progress` 0..1 of its length (normalized with pathLength). */
export const DrawPath = ({ d, progress: p, ...rest }: { d: string; progress: number } & SVGProps<SVGPathElement>) => (
  <path d={d} pathLength={1} strokeDasharray={`${round(Math.max(0, Math.min(1, p)), 5)} 1`} fill="none" {...rest} />
);
