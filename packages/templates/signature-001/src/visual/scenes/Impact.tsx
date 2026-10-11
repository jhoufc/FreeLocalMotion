import type { ReactNode } from 'react';
import {
  DirectionalBlur,
  MaskReveal,
  SPRINGS,
  clamp,
  depthOpacity,
  ease,
  motionBlurFromVelocity,
  progress,
  project,
  randomAt,
  round,
  springWithIntensity,
  velocityOf,
  wipeClip,
} from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { ImpactScene } from '../../schema';
import { CHOREO, entranceAt } from '../../timing';
import { alignShift, alignX, blockAnchor } from '../art';
import { SceneBackground } from '@lms/scene-kit';
import type { SceneEnv } from '../context';
import { DISPLAY, MONO } from '@lms/scene-kit';
import { TextBlock, useTextLayout } from '@lms/scene-kit';

const C = CHOREO.impact;
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/#+=<>';

/* ------------------------------------------------------------------ */
/* Light line: the visual motif of the whole film.                     */
/* ------------------------------------------------------------------ */

const sweepPos = (t: number, start: number, dur: number) => progress(t, start, dur, ease.inOutQuart) * 1.12 - 0.06;

const LightLine = ({ env, start }: { env: SceneEnv<ImpactScene>; start: number }) => {
  const { t, layout: L } = env;
  const el = env.scene.elements.lightLine;
  if (!el.visible) return null;
  const dur = C.lightLine.dur / env.scene.animation.pace;
  if (t < start || t > start + dur + 0.05) return null;
  const vertical = !L.isPortrait; // landscape: vertical line sweeping across the width
  const span = vertical ? L.width : L.height;
  const pos = sweepPos(t, start, dur) * span;
  const vel = velocityOf((x) => sweepPos(x, start, dur) * span, t);
  const trail = clamp(Math.abs(vel) * 0.03, 0, span * 0.1);
  const color = env.color(el.color);
  const glow = el.intensity;
  const thick = 3 * L.u;
  const core = withAlpha('#FFFFFF', 0.9);
  const lineStyle = vertical
    ? { left: pos - thick / 2, top: 0, width: thick, height: L.height }
    : { top: pos - thick / 2, left: 0, height: thick, width: L.width };
  const trailStyle = vertical
    ? { left: pos - trail, top: 0, width: trail, height: L.height, background: `linear-gradient(90deg, transparent, ${withAlpha(color, 0.2 * glow)})` }
    : { top: pos - trail, left: 0, height: trail, width: L.width, background: `linear-gradient(180deg, transparent, ${withAlpha(color, 0.2 * glow)})` };
  return (
    <div data-lms-target={env.target('lightLine')} style={{ position: 'absolute', inset: 0, opacity: el.opacity, mixBlendMode: 'screen' }}>
      <div style={{ position: 'absolute', ...trailStyle }} />
      <div
        style={{
          position: 'absolute',
          ...lineStyle,
          background: `linear-gradient(${vertical ? '180deg' : '90deg'}, transparent, ${core} 18%, ${core} 82%, transparent)`,
          boxShadow: `0 0 ${round(14 * L.u * glow)}px ${round(2 * L.u * glow)}px ${withAlpha(color, 0.9)}, 0 0 ${round(70 * L.u * glow)}px ${round(
            6 * L.u * glow,
          )}px ${withAlpha(color, 0.32)}`,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Depth geometry: a tunnel of frames and particles the line reveals.  */
/* ------------------------------------------------------------------ */

const DepthField = ({ env, revealStart, exitStart }: { env: SceneEnv<ImpactScene>; revealStart: number; exitStart: number }) => {
  const { t, layout: L, scene } = env;
  const geo = scene.elements.geometry;
  const parts = scene.elements.particles;
  const dur = C.lightLine.dur / scene.animation.pace;
  const vertical = !L.isPortrait;
  const span = vertical ? L.width : L.height;
  const reveal = clamp(sweepPos(t, revealStart, dur)) * span;
  const clip = t >= revealStart + dur ? 'none' : vertical ? `inset(0 ${round(L.width - reveal)}px 0 0)` : `inset(0 0 ${round(L.height - reveal)}px 0)`;

  const exitP = progress(t, exitStart, C.exit, ease.inExpo);
  // Camera glides forward, then rushes through the tunnel on exit.
  const camZ = t * 140 + exitP * 2200;
  const cam = { x: 0, y: 0, z: camZ, focal: 1000 };
  const spacing = 520;
  const count = Math.round(4 + geo.intensity * 4);
  const frameW = L.width * (L.isPortrait ? 0.74 : 0.56);
  const frameH = L.height * (L.isPortrait ? 0.5 : 0.62);
  const fadeOut = 1 - progress(t, exitStart + C.exit * 0.4, C.exit * 0.6, ease.inCubic);

  const frames: ReactNode[] = [];
  if (geo.visible) {
    for (let i = 0; i < count; i++) {
      // Wrap frames around the camera so the tunnel is endless and deterministic.
      const loop = spacing * count;
      const z = (((i * spacing - camZ) % loop) + loop) % loop + camZ + 120;
      const p = project({ x: 0, y: 0, z }, cam);
      if (!p.visible) continue;
      const depth = p.depth;
      const op = depthOpacity(depth, 80, 420, spacing * count, spacing * 2.2);
      const w = frameW * p.scale;
      const h = frameH * p.scale;
      const rot = (i % 2 === 0 ? 1 : -1) * (1.2 + Math.sin(t * 0.6 + i) * 0.6);
      const stroke = Math.max(1, 2.2 * L.u * Math.min(2, p.scale));
      const tick = 26 * L.u * p.scale;
      const col = withAlpha(env.color(geo.color), geo.opacity * op);
      frames.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: L.cx - w / 2,
            top: L.cy - h / 2,
            width: w,
            height: h,
            border: `${round(stroke, 2)}px solid ${col}`,
            borderRadius: 18 * L.u * p.scale,
            transform: `rotate(${round(rot, 3)}deg)`,
          }}
        >
          {[0, 1, 2, 3].map((c) => (
            <div
              key={c}
              style={{
                position: 'absolute',
                width: tick,
                height: tick,
                left: c % 2 === 0 ? -tick / 2 : undefined,
                right: c % 2 === 1 ? -tick / 2 : undefined,
                top: c < 2 ? -tick / 2 : undefined,
                bottom: c >= 2 ? -tick / 2 : undefined,
                background: `linear-gradient(${col}, ${col}) center/100% ${round(stroke, 2)}px no-repeat, linear-gradient(${col}, ${col}) center/${round(stroke, 2)}px 100% no-repeat`,
              }}
            />
          ))}
        </div>,
      );
    }
  }

  const dots: ReactNode[] = [];
  if (parts.visible) {
    const n = Math.round(26 + parts.intensity * 34);
    const col = env.color(parts.color);
    for (let i = 0; i < n; i++) {
      const x = (randomAt('impact-p', i * 3) * 2 - 1) * L.width * 0.9;
      const y = (randomAt('impact-p', i * 3 + 1) * 2 - 1) * L.height * 0.9;
      const zBase = 300 + randomAt('impact-p', i * 3 + 2) * 2600;
      const loop = 2900;
      const z = (((zBase - camZ) % loop) + loop) % loop + camZ + 100;
      const p = project({ x, y, z }, cam);
      if (!p.visible) continue;
      const op = depthOpacity(p.depth, 60, 300, 2900, 900) * parts.opacity;
      const size = Math.max(1.2, (2 + randomAt('impact-s', i) * 3.5) * L.u * p.scale);
      dots.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: L.cx + p.x - size / 2,
            top: L.cy + p.y - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            background: col,
            opacity: op,
            boxShadow: size > 3 ? `0 0 ${round(size * 2)}px ${withAlpha(col, 0.6)}` : undefined,
          }}
        />,
      );
    }
  }

  const appear = progress(t, revealStart, 0.25);
  return (
    <div style={{ position: 'absolute', inset: 0, clipPath: clip, opacity: appear * fadeOut }}>
      <div data-lms-target={env.target('geometry')} style={{ position: 'absolute', inset: 0 }}>
        {frames}
      </div>
      <div data-lms-target={env.target('particles')} style={{ position: 'absolute', inset: 0 }}>
        {dots}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Kicker: decoding mono label.                                        */
/* ------------------------------------------------------------------ */

const decode = (text: string, t: number, start: number, seed: string) =>
  Array.from(text)
    .map((ch, i) => {
      if (ch === ' ') return ' ';
      const appear = start + i * 0.014;
      const lock = start + 0.22 + i * 0.022;
      if (t < appear) return ' ';
      if (t >= lock) return ch;
      const step = Math.floor(t * 30);
      return GLYPHS[Math.floor(randomAt(seed, i * 977 + step) * GLYPHS.length)]!;
    })
    .join('');

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

export const ImpactSceneView = ({ env }: { env: SceneEnv<ImpactScene> }) => {
  const { t, layout: L, scene, override: o, fps } = env;
  const { animation: anim } = scene;
  const P = L.isPortrait;
  const u = L.u;

  const box = {
    family: DISPLAY,
    size: (P ? 232 : 236) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.safe.width * 0.86) * o.scale,
    maxHeight: L.safe.height * (P ? 0.36 : 0.34),
    lineHeight: 0.9,
  };
  const a0 = useTextLayout(scene.texts.lineA, box, L.format);
  const b0 = useTextLayout(scene.texts.lineB, box, L.format);
  // Shared optical size so both lines read as one headline.
  const common = Math.min(a0.layout.fontSize / scene.texts.lineA.sizeScale, b0.layout.fontSize / scene.texts.lineB.sizeScale);
  const a = useTextLayout(scene.texts.lineA, { ...box, size: common }, L.format);
  const b = useTextLayout(scene.texts.lineB, { ...box, size: common }, L.format);
  const kicker = useTextLayout(
    scene.texts.kicker,
    { family: MONO, size: (P ? 30 : 26) * u, maxWidth: L.safe.width * 0.9, lineHeight: 1.2 },
    L.format,
  );

  const tLine = entranceAt(C.lightLine.in, anim);
  const tKick = entranceAt(C.kicker.in, anim, scene.texts.kicker.delay);
  const tA = entranceAt(C.lineA.in, anim, scene.texts.lineA.delay);
  const tB = entranceAt(C.lineB.in, anim, scene.texts.lineB.delay);
  const exitStart = env.duration - C.exit;
  const k = anim.intensity;

  const gap = common * 0.06;
  const aH = scene.texts.lineA.visible ? a.layout.height : 0;
  const bH = scene.texts.lineB.visible ? b.layout.height : 0;
  const kickH = scene.texts.kicker.visible ? kicker.layout.height + 34 * u : 0;
  const blockH = kickH + aH + gap + bH;

  // Framing: while only line A is on screen it sits centered; B pushes it up.
  const bIn = springWithIntensity(t - tB, SPRINGS.heavy, k * 0.6);
  const shiftY = (1 - bIn) * ((bH + gap) / 2);
  const push = 1.09 - 0.09 * progress(t, tA, 1.6, ease.cinematic) + 0.018 * progress(t, tB + 0.6, 2.5, ease.linear);

  const align = P ? o.align : o.align;
  const anchor = blockAnchor(L, o, { x: alignX(L, align), y: L.cy });

  // Exit: everything collapses into the light line that carries over to scene 2.
  const exitP = progress(t, exitStart + C.exit * 0.12, C.exit * 0.62, ease.inOutQuart);
  const lineGrow = progress(t, exitStart, C.exit * 0.55, ease.outExpo);
  const accent = env.palette.accent;

  const wordReveal = (start: number, i: number, fontSize: number, children: ReactNode) => {
    const s = start + i * (0.085 / anim.pace);
    const f = (x: number) => springWithIntensity(x - s, SPRINGS.type, k);
    const p = f(t);
    const blur = motionBlurFromVelocity(velocityOf(f, t) * fontSize, fps, 26 * u);
    return (
      <MaskReveal progress={p} direction="up">
        <DirectionalBlur as="span" y={blur} style={{ display: 'inline-block' }}>
          <span style={{ display: 'inline-block', transform: `skewY(${round((1 - clamp(p)) * 7 * k, 3)}deg)`, transformOrigin: '0% 100%' }}>
            {children}
          </span>
        </DirectionalBlur>
      </MaskReveal>
    );
  };

  const kickerText = decode(kicker.layout.lines.join(' '), t, tKick, 'kicker');
  const kickRule = progress(t, tKick - 0.1, 0.4, ease.cinematic);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneBackground env={env} />
      <DepthField env={env} revealStart={tLine} exitStart={exitStart} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${round(1 + exitP * 0.04, 4)}, ${round(1 - exitP * 0.985, 4)})`,
          transformOrigin: `50% ${round(L.cy)}px`,
          opacity: 1 - progress(t, exitStart + C.exit * 0.55, C.exit * 0.25, ease.inCubic),
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: anchor.x,
            top: anchor.y,
            transform: `translate(${alignShift(align)}, -50%) translateY(${round(shiftY)}px) scale(${round(push, 4)})`,
            transformOrigin: align === 'start' ? '0% 50%' : align === 'end' ? '100% 50%' : '50% 50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
            height: blockH,
          }}
        >
          {scene.texts.kicker.visible ? (
            <div
              data-lms-target={env.target('kicker')}
              style={{ display: 'flex', alignItems: 'center', gap: 18 * u, marginBottom: 34 * u, height: kicker.layout.height }}
            >
              <div style={{ width: 54 * u * kickRule, height: 2 * u, background: env.color(scene.texts.kicker.color) }} />
              <div
                style={{
                  fontFamily: `"${MONO}"`,
                  fontWeight: scene.texts.kicker.weight,
                  fontSize: kicker.layout.fontSize,
                  letterSpacing: `${scene.texts.kicker.tracking}em`,
                  color: env.color(scene.texts.kicker.color),
                  textTransform: scene.texts.kicker.uppercase ? 'uppercase' : 'none',
                  fontStyle: scene.texts.kicker.italic ? 'italic' : 'normal',
                  whiteSpace: 'pre',
                }}
              >
                {kickerText}
              </div>
            </div>
          ) : null}

          <TextBlock
            targetId={env.target('lineA')}
            text={a}
            color={env.color(scene.texts.lineA.color)}
            align={align}
            split="words"
            renderUnit={(unit, content) => wordReveal(tA, unit.index, a.layout.fontSize, content)}
          />
          <div style={{ height: gap }} />
          <TextBlock
            targetId={env.target('lineB')}
            text={b}
            color={env.color(scene.texts.lineB.color)}
            align={align}
            split="words"
            renderUnit={(unit, content) => {
              const fillStart = tB + 0.32 / anim.pace + unit.index * 0.12;
              const fp = progress(t, fillStart, 0.5, ease.inOut);
              const col = env.color(scene.texts.lineB.color);
              return wordReveal(
                tB,
                unit.index,
                b.layout.fontSize,
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  <span style={{ color: 'transparent', WebkitTextStroke: `${round(Math.max(1.5, 2.4 * u), 2)}px ${col}` }}>{content}</span>
                  <span style={{ position: 'absolute', left: 0, top: 0, clipPath: wipeClip(fp, 'right'), color: col }}>{content}</span>
                </span>,
              );
            }}
          />
        </div>
      </div>

      {/* Exit line: the motif collapses here and carries into the next scene. */}
      {lineGrow > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: L.cx - (L.width / 2) * lineGrow,
            width: L.width * lineGrow,
            top: L.cy - 1.5 * u,
            height: 3 * u,
            background: `linear-gradient(90deg, transparent, ${accent} 12%, #FFFFFF 50%, ${accent} 88%, transparent)`,
            boxShadow: `0 0 ${round(22 * u)}px ${round(3 * u)}px ${withAlpha(accent, 0.75)}`,
          }}
        />
      ) : null}

      <LightLine env={env} start={tLine} />
    </div>
  );
};
