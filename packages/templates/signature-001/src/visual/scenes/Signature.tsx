import type { ReactNode } from 'react';
import {
  DirectionalBlur,
  MaskReveal,
  SPRINGS,
  TAU,
  arcPath,
  circleLength,
  clamp,
  drawStroke,
  ease,
  lerp,
  motionBlurFromVelocity,
  progress,
  randomAt,
  round,
  springWithIntensity,
  velocityOf,
  wipeClip,
} from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SignatureScene } from '../../schema';
import { CHOREO, entranceAt } from '../../timing';
import { alignX, blockAnchor, signatureMark } from '../art';
import { SceneBackground } from '../Background';
import type { SceneEnv } from '../context';
import { DISPLAY, TEXT } from '../fonts';
import { TextBlock, useTextLayout } from '../TextBlock';

const C = CHOREO.signature;

export const SignatureSceneView = ({ env }: { env: SceneEnv<SignatureScene> }) => {
  const { t, layout: L, scene, override: o, fps } = env;
  const { animation: anim, elements: E } = scene;
  const P = L.isPortrait;
  const u = L.u;
  const k = anim.intensity;
  const D = env.duration;

  const tShards = entranceAt(C.shards.in, anim);
  const tRing = entranceAt(C.markRing.in, anim);
  const tDiamond = entranceAt(C.markDiamond.in, anim);
  const tCore = entranceAt(C.markCore.in, anim);
  const tHead = entranceAt(C.headline.in, anim, scene.texts.headline.delay);
  const tSub = entranceAt(C.subtitle.in, anim, scene.texts.subtitle.delay);
  const outro = D - C.outro;

  /* ---------------- final move ---------------- */
  const center = progress(t, outro + 0.18, 0.75, ease.inOutQuart);
  const textOut = (i: number) => progress(t, outro + i * 0.06, 0.42, ease.inCubic);
  const lineOut = progress(t, outro + 0.42, 0.55, ease.cinematic);

  const base = signatureMark(L);
  const finalSize = base.size * (P ? 0.9 : 0.78);
  const M = {
    x: lerp(base.x, L.cx, center),
    y: lerp(base.y, P ? L.cy - 40 * u : L.cy, center),
    size: lerp(base.size, finalSize, center),
  };
  const hold = progress(t, tHead + 0.8, Math.max(0.1, outro - tHead), ease.linear);
  const breathe = 1 + Math.sin(t * 2.4) * 0.025;
  const R = M.size / 2;

  /* ---------------- shards converge ---------------- */
  const shards: ReactNode[] = [];
  if (E.shards.visible) {
    const n = Math.round(10 + E.shards.intensity * 10);
    const sc = env.color(E.shards.color);
    for (let i = 0; i < n; i++) {
      const a0 = randomAt('sig-a', i) * TAU;
      const far = Math.hypot(L.width, L.height) * (0.55 + randomAt('sig-r', i) * 0.25);
      const sx = L.cx + Math.cos(a0) * far;
      const sy = L.cy + Math.sin(a0) * far;
      const a1 = (i / n) * TAU - Math.PI / 2;
      const tx = base.x + Math.cos(a1) * R;
      const ty = base.y + Math.sin(a1) * R;
      const start = tShards + randomAt('sig-d', i) * 0.32;
      const dur = 0.62;
      const f = (x: number) => progress(x, start, dur, ease.snap);
      const p = f(t);
      if (p <= 0 || t > start + dur + 0.25) continue;
      const x = lerp(sx, tx, p);
      const y = lerp(sy, ty, p);
      const speed = Math.abs(velocityOf(f, t)) * Math.hypot(tx - sx, ty - sy);
      const len = (10 + Math.min(260, speed * 0.05)) * u;
      const ang = Math.atan2(ty - sy, tx - sx);
      const fade = p >= 1 ? 1 - clamp((t - start - dur) / 0.25) : 1;
      const kind = i % 3;
      shards.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x - len,
            top: y - (kind === 2 ? 3 : 1.25) * u,
            width: len,
            height: (kind === 2 ? 6 : 2.5) * u,
            transformOrigin: '100% 50%',
            transform: `rotate(${round((ang * 180) / Math.PI, 3)}deg)`,
            background: `linear-gradient(90deg, transparent, ${kind === 1 ? env.palette.accent : sc})`,
            borderRadius: 4 * u,
            opacity: E.shards.opacity * fade,
          }}
        />,
      );
    }
  }

  /* ---------------- the mark ---------------- */
  const ringDraw = progress(t, tRing, C.markRing.dur / anim.pace, ease.cinematic);
  const ringCol = env.color(E.markRing.color);
  const ringW = 3 * u * (0.5 + E.markRing.intensity * 0.5);
  const dIn = springWithIntensity(t - tDiamond, SPRINGS.heavy, k);
  const dRot = lerp(-135, 45, clamp(dIn, 0, 1.3)) + center * 90 + hold * 8 * (1 - center);
  const dSize = M.size * 0.54 * Math.max(0, dIn);
  const dCol = env.color(E.markDiamond.color);
  const cIn = springWithIntensity(t - tCore, SPRINGS.bouncy, k);
  const coreR = M.size * 0.11 * Math.max(0, cIn) * breathe;
  const cCol = env.color(E.markCore.color);
  const lineIn = progress(t, tCore + 0.12, 0.6, ease.cinematic);
  const lineHalf = lerp(R * 1.55 * lineIn, Math.max(L.width, L.height), lineOut);
  const orbitA = -Math.PI / 2 + t * 0.9;

  const mark = (
    <>
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {E.markRing.visible ? (
          <g data-lms-target={env.target('markRing')} opacity={E.markRing.opacity}>
            <circle
              cx={M.x}
              cy={M.y}
              r={R}
              fill="none"
              stroke={ringCol}
              strokeWidth={ringW}
              transform={`rotate(-90 ${M.x} ${M.y})`}
              {...drawStroke(ringDraw, circleLength(R))}
            />
            <circle
              cx={M.x}
              cy={M.y}
              r={R * 1.16}
              fill="none"
              stroke={ringCol}
              strokeOpacity={0.35}
              strokeWidth={1.2 * u}
              strokeDasharray={`${round(2 * u)} ${round(10 * u)}`}
              opacity={progress(t, tRing + 0.4, 0.5)}
              transform={`rotate(${round(t * 6, 3)} ${M.x} ${M.y})`}
            />
            <path
              d={arcPath(M.x, M.y, R * 1.16, -Math.PI * 0.62, -Math.PI * 0.62 + TAU * 0.12 * progress(t, tRing + 0.5, 0.6, ease.cinematic))}
              fill="none"
              stroke={env.palette.accent}
              strokeWidth={3 * u}
              strokeLinecap="round"
            />
            {ringDraw >= 1 ? (
              <circle cx={M.x + Math.cos(orbitA) * R} cy={M.y + Math.sin(orbitA) * R} r={6 * u} fill={ringCol} />
            ) : null}
          </g>
        ) : null}
        {E.markDiamond.visible && dSize > 0 ? (
          <g data-lms-target={env.target('markDiamond')} opacity={E.markDiamond.opacity} transform={`rotate(${round(dRot, 3)} ${M.x} ${M.y})`}>
            <rect
              x={M.x - dSize / 2}
              y={M.y - dSize / 2}
              width={dSize}
              height={dSize}
              fill={withAlpha(dCol, 0.16)}
              stroke={dCol}
              strokeWidth={3.2 * u * (0.5 + E.markDiamond.intensity * 0.5)}
            />
            <path
              d={`M ${M.x - dSize / 2} ${M.y + dSize / 2} L ${M.x + dSize / 2} ${M.y - dSize / 2} L ${M.x + dSize / 2} ${M.y + dSize / 2} Z`}
              fill={withAlpha(dCol, 0.55)}
              opacity={progress(t, tDiamond + 0.35, 0.4)}
            />
          </g>
        ) : null}
      </svg>
      {E.markCore.visible ? (
        <div data-lms-target={env.target('markCore')} style={{ position: 'absolute', inset: 0, opacity: E.markCore.opacity }}>
          {lineIn > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: M.x - lineHalf,
                width: lineHalf * 2,
                top: M.y - 1.5 * u,
                height: 3 * u,
                background: `linear-gradient(90deg, transparent, ${cCol} 22%, #FFFFFF 50%, ${cCol} 78%, transparent)`,
                boxShadow: `0 0 ${round(18 * u * E.markCore.intensity)}px ${round(2 * u)}px ${withAlpha(cCol, 0.6)}`,
                opacity: 1 - lineOut * 0.45,
              }}
            />
          ) : null}
          {coreR > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: M.x - coreR,
                top: M.y - coreR,
                width: coreR * 2,
                height: coreR * 2,
                borderRadius: '50%',
                background: `radial-gradient(circle at 40% 36%, #FFFFFF 0%, ${cCol} 45%, ${cCol} 100%)`,
                boxShadow: `0 0 ${round(50 * u * E.markCore.intensity)}px ${round(6 * u)}px ${withAlpha(cCol, 0.5)}`,
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );

  /* ---------------- typography ---------------- */
  const textLeft = base.x + base.size / 2 + 120 * u;
  const colW = P ? L.safe.width : L.width - L.safe.right - textLeft;
  const head = useTextLayout(
    scene.texts.headline,
    { family: DISPLAY, size: (P ? 168 : 150) * u * o.scale, maxWidth: colW * o.scale, maxHeight: L.safe.height * (P ? 0.36 : 0.5), lineHeight: 0.92 },
    L.format,
  );
  const sub = useTextLayout(
    scene.texts.subtitle,
    { family: TEXT, size: (P ? 44 : 40) * u * o.scale, maxWidth: colW * o.scale, lineHeight: 1.3 },
    L.format,
  );
  const align = P ? o.align : o.align;
  const anchor = P
    ? blockAnchor(L, o, { x: alignX(L, align), y: L.height * 0.635 })
    : blockAnchor(L, o, { x: align === 'start' ? textLeft : align === 'end' ? L.width - L.safe.right : textLeft + colW / 2, y: L.cy });
  const shift = align === 'start' ? '0%' : align === 'end' ? '-100%' : '-50%';
  const highlight = scene.props.highlightWord;
  const accent = env.palette.accent;
  const rule = progress(t, tSub - 0.15, 0.5, ease.cinematic) * (1 - textOut(3));
  const headCol = env.color(scene.texts.headline.color);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneBackground env={env} focus={{ x: M.x, y: M.y }} />
      <div data-lms-target={env.target('shards')} style={{ position: 'absolute', inset: 0 }}>
        {shards}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${round(1 + hold * 0.025, 4)})`,
          transformOrigin: `${round(M.x)}px ${round(M.y)}px`,
        }}
      >
        {mark}
      </div>

      <div
        style={{
          position: 'absolute',
          left: anchor.x,
          top: anchor.y,
          transform: `translate(${shift}, -50%) scale(${round(1 + hold * 0.02, 4)})`,
          transformOrigin: align === 'start' ? '0% 50%' : align === 'end' ? '100% 50%' : '50% 50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
        }}
      >
        <TextBlock
          targetId={env.target('headline')}
          text={head}
          color={headCol}
          align={align}
          split="words"
          renderUnit={(unit, content) => {
            const s = tHead + unit.index * (0.09 / anim.pace);
            const f = (x: number) => springWithIntensity(x - s, SPRINGS.type, k);
            const p = f(t) - textOut(unit.lineIndex) * 1.1;
            const blur = motionBlurFromVelocity(velocityOf(f, t) * head.layout.fontSize, fps, 24 * u);
            return (
              <MaskReveal progress={p} direction="up">
                <DirectionalBlur as="span" y={blur} style={{ display: 'inline-block', color: unit.index === highlight ? accent : undefined }}>
                  {content}
                </DirectionalBlur>
              </MaskReveal>
            );
          }}
        />
        {scene.texts.subtitle.visible ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'inherit', marginTop: (P ? 54 : 46) * u }}>
            <div style={{ width: 72 * u * rule, height: 3 * u, background: accent, marginBottom: 26 * u }} />
            <TextBlock
              targetId={env.target('subtitle')}
              text={sub}
              color={withAlpha(env.color(scene.texts.subtitle.color), 0.86)}
              align={align}
              split="lines"
              renderUnit={(unit, content) => {
                const s = tSub + unit.lineIndex * 0.14;
                const p = progress(t, s, 0.7, ease.cinematic);
                const out = textOut(3 + unit.lineIndex);
                return (
                  <span
                    style={{
                      display: 'inline-block',
                      clipPath: wipeClip(p - out, out > 0 ? 'left' : 'right'),
                      opacity: 1 - out,
                      transform: `translateY(${round((1 - p) * 18 * u, 2)}px)`,
                    }}
                  >
                    {content}
                  </span>
                );
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
