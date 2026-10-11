import type { ReactNode } from 'react';
import { Img } from 'remotion';
import { TAU, arcPath, clamp, ease, lerp, progress, randomAt, randomRange, round } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import { useAssets, type SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, alignX } from '@lms/scene-kit';
import { OUTRO_CHOREO as C, type CinematicOutroScene } from '../scenes/cinematicOutro';
import { at } from '../common';
import { Anchor, MaskedLines, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<CinematicOutroScene>;

const hexPath = (cx: number, cy: number, r: number, rot: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = rot + (i / 6) * TAU - Math.PI / 2;
    return `${i ? 'L' : 'M'}${round(cx + Math.cos(a) * r, 2)} ${round(cy + Math.sin(a) * r, 2)}`;
  }).join(' ') + ' Z';

export const CinematicOutroView = ({ env }: { env: Env }) => {
  const assets = useAssets();
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const E = scene.elements;
  const k = 0.5 + E.flare.intensity * 0.5;
  const exitStart = env.duration - C.exit;
  const black = progress(t, exitStart + 0.15, C.exit - 0.15, ease.inOutQuart);

  const R = (P ? 170 : 150) * u * o.scale;
  const ex = alignX(L, o.align) + o.offsetX * L.safe.width;
  const ey = (P ? L.height * 0.37 : L.height * 0.35) + o.offsetY * L.safe.height;
  const primary = env.color(E.emblem.color);
  const secondary = env.color(E.streaks.color);

  /* ---------- converging streaks ---------- */
  const tStreak = at(C.streaks.in, anim);
  const tConverge = tStreak + C.streaks.dur / anim.pace;
  const streaks: ReactNode[] = [];
  if (E.streaks.visible) {
    const n = Math.round(14 + E.streaks.intensity * 16);
    const far = Math.max(L.width, L.height) * 0.5;
    for (let i = 0; i < n; i++) {
      const a = randomAt('co-a', i) * TAU;
      const s = tStreak + randomRange('co-s', i, -0.15, 0.4);
      const dur = tConverge - s;
      const p = progress(t, s, dur, (x) => x * x);
      if (p <= 0 || p >= 1) continue;
      const d = lerp(far, R * 1.05, p);
      const tail = (220 + 520 * p) * u * randomRange('co-l', i, 0.6, 1.2);
      const x1 = ex + Math.cos(a) * d;
      const y1 = ey + Math.sin(a) * d;
      const x0 = ex + Math.cos(a) * (d + tail);
      const y0 = ey + Math.sin(a) * (d + tail);
      const c = randomAt('co-c', i) > 0.7 ? primary : secondary;
      streaks.push(
        <g key={i}>
          <defs>
            <linearGradient id={`co-g${i}`} gradientUnits="userSpaceOnUse" x1={x0} y1={y0} x2={x1} y2={y1}>
              <stop offset="0" stopColor={c} stopOpacity={0} />
              <stop offset="1" stopColor={c} stopOpacity={E.streaks.opacity} />
            </linearGradient>
          </defs>
          <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={`url(#co-g${i})`} strokeWidth={Math.max(1, randomRange('co-w', i, 1.2, 3.2) * u)} strokeLinecap="round" />
          <circle cx={x1} cy={y1} r={Math.max(1, 2.4 * u)} fill="#FFFFFF" opacity={0.8 * E.streaks.opacity} />
        </g>,
      );
    }
  }

  /* ---------- flare at convergence ---------- */
  const fq = progress(t, tConverge - 0.08, 0.7);
  const flare = E.flare.visible && fq > 0 && fq < 1 ? Math.sin(Math.PI * Math.min(1, fq * 1.6)) * (1 - fq) * k * E.flare.opacity : 0;
  const flareColor = env.color(E.flare.color);

  /* ---------- emblem ---------- */
  const tEm = at(C.emblem.in, anim);
  const draw = (delay: number, dur = 0.8) => progress(t, tEm + delay, dur, ease.cinematic);
  const sw = Math.max(1.5, (2 + 2 * E.emblem.intensity) * u);
  const ringC = TAU * R;
  const rot = t * 0.25;
  const hexLen = 6 * R * 0.78;
  const logo = assets.url(scene.props.logoAssetId);
  const breathe = 1 + Math.sin(t * 1.8) * 0.012;
  const coreIn = draw(0.35, 0.6);

  /* ---------- text ---------- */
  const headline = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 112 : 104) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.7) * o.scale,
    maxHeight: (P ? L.height * 0.2 : L.height * 0.2) * o.scale,
    lineHeight: 1,
  });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 40 : 36) * u * o.scale, maxWidth: (P ? L.safe.width : L.width * 0.6) * o.scale, lineHeight: 1.3 });
  const sig = useRoleText(env, scene.texts.signature, 'mono', { size: (P ? 22 : 20) * u, maxWidth: L.safe.width, lineHeight: 1.2 });
  const textTop = ey + R + (P ? 110 : 80) * u;
  const tHead = at(C.headline.in, anim, scene.texts.headline.delay);
  const headP = progress(t, tHead, 1.1, ease.cinematic);
  const sigIn = progress(t, at(C.signature.in, anim, scene.texts.signature.delay), 0.7, ease.cinematic);
  const blockW = Math.max(headline.layout.width, sub.layout.width, sig.layout.width) + 60 * u;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: ex, y: ey }} />
      <div
        style={{
          position: 'absolute',
          left: ex - R * 4,
          top: ey - R * 4,
          width: R * 8,
          height: R * 8,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${withAlpha(primary, 0.16 * coreIn)} 0%, transparent 60%)`,
        }}
      />
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g data-lms-target={env.target('streaks')}>{streaks}</g>
        {E.emblem.visible && (
          <g data-lms-target={env.target('emblem')} opacity={E.emblem.opacity} transform={`translate(${ex} ${ey}) scale(${round(breathe, 4)}) translate(${-ex} ${-ey})`}>
            <circle cx={ex} cy={ey} r={R} fill="none" stroke={primary} strokeWidth={sw} strokeDasharray={`${ringC * draw(0)} ${ringC}`} transform={`rotate(-90 ${ex} ${ey})`} />
            <circle cx={ex} cy={ey} r={R * 1.18} fill="none" stroke={withAlpha(primary, 0.35)} strokeWidth={Math.max(1, u)} strokeDasharray={`${2 * u} ${9 * u}`} opacity={draw(0.2)} />
            {!logo && (
              <path d={hexPath(ex, ey, R * 0.78, rot)} fill="none" stroke={primary} strokeWidth={sw} strokeLinejoin="round" strokeDasharray={`${hexLen * draw(0.15)} ${hexLen}`} />
            )}
            <path d={arcPath(ex, ey, R * 1.32, -rot * 2.2, -rot * 2.2 + 1.2 * draw(0.3))} fill="none" stroke={secondary} strokeWidth={sw} strokeLinecap="round" />
            <path d={arcPath(ex, ey, R * 1.32, Math.PI - rot * 2.2, Math.PI - rot * 2.2 + 0.5 * draw(0.4))} fill="none" stroke={primary} strokeWidth={sw} strokeLinecap="round" />
            {!logo && (
              <>
                <circle cx={ex} cy={ey} r={R * 0.22 * coreIn} fill={primary} />
                <circle cx={ex} cy={ey} r={R * 0.09 * coreIn} fill="#FFFFFF" />
              </>
            )}
          </g>
        )}
      </svg>

      {logo && E.emblem.visible && (
        <div
          style={{
            position: 'absolute',
            left: ex - R * 0.62,
            top: ey - R * 0.62,
            width: R * 1.24,
            height: R * 1.24,
            clipPath: `circle(${round(coreIn * 50, 2)}% at 50% 50%)`,
            transform: `scale(${round(lerp(1.15, 1, coreIn), 4)})`,
          }}
        >
          <Img src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}

      {/* Flare: round burst + anamorphic streak */}
      {flare > 0 && (
        <div data-lms-target={env.target('flare')} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: ex - R * 3,
              top: ey - R * 3,
              width: R * 6,
              height: R * 6,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${withAlpha(flareColor, 0.95 * flare)} 0%, ${withAlpha(primary, 0.4 * flare)} 18%, transparent 55%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: L.width,
              top: ey - 3 * u,
              height: 6 * u,
              background: `linear-gradient(90deg, transparent, ${withAlpha(secondary, 0.8 * flare)} 35%, ${withAlpha(flareColor, flare)} 50%, ${withAlpha(secondary, 0.8 * flare)} 65%, transparent)`,
            }}
          />
        </div>
      )}

      <Anchor x={ex} y={textTop} align={o.align} width={blockW}>
        <div style={{ filter: `blur(${round((1 - headP) * 10 * u, 2)}px)`, transform: `scale(${round(lerp(1.06, 1, headP), 4)})`, transformOrigin: 'center top' }}>
          <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={o.align} start={tHead} each={0.1} dur={0.9} targetId={env.target('headline')} />
        </div>
        <div style={{ height: 22 * u }} />
        <MaskedLines text={sub} env={env} color={withAlpha(env.color(scene.texts.sub.color), 0.8)} align={o.align} start={at(C.sub.in, anim, scene.texts.sub.delay)} targetId={env.target('sub')} />
        <div style={{ height: (P ? 70 : 54) * u }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 * u, justifyContent: o.align === 'start' ? 'flex-start' : o.align === 'end' ? 'flex-end' : 'center' }}>
          <div style={{ height: Math.max(1, 1.5 * u), width: 70 * u * sigIn, background: env.palette.accent }} />
          <MaskedLines text={sig} env={env} color={env.color(scene.texts.signature.color)} align={o.align} start={at(C.signature.in, anim, scene.texts.signature.delay)} targetId={env.target('signature')} />
          <div style={{ height: Math.max(1, 1.5 * u), width: 70 * u * sigIn, background: env.palette.accent }} />
        </div>
      </Anchor>

      {/* Controlled exit: fade to black, the emblem core keeps a last glint. */}
      {black > 0 && <div style={{ position: 'absolute', inset: 0, background: '#000000', opacity: black }} />}
      {black > 0 && black < 1 && (
        <div
          style={{
            position: 'absolute',
            left: ex - R * 0.6,
            top: ey - R * 0.6,
            width: R * 1.2,
            height: R * 1.2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha('#FFFFFF', clamp(Math.sin(Math.PI * black)) * 0.9)} 0%, ${withAlpha(primary, 0.4 * Math.sin(Math.PI * black))} 25%, transparent 65%)`,
          }}
        />
      )}
    </div>
  );
};
