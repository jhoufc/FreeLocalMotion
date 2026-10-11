import type { CSSProperties, ReactNode } from 'react';
import { ease, progress, round } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { SceneBackground } from '@lms/scene-kit';
import { EDITORIAL_CHOREO as C, type EditorialSplitScene } from '../scenes/editorialSplit';
import { at } from '../common';
import { MaskedLines, familyOf, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<EditorialSplitScene>;

export const EditorialSplitView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const E = scene.elements;
  const exitStart = env.duration - C.exit;
  const side = scene.props.direction === 'auto' ? (P ? 'horizontal' : 'vertical') : scene.props.direction;
  const V = side === 'vertical'; // side by side
  const ratio = scene.props.ratio + Math.sin(t * 0.7) * 0.004;
  const span = V ? L.width : L.height;
  const cut = span * ratio;

  const inA = progress(t, at(C.panelA.in, anim), C.panelA.dur, ease.snap);
  const inB = progress(t, at(C.panelB.in, anim), C.panelB.dur, ease.snap);
  const outA = progress(t, exitStart + 0.06, C.exit - 0.12, ease.inOutQuart);
  const outB = progress(t, exitStart, C.exit - 0.12, ease.inOutQuart);
  const shiftA = (-(1 - inA) - outA) * cut;
  const shiftB = ((1 - inB) + outB) * (span - cut);

  const pad = (P ? 70 : 80) * u * o.scale;
  const aW = V ? cut : L.width;
  const aH = V ? L.height : cut;
  const bW = V ? L.width - cut : L.width;
  const bH = V ? L.height : L.height - cut;

  const blockA = useRoleText(env, scene.texts.blockA, 'display', {
    size: (P ? 250 : 260) * u * o.scale,
    maxWidth: aW - pad * 2,
    maxHeight: aH - pad * 2.6,
    lineHeight: 0.86,
  });
  const blockB = useRoleText(env, scene.texts.blockB, 'text', {
    size: (P ? 170 : 170) * u * o.scale,
    maxWidth: bW - pad * 2,
    maxHeight: bH - pad * 3.4,
    lineHeight: 0.98,
  });
  const aux = useRoleText(env, scene.texts.aux, 'mono', { size: (P ? 22 : 20) * u, maxWidth: bW - pad * 2 - 80 * u, lineHeight: 1.3 });

  const rulesEl = E.rules;
  const ruleColor = env.color(rulesEl.color);
  const rw = Math.max(1, (1 + rulesEl.intensity) * u);
  const rulesIn = progress(t, at(C.rules.in, anim), C.rules.dur, ease.cinematic);
  const textOut = 0; // texts leave with their panels
  const mono = familyOf(env, 'mono');

  const texture = (el: typeof E.panelA, color: string): CSSProperties => ({
    background: `repeating-linear-gradient(135deg, ${withAlpha(color, 0)} 0 ${18 * u}px, ${withAlpha('#000000', 0.05 * el.intensity)} ${18 * u}px ${19 * u}px), ${color}`,
  });

  const indexMark = (label: string, color: string, extra: CSSProperties): ReactNode => (
    <div style={{ position: 'absolute', fontFamily: `"${mono}"`, fontSize: 20 * u, letterSpacing: '0.18em', color: withAlpha(color, 0.75 * rulesEl.opacity), ...extra }}>
      {label}
    </div>
  );

  const colorA = env.color(E.panelA.color);
  const colorB = env.color(E.panelB.color);
  const textAColor = env.color(scene.texts.blockA.color);
  const textBColor = env.color(scene.texts.blockB.color);
  const ruleDraw = (start: number) => progress(t, start, 0.6, ease.cinematic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />

      {/* Panel A */}
      <div
        data-lms-target={env.target('panelA')}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: aW,
          height: aH,
          overflow: 'hidden',
          transform: V ? `translateX(${round(shiftA, 2)}px)` : `translateY(${round(shiftA, 2)}px)`,
          opacity: E.panelA.visible ? E.panelA.opacity : 0,
          ...texture(E.panelA, colorA),
        }}
      >
        {rulesEl.visible && indexMark('01 / A', textAColor, { left: pad, top: pad * 0.8 })}
        {rulesEl.visible && (
          <div style={{ position: 'absolute', left: pad, top: pad * 0.8 + 40 * u, height: rw, width: (aW - pad * 2) * ruleDraw(at(C.blockA.in, anim) - 0.2), background: withAlpha(textAColor, 0.6 * rulesEl.opacity) }} />
        )}
        <div style={{ position: 'absolute', left: pad + o.offsetX * L.safe.width, bottom: pad - o.offsetY * L.safe.height, width: aW - pad * 2 }}>
          <MaskedLines text={blockA} env={env} color={textAColor} align="start" start={at(C.blockA.in, anim, scene.texts.blockA.delay)} each={0.08} dur={0.8} out={textOut} targetId={env.target('blockA')} />
        </div>
      </div>

      {/* Panel B */}
      <div
        data-lms-target={env.target('panelB')}
        style={{
          position: 'absolute',
          left: V ? cut : 0,
          top: V ? 0 : cut,
          width: bW,
          height: bH,
          overflow: 'hidden',
          transform: V ? `translateX(${round(shiftB, 2)}px)` : `translateY(${round(shiftB, 2)}px)`,
          opacity: E.panelB.visible ? E.panelB.opacity : 0,
          ...texture(E.panelB, colorB),
        }}
      >
        {rulesEl.visible && indexMark('02 / B', textBColor, { right: pad, top: pad * 0.8 })}
        <div style={{ position: 'absolute', left: pad + o.offsetX * L.safe.width, top: pad * 1.6 + o.offsetY * L.safe.height, width: bW - pad * 2 }}>
          <MaskedLines text={blockB} env={env} color={textBColor} align="start" start={at(C.blockB.in, anim, scene.texts.blockB.delay)} each={0.09} dur={0.85} direction="down" out={textOut} targetId={env.target('blockB')} />
        </div>
        <div style={{ position: 'absolute', left: pad, right: pad, bottom: pad }}>
          {rulesEl.visible && (
            <div style={{ height: rw, width: `${round(ruleDraw(at(C.aux.in, anim) - 0.2) * 100, 2)}%`, background: withAlpha(ruleColor, 0.7 * rulesEl.opacity), marginBottom: 18 * u }} />
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 * u }}>
            <span style={{ width: 14 * u, height: 14 * u, marginTop: 4 * u, background: env.palette.accent, opacity: progress(t, at(C.aux.in, anim), 0.3), flex: 'none' }} />
            <MaskedLines text={aux} env={env} color={env.color(scene.texts.aux.color)} align="start" start={at(C.aux.in, anim, scene.texts.aux.delay)} out={textOut} targetId={env.target('aux')} />
          </div>
        </div>
      </div>

      {/* Divider + ticks along the split */}
      {rulesEl.visible && (
        <div data-lms-target={env.target('rules')} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: rulesEl.opacity * (1 - outB) }}>
          <div
            style={{
              position: 'absolute',
              left: V ? cut - rw / 2 : 0,
              top: V ? 0 : cut - rw / 2,
              width: V ? rw * 1.5 : L.width * rulesIn,
              height: V ? L.height * rulesIn : rw * 1.5,
              background: ruleColor,
            }}
          />
          {Array.from({ length: 9 }, (_, i) => {
            const p = (i + 1) / 10;
            const show = progress(t, at(C.rules.in, anim) + 0.2 + i * 0.04, 0.3);
            const len = (i === 4 ? 26 : 12) * u * show;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: V ? cut - len / 2 : L.width * p,
                  top: V ? L.height * p : cut - len / 2,
                  width: V ? len : rw,
                  height: V ? rw : len,
                  background: ruleColor,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
