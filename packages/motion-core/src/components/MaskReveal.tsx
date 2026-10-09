import type { CSSProperties, ReactNode } from 'react';

export type RevealDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Classic typographic mask: the content slides from behind an invisible edge.
 * `progress` may overshoot past 1 (springs) — the content keeps moving but the mask
 * stays in place, which is what gives the subtle "settle" look.
 */
export const MaskReveal = ({
  progress,
  direction = 'up',
  distance = 1.08,
  children,
  style,
  innerStyle,
  bleed = 0.12,
}: {
  progress: number;
  direction?: RevealDirection;
  /** Travel as a fraction of the content box. */
  distance?: number;
  children: ReactNode;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  /** Extra room (em) around the mask so ascenders/descenders/italics never clip at rest. */
  bleed?: number;
}) => {
  const off = (1 - progress) * distance * 100;
  const translate =
    direction === 'up'
      ? `translate3d(0, ${off}%, 0)`
      : direction === 'down'
        ? `translate3d(0, ${-off}%, 0)`
        : direction === 'left'
          ? `translate3d(${off}%, 0, 0)`
          : `translate3d(${-off}%, 0, 0)`;
  return (
    <span
      style={{
        display: 'inline-block',
        overflow: 'hidden',
        verticalAlign: 'top',
        padding: `${bleed}em ${bleed * 0.6}em`,
        margin: `${-bleed}em ${-bleed * 0.6}em`,
        ...style,
      }}
    >
      <span style={{ display: 'inline-block', transform: translate, willChange: 'transform', ...innerStyle }}>{children}</span>
    </span>
  );
};

/** clip-path inset wipe, `progress` 0 = hidden, 1 = fully visible. */
export const wipeClip = (progress: number, direction: RevealDirection = 'right'): string => {
  const hidden = `${((1 - Math.max(0, Math.min(1, progress))) * 100).toFixed(3)}%`;
  switch (direction) {
    case 'right':
      return `inset(0 ${hidden} 0 0)`;
    case 'left':
      return `inset(0 0 0 ${hidden})`;
    case 'up':
      return `inset(${hidden} 0 0 0)`;
    case 'down':
      return `inset(0 0 ${hidden} 0)`;
  }
};

/** Circular iris (0 = closed, 1 = covers the frame diagonal). */
export const irisClip = (progress: number, cx = '50%', cy = '50%'): string =>
  `circle(${(Math.max(0, progress) * 75).toFixed(3)}% at ${cx} ${cy})`;
