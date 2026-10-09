import { useId, type CSSProperties, type ReactNode } from 'react';

/**
 * Directional gaussian blur via an inline SVG filter. Driven by velocity it acts as a
 * deterministic motion blur (one frame, no temporal supersampling) that renders the same
 * in the Player and in headless Chrome.
 */
export const DirectionalBlur = ({
  x = 0,
  y = 0,
  children,
  style,
  as: Tag = 'div',
}: {
  x?: number;
  y?: number;
  children: ReactNode;
  style?: CSSProperties;
  as?: 'div' | 'span';
}) => {
  const rawId = useId();
  const id = `lms-blur-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const bx = Math.abs(x) < 0.05 ? 0 : Math.abs(x);
  const by = Math.abs(y) < 0.05 ? 0 : Math.abs(y);
  const active = bx > 0 || by > 0;
  return (
    <Tag style={{ ...style, filter: active ? `url(#${id})` : style?.filter }}>
      {active ? (
        <svg width="0" height="0" style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
          <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} />
          </filter>
        </svg>
      ) : null}
      {children}
    </Tag>
  );
};

/**
 * Converts a velocity (px / second) into a blur radius for one frame with a 180° shutter.
 */
export const motionBlurFromVelocity = (velocityPxPerSecond: number, fps: number, max = 40): number =>
  Math.min(max, (Math.abs(velocityPxPerSecond) / fps) * 0.5 * 0.5);
