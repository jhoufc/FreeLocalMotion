import type { CSSProperties, ReactNode } from 'react';
import { MaskReveal, clamp, ease, progress, springWithIntensity, SPRINGS, type RevealDirection } from '@lms/motion-core';
import type { TextElement } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { textAlign } from './art';
import { TextBlock, useTextLayout, type ResolvedText, type TextBox } from './TextBlock';

/**
 * Visual helpers shared by scene families. Display text uses the composition's base typeface
 * (`env.style.typography.display`), so a free composition can restyle every premium
 * scene at once; body/mono text keep their roles.
 */

export type Role = 'display' | 'text' | 'mono';

export const familyOf = (env: SceneRuntime, role: Role): string => env.style.typography[role];

export const useRoleText = (env: SceneRuntime, el: TextElement, role: Role, box: Omit<TextBox, 'family'>): ResolvedText =>
  useTextLayout(el, { ...box, family: familyOf(env, role) }, env.layout.format);

/** 0 → 1 over the exit window anchored to the scene end. */
export const exitAmount = (env: SceneRuntime, lead: number, dur = lead, easing = ease.inCubic): number =>
  progress(env.t, env.duration - lead, dur, easing);

/** Spring entrance with the scene's intensity knob. */
export const pop = (env: SceneRuntime, start: number, intensity: number, config = SPRINGS.type): number =>
  springWithIntensity(Math.max(0, env.t - start), config, intensity);

/**
 * Line-by-line masked reveal for a text block: each line slides out from behind its own
 * edge with a stagger. `out` (0..1) plays the mirror motion for exits.
 */
export const MaskedLines = ({
  text,
  color,
  align,
  start,
  env,
  each = 0.09,
  dur = 0.75,
  direction = 'up',
  out = 0,
  targetId,
  style,
}: {
  text: ResolvedText;
  color: string;
  align: 'start' | 'center' | 'end';
  start: number;
  env: SceneRuntime;
  each?: number;
  dur?: number;
  direction?: RevealDirection;
  out?: number;
  targetId: string;
  style?: CSSProperties;
}) => (
  <TextBlock
    text={text}
    color={color}
    align={align}
    split="lines"
    targetId={targetId}
    {...(style ? { style } : {})}
    renderUnit={(unit, content) => {
      const p = progress(env.t, start + unit.lineIndex * each, dur, ease.cinematic);
      const o = clamp(out * 1.6 - unit.lineIndex * 0.15);
      return (
        <MaskReveal progress={p - o} direction={direction}>
          {content}
        </MaskReveal>
      );
    }}
  />
);

/** Absolutely positioned block anchored by alignment (start / center / end). */
export const Anchor = ({ x, y, align, width, children, style }: { x: number; y: number; align: 'start' | 'center' | 'end'; width: number; children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: 'absolute',
      left: align === 'start' ? x : align === 'end' ? x - width : x - width / 2,
      top: y,
      width,
      textAlign: textAlign(align),
      ...style,
    }}
  >
    {children}
  </div>
);
