import type { CSSProperties, ReactNode } from 'react';
import {
  SPRINGS,
  STRETCH_PERCENT,
  TAU,
  clamp,
  depthOpacity,
  drawStroke,
  ease,
  keyframes,
  lerp,
  progress,
  project,
  round,
  springWithIntensity,
  type Camera,
  type FrameLayout,
} from '@lms/motion-core';
import { mixHex, withAlpha } from '@lms/shared';
import type { TransformationScene } from '../../schema';
import { CHOREO, TRANSFORMATION_CLOCK } from '../../timing';
import { SceneBackground } from '../Background';
import type { SceneEnv } from '../context';
import { DISPLAY, MONO } from '../fonts';
import { useTextLayout, type ResolvedText } from '../TextBlock';

const C = CHOREO.transformation;
const FOCAL = 1000;

/** Camera dolly on the normalized clock: decelerate into each word, dwell, rush on. */
const cameraZ = (tau: number) =>
  keyframes(tau, [
    [0, -950],
    [0.85, -70, ease.cinematic],
    [1.3, 45, ease.linear],
    [1.85, 925, ease.inOut],
    [2.3, 1045, ease.linear],
    [2.85, 1925, ease.inOut],
    [3.45, 2050, ease.linear],
    [4.0, 2440, ease.inCubic],
    [4.7, 2860, ease.linear],
  ]);

const textStyle = (text: ResolvedText, color: string): CSSProperties => ({
  fontFamily: `"${DISPLAY}"`,
  fontWeight: text.el.weight,
  fontStyle: text.el.italic ? 'italic' : 'normal',
  fontStretch: STRETCH_PERCENT[text.el.stretch],
  fontSize: text.layout.fontSize,
  lineHeight: text.layout.lineHeight,
  letterSpacing: `${text.el.tracking}em`,
  color,
  whiteSpace: 'pre',
});

/** A flat card positioned in camera space. */
const Plane = ({
  cam,
  L,
  x,
  y,
  z,
  children,
  focusBlur = 0,
  targetId,
  fadeNear = 260,
}: {
  cam: Camera;
  L: FrameLayout;
  x: number;
  y: number;
  z: number;
  children: ReactNode;
  focusBlur?: number;
  targetId?: string;
  fadeNear?: number;
}) => {
  const p = project({ x, y, z }, cam);
  if (!p.visible) return null;
  const op = depthOpacity(p.depth, 40, fadeNear, 3200, 900);
  if (op <= 0.001) return null;
  const blur = focusBlur > 0 ? Math.min(18, (Math.abs(p.depth - FOCAL) / FOCAL) * focusBlur) * L.u : 0;
  return (
    <div
      data-lms-target={targetId}
      style={{
        position: 'absolute',
        left: L.cx + p.x,
        top: L.cy + p.y,
        transform: `translate(-50%, -50%) scale(${round(p.scale, 5)})`,
        // Painter's algorithm: nearer planes on top.
        zIndex: Math.round(100000 / p.depth),
        opacity: op,
        filter: blur > 0.3 ? `blur(${round(blur / p.scale, 2)}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* CREATE. — assembled from horizontal slices, framed by a selection    */
/* ------------------------------------------------------------------ */

const CreateWord = ({ env, text, l }: { env: SceneEnv<TransformationScene>; text: ResolvedText; l: number }) => {
  const { scene, layout: L } = env;
  const k = scene.animation.intensity;
  const color = env.color(text.el.color);
  const line = text.layout.lines.join(' ');
  const W = text.layout.width;
  const H = text.layout.height;
  const N = 6;
  const slices: ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const p = springWithIntensity(l - i * 0.045, SPRINGS.heavy, k * 0.8);
    const dir = i % 2 === 0 ? -1 : 1;
    const off = dir * (1 - p) * L.width * 0.55;
    const top = (i / N) * 100;
    const bottom = 100 - ((i + 1) / N) * 100;
    slices.push(
      <div
        key={i}
        style={{
          ...textStyle(text, color),
          position: i === 0 ? 'relative' : 'absolute',
          left: 0,
          top: 0,
          clipPath: `inset(${round(top - 0.4, 3)}% -10% ${round(bottom - 0.4, 3)}% -10%)`,
          transform: `translateX(${round(off, 2)}px) skewX(${round((1 - clamp(p)) * dir * -18, 3)}deg)`,
          opacity: clamp(p * 3),
        }}
      >
        {line}
      </div>,
    );
  }
  const guides = scene.elements.guides;
  const box = progress(l, 0.5, 0.45, ease.cinematic);
  const gc = env.color(guides.color);
  const pad = 26 * L.u;
  const corner = 34 * L.u * box;
  const cornerStyle = (pos: CSSProperties): CSSProperties => ({ position: 'absolute', width: corner, height: corner, ...pos });
  const bw = 3 * L.u;
  return (
    <div style={{ position: 'relative' }}>
      {slices}
      {guides.visible && box > 0 ? (
        <div data-lms-target={env.target('guides')} style={{ position: 'absolute', left: -pad, top: -pad, width: W + pad * 2, height: H + pad * 2, opacity: guides.opacity }}>
          <div style={{ position: 'absolute', inset: 0, border: `${round(1.2 * L.u, 2)}px solid ${withAlpha(gc, 0.35 * box)}` }} />
          <div style={cornerStyle({ left: 0, top: 0, borderLeft: `${bw}px solid ${gc}`, borderTop: `${bw}px solid ${gc}` })} />
          <div style={cornerStyle({ right: 0, top: 0, borderRight: `${bw}px solid ${gc}`, borderTop: `${bw}px solid ${gc}` })} />
          <div style={cornerStyle({ left: 0, bottom: 0, borderLeft: `${bw}px solid ${gc}`, borderBottom: `${bw}px solid ${gc}` })} />
          <div style={cornerStyle({ right: 0, bottom: 0, borderRight: `${bw}px solid ${gc}`, borderBottom: `${bw}px solid ${gc}` })} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: `calc(100% + ${round(14 * L.u)}px)`,
              fontFamily: `"${MONO}"`,
              fontSize: 20 * L.u,
              letterSpacing: '0.18em',
              color: gc,
              opacity: progress(l, 0.75, 0.3),
              whiteSpace: 'pre',
            }}
          >
            {`W ${Math.round(W)}  H ${Math.round(H)}  ·  LAYER 01`}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* ANIMATE. — characters land with bounce and ride a motion path       */
/* ------------------------------------------------------------------ */

const bezier = (p0: number, p1: number, p2: number, p3: number, s: number) =>
  (1 - s) ** 3 * p0 + 3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s ** 2 * p2 + s ** 3 * p3;

const AnimateWord = ({ env, text, l, tau }: { env: SceneEnv<TransformationScene>; text: ResolvedText; l: number; tau: number }) => {
  const { scene, layout: L } = env;
  const k = scene.animation.intensity;
  const color = env.color(text.el.color);
  const second = env.palette.secondary;
  const chars = Array.from(text.layout.lines.join(' '));
  const W = text.layout.width;
  const H = text.layout.height;
  const settle = progress(l, 0.55, 0.3);
  const guides = scene.elements.guides;
  const gc = env.color(guides.color);

  // Motion path under the word (AE-style), drawn then traveled by a keyframe dot.
  const pathY = H * 1.12;
  const P0 = [-W * 0.04, pathY + 40 * L.u];
  const P1 = [W * 0.28, pathY - 70 * L.u];
  const P2 = [W * 0.66, pathY + 110 * L.u];
  const P3 = [W * 1.04, pathY - 10 * L.u];
  const d = `M ${P0[0]} ${P0[1]} C ${P1[0]} ${P1[1]}, ${P2[0]} ${P2[1]}, ${P3[0]} ${P3[1]}`;
  const draw = progress(l, 0.15, 0.6, ease.cinematic);
  const travel = progress(l, 0.3, 0.9, ease.inOut);
  const dot = [bezier(P0[0]!, P1[0]!, P2[0]!, P3[0]!, travel), bezier(P0[1]!, P1[1]!, P2[1]!, P3[1]!, travel)];

  return (
    <div style={{ position: 'relative', ...textStyle(text, color) }}>
      {chars.map((ch, i) => {
        const p = springWithIntensity(l - i * 0.042, SPRINGS.bouncy, k);
        const wave = Math.sin(tau * 7.5 - i * 0.7) * settle;
        const crest = clamp(wave);
        const y = -(1 - p) * 1.25 * text.layout.fontSize - wave * 0.06 * text.layout.fontSize * k;
        const rot = (1 - p) * -28 + wave * 3 * k;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${round(y, 2)}px) rotate(${round(rot, 3)}deg)`,
              transformOrigin: '50% 100%',
              opacity: clamp(p * 2.5),
              color: mixHex(color, second, crest * 0.85),
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
      {guides.visible ? (
        <svg data-lms-target={env.target('guides')} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: guides.opacity }}>
          <path d={d} fill="none" stroke={withAlpha(gc, 0.7)} strokeWidth={2.4 * L.u} strokeDasharray={`${round(10 * L.u)} ${round(9 * L.u)}`} opacity={draw} />
          {[0, 0.33, 0.66, 1].map((s, i) => {
            const x = bezier(P0[0]!, P1[0]!, P2[0]!, P3[0]!, s);
            const yk = bezier(P0[1]!, P1[1]!, P2[1]!, P3[1]!, s);
            const on = progress(l, 0.2 + i * 0.12, 0.2, ease.back(2));
            const sz = 11 * L.u * on;
            return <rect key={i} x={x - sz} y={yk - sz} width={sz * 2} height={sz * 2} fill={i <= travel * 3.01 ? gc : 'none'} stroke={gc} strokeWidth={2 * L.u} transform={`rotate(45 ${x} ${yk})`} />;
          })}
          {travel > 0 && travel < 1 ? <circle cx={dot[0]} cy={dot[1]} r={9 * L.u} fill="#FFFFFF" style={{ filter: `drop-shadow(0 0 ${round(12 * L.u)}px ${gc})` }} /> : null}
        </svg>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* INSPIRE. — ignites: tracking collapses, light sweeps, rays burst     */
/* ------------------------------------------------------------------ */

const InspireWord = ({ env, text, l }: { env: SceneEnv<TransformationScene>; text: ResolvedText; l: number }) => {
  const { scene, layout: L } = env;
  const k = scene.animation.intensity;
  const color = env.color(text.el.color);
  const line = text.layout.lines.join(' ');
  const W = text.layout.width;
  const H = text.layout.height;
  const inP = progress(l, 0, 0.75, ease.cinematic);
  const tracking = lerp(0.55, text.el.tracking, inP);
  const blur = (1 - inP) * 22 * L.u;
  const sweep = progress(l, 0.55, 0.65, ease.inOut);
  const glow = progress(l, 0.4, 0.5) * k;
  const guides = scene.elements.guides;
  const rays: ReactNode[] = [];
  if (guides.visible) {
    const n = Math.round(10 + guides.intensity * 8);
    const rp = progress(l, 0.3, 0.7, ease.outExpo);
    const fade = 1 - progress(l, 0.75, 0.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      const r0 = Math.max(W, H) * 0.42 + 20 * L.u;
      const r1 = r0 + rp * L.width * 0.22 * (0.6 + (i % 3) * 0.25);
      const ra = r0 + (r1 - r0) * 0.55 * rp;
      rays.push(
        <line
          key={i}
          x1={W / 2 + Math.cos(a) * ra}
          y1={H / 2 + Math.sin(a) * ra * 0.6}
          x2={W / 2 + Math.cos(a) * r1}
          y2={H / 2 + Math.sin(a) * r1 * 0.6}
          stroke={env.color(guides.color)}
          strokeWidth={2.2 * L.u}
          strokeLinecap="round"
          opacity={fade * guides.opacity}
        />,
      );
    }
  }
  const base = textStyle(text, color);
  return (
    <div style={{ position: 'relative' }}>
      <svg data-lms-target={env.target('guides')} width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {rays}
      </svg>
      <div
        style={{
          ...base,
          letterSpacing: `${round(tracking, 4)}em`,
          filter: blur > 0.3 ? `blur(${round(blur, 2)}px)` : undefined,
          opacity: clamp(inP * 1.6),
          textShadow: glow > 0 ? `0 0 ${round(42 * L.u * glow)}px ${withAlpha(color, 0.55)}, 0 0 ${round(120 * L.u * glow)}px ${withAlpha(color, 0.3)}` : undefined,
        }}
      >
        {line}
      </div>
      {sweep > 0 && sweep < 1 ? (
        <div
          aria-hidden
          style={{
            ...base,
            letterSpacing: `${round(tracking, 4)}em`,
            position: 'absolute',
            left: 0,
            top: 0,
            color: 'transparent',
            backgroundImage: `linear-gradient(100deg, transparent ${round(sweep * 130 - 30, 2)}%, rgba(255,255,255,0.95) ${round(sweep * 130 - 15, 2)}%, transparent ${round(
              sweep * 130,
              2,
            )}%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
          }}
        >
          {line}
        </div>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

export const TransformationSceneView = ({ env }: { env: SceneEnv<TransformationScene> }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const k = scene.animation.intensity;
  const tau = (t * TRANSFORMATION_CLOCK) / env.duration;
  const pace = scene.animation.pace;
  const local = (base: number, delay: number) => (tau - base / pace) - (delay * TRANSFORMATION_CLOCK) / env.duration;

  const box = {
    family: DISPLAY,
    size: (P ? 214 : 236) * u * o.scale,
    maxWidth: (P ? L.safe.width * 0.94 : L.width * 0.56) * o.scale,
    lineHeight: 0.92,
  };
  const w1 = useTextLayout(scene.texts.word1, box, L.format);
  const w2 = useTextLayout(scene.texts.word2, box, L.format);
  const w3 = useTextLayout(scene.texts.word3, box, L.format);

  const cam: Camera = {
    x: Math.sin(tau * 0.9) * 40 * u,
    y: Math.cos(tau * 0.7) * 18 * u,
    z: cameraZ(tau),
    focal: FOCAL,
    roll: Math.sin(tau * 0.8) * 0.02,
  };

  const ox = o.offsetX * L.safe.width;
  const oy = o.offsetY * L.safe.height;
  const alignOff = o.align === 'start' ? -0.12 : o.align === 'end' ? 0.12 : 0;
  const pos = P
    ? [
        { x: 0, y: -0.11 * L.height },
        { x: 0, y: 0.09 * L.height },
        { x: 0, y: -0.01 * L.height },
      ]
    : [
        { x: -0.12 * L.width, y: -0.05 * L.height },
        { x: 0.12 * L.width, y: 0.05 * L.height },
        { x: 0, y: 0 },
      ];
  const place = (i: number) => ({ x: pos[i]!.x + ox + alignOff * L.width, y: pos[i]!.y + oy });

  /* ---- depth frames ---- */
  const fr = scene.elements.frames;
  const frames: ReactNode[] = [];
  if (fr.visible) {
    const n = Math.round(4 + fr.intensity * 4);
    for (let i = 0; i < n; i++) {
      const z = 450 + i * (3600 / n);
      const tint = mixHex(env.color(fr.color), env.palette.secondary, (i % 3) / 2);
      const w = L.width * (P ? 1.05 : 1.1) * (i % 2 ? 0.92 : 1.08);
      const h = L.height * (P ? 0.9 : 1.08) * (i % 2 ? 1.04 : 0.94);
      const rot = (i % 2 ? -1 : 1) * (2 + i * 0.7) + Math.sin(tau + i) * 1.2;
      frames.push(
        <Plane key={i} cam={cam} L={L} x={(i % 3) * 30 * u - 30 * u} y={0} z={z} fadeNear={420}>
          <div
            style={{
              width: w,
              height: h,
              border: `${round(3 * u, 2)}px solid ${withAlpha(tint, fr.opacity)}`,
              borderRadius: 26 * u,
              transform: `rotate(${round(rot, 3)}deg)`,
            }}
          />
        </Plane>,
      );
    }
  }

  /* ---- choreographed morph shape (screen space) ---- */
  const mo = scene.elements.morph;
  const minDim = Math.min(L.width, L.height);
  const amp = mo.intensity;
  const states = P
    ? [
        { x: 0.72, y: 0.27, w: 0.5, h: 0.5, r: 0.06, rot: 14, fill: 0 },
        { x: 0.5, y: 0.6, w: 0.74, h: 0.74, r: 0.5, rot: 0, fill: 1 },
        { x: 0.5, y: 0.5, w: 1.02, h: 1.02, r: 0.5, rot: 90, fill: 2 },
      ]
    : [
        { x: 0.74, y: 0.33, w: 0.5, h: 0.5, r: 0.06, rot: 14, fill: 0 },
        { x: 0.3, y: 0.62, w: 0.66, h: 0.66, r: 0.5, rot: 0, fill: 1 },
        { x: 0.5, y: 0.5, w: 1.04, h: 1.04, r: 0.5, rot: 90, fill: 2 },
      ];
  const m1 = progress(tau, 1.22, 0.5, ease.snap);
  const m2 = progress(tau, 2.22, 0.5, ease.snap);
  const S0 = states[0]!;
  const S1 = states[1]!;
  const S2 = states[2]!;
  const mix = (key: 'x' | 'y' | 'w' | 'h' | 'r' | 'rot') => lerp(lerp(S0[key], S1[key], m1), S2[key], m2);
  const mIn = springWithIntensity(tau - C.morph.in / pace, SPRINGS.heavy, k * 0.6);
  const mOut = 1 - progress(tau, 3.55, 0.5, ease.inCubic);
  const mw = mix('w') * minDim * amp * clamp(mIn, 0, 1.2);
  const mh = mix('h') * minDim * amp * clamp(mIn, 0, 1.2);
  const surface = env.palette.surface;
  const mColor = env.color(mo.color);
  const accent = env.palette.accent;
  const fillA = mixHex(surface, mColor, m1);
  const fillOpacity = 1 - m2;
  const borderCol = m2 > 0 ? withAlpha(accent, m2 * 0.8) : withAlpha(mColor, (1 - m1) * 0.9);
  const morph =
    mo.visible && mw > 1 ? (
      <div
        data-lms-target={env.target('morph')}
        style={{
          position: 'absolute',
          left: mix('x') * L.width - mw / 2 - cam.x * 0.4,
          top: mix('y') * L.height - mh / 2 - cam.y * 0.4,
          width: mw,
          height: mh,
          borderRadius: `${round(mix('r') * 100, 2)}%`,
          transform: `rotate(${round(mix('rot') + tau * 6, 3)}deg)`,
          background: withAlpha(fillA, fillOpacity * mo.opacity * 0.92),
          border: `${round((2 + m2 * 2) * u, 2)}px solid ${borderCol}`,
          boxShadow: m2 > 0 ? `0 0 ${round(60 * u * m2)}px ${withAlpha(accent, 0.25 * m2)}` : undefined,
          opacity: mOut,
          // Lives in screen space, composited as if it sat just behind the hero word plane.
          zIndex: 80,
        }}
      />
    ) : null;

  /* ---- words ---- */
  const l1 = local(C.word1.in, scene.texts.word1.delay);
  const l2 = local(C.word2.in, scene.texts.word2.delay);
  const l3 = local(C.word3.in, scene.texts.word3.delay);

  const p1 = place(0);
  const p2 = place(1);
  const p3 = place(2);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />
      <div data-lms-target={env.target('frames')} style={{ position: 'absolute', inset: 0 }}>
        {frames}
      </div>
      {morph}
      {scene.texts.word1.visible ? (
        <Plane cam={cam} L={L} x={p1.x} y={p1.y} z={1000} focusBlur={10} targetId={env.target('word1')}>
          <CreateWord env={env} text={w1} l={l1} />
        </Plane>
      ) : null}
      {scene.texts.word2.visible && l2 > -0.4 ? (
        <Plane cam={cam} L={L} x={p2.x} y={p2.y} z={2000} focusBlur={10} targetId={env.target('word2')}>
          <AnimateWord env={env} text={w2} l={l2} tau={tau} />
        </Plane>
      ) : null}
      {scene.texts.word3.visible && l3 > -0.4 ? (
        <Plane cam={cam} L={L} x={p3.x} y={p3.y} z={3000} focusBlur={8} targetId={env.target('word3')} fadeNear={160}>
          <InspireWord env={env} text={w3} l={l3} />
        </Plane>
      ) : null}
    </div>
  );
};
