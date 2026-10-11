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
  round,
  springWithIntensity,
  velocityOf,
} from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { EnergyScene } from '../../schema';
import { CHOREO, entranceAt } from '../../timing';
import { alignShift, alignX, blockAnchor, energyCore } from '../art';
import { SceneBackground } from '@lms/scene-kit';
import type { SceneEnv } from '../context';
import { DISPLAY, MONO } from '@lms/scene-kit';
import { TextBlock, useTextLayout } from '@lms/scene-kit';

const C = CHOREO.energy;
const WAVE_LIFE = 1.7;

/** Beat times of the core pulse (scene seconds). */
const beatsUntil = (t: number, first: number, rate: number): number[] => {
  const out: number[] = [];
  if (t < first) return out;
  const last = Math.floor((t - first) * rate);
  for (let n = Math.max(0, last - 4); n <= last; n++) out.push(first + n / rate);
  return out;
};

/** Impulse response used for every pulse: quick attack, exponential release. */
const bump = (age: number) => (age <= 0 ? 0 : Math.exp(-age * 6.5) * (1 - Math.exp(-age * 45)) * 1.18);

export const EnergySceneView = ({ env }: { env: SceneEnv<EnergyScene> }) => {
  const { t, layout: L, scene, override: o, fps } = env;
  const { animation: anim, elements: E } = scene;
  const P = L.isPortrait;
  const u = L.u;
  const k = anim.intensity;
  const core = energyCore(L);
  const R = core.R;

  const tGrid = entranceAt(C.grid.in, anim);
  const tCore = entranceAt(C.core.in, anim);
  const tRings = entranceAt(C.rings.in, anim);
  const tOrb = entranceAt(C.orbiters.in, anim);
  const tLead = entranceAt(C.lead.in, anim, scene.texts.lead.delay);
  const tHead = entranceAt(C.headline.in, anim, scene.texts.headline.delay);
  const exitStart = env.duration - 0.36;
  const exitP = progress(t, exitStart, 0.36 + 0.5, ease.inExpo);
  const exitFade = 1 - progress(t, exitStart + 0.1, 0.45, ease.inCubic);

  const firstBeat = tCore + 0.3;
  const beats = beatsUntil(t, firstBeat, scene.props.pulseRate);
  const pulse = beats.reduce((acc, b) => acc + bump(t - b), 0);

  /* ---------------- collapse of the incoming light line ---------------- */
  const col = progress(t, C.collapse.in, C.collapse.dur, ease.snap);
  const lineLen = lerp(L.width, 0, col);
  const lineX = lerp(L.cx, core.x, col);
  const lineY = lerp(L.cy, core.y, col);
  const flash = col >= 1 ? Math.exp(-(t - C.collapse.dur) * 7) : 0;

  /* ---------------- dot grid displaced by the pulse waves -------------- */
  const gridNodes: ReactNode[] = [];
  if (E.grid.visible) {
    const spacing = (P ? 60 : 58) * u;
    const cols = Math.ceil(L.width / spacing) + 1;
    const rows = Math.ceil(L.height / spacing) + 1;
    const ox = (L.width - (cols - 1) * spacing) / 2;
    const oy = (L.height - (rows - 1) * spacing) / 2;
    const dotColor = env.color(E.grid.color);
    const waveSpeed = 1500 * u;
    const appearSpeed = 2600 * u;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = ox + c * spacing;
        const y0 = oy + r * spacing;
        const dx = x0 - core.x;
        const dy = y0 - core.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R * 0.5) continue;
        const appear = progress(t, tGrid + d / appearSpeed, 0.35, ease.outCubic);
        if (appear <= 0) continue;
        let disp = 0;
        let glow = 0;
        for (const b of beats) {
          const age = t - b;
          if (age > WAVE_LIFE) continue;
          const front = R * 0.25 + age * waveSpeed;
          const g = Math.exp(-(((d - front) / (110 * u)) ** 2)) * (1 - age / WAVE_LIFE);
          disp += g * 26 * u * E.grid.intensity * k;
          glow += g;
        }
        disp += exitP * d * 0.9;
        const x = x0 + (dx / d) * disp;
        const y = y0 + (dy / d) * disp;
        const falloff = clamp(1 - d / (Math.max(L.width, L.height) * 0.85), 0.15, 1);
        const rad = (1.6 + glow * 1.6) * u;
        gridNodes.push(
          <circle
            key={`${r}-${c}`}
            cx={round(x, 2)}
            cy={round(y, 2)}
            r={round(rad * appear, 2)}
            fill={dotColor}
            opacity={round(E.grid.opacity * falloff * (0.55 + glow * 0.9) * appear, 3)}
          />,
        );
      }
    }
  }

  /* ---------------- rings, ticks, crosshair --------------------------- */
  const ringsOn = E.rings.visible;
  const ringColor = env.color(E.rings.color);
  const accent = env.palette.accent;
  const spin = E.rings.intensity;
  const ringScale = 1 + pulse * 0.025 * k + exitP * 1.6;
  const ringDefs = [
    { r: 0.36, w: 1.6, dash: null as string | null, speed: 0, delay: 0 },
    { r: 0.58, w: 1.4, dash: `${round(2 * u)} ${round(11 * u)}`, speed: 0.22, delay: 0.06 },
    { r: 0.8, w: 2, dash: null, speed: -0.1, delay: 0.12 },
    { r: 1.02, w: 1.4, dash: `${round(46 * u)} ${round(16 * u)}`, speed: 0.07, delay: 0.18 },
  ];
  const rings = ringsOn
    ? ringDefs.map((d, i) => {
        const r = R * d.r;
        const draw = progress(t, tRings + d.delay / anim.pace, 0.75 / anim.pace, ease.cinematic);
        const rot = (d.speed * spin * t * 360 + i * 37) % 360;
        const len = circleLength(r);
        return (
          <g key={i} transform={`rotate(${round(rot, 3)} ${round(core.x, 2)} ${round(core.y, 2)})`}>
            <circle
              cx={core.x}
              cy={core.y}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeOpacity={E.rings.opacity * (i === 0 ? 1 : 0.8)}
              strokeWidth={d.w * u}
              {...(d.dash
                ? { strokeDasharray: d.dash, opacity: draw }
                : drawStroke(draw, len))}
            />
            {i === 2 ? (
              <path
                d={arcPath(core.x, core.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * 0.16 * draw)}
                fill="none"
                stroke={accent}
                strokeWidth={4 * u}
                strokeLinecap="round"
              />
            ) : null}
          </g>
        );
      })
    : null;

  const ticks: ReactNode[] = [];
  if (ringsOn) {
    const n = 96;
    const r0 = R * 1.18;
    const rot = t * 4 * spin;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU - Math.PI / 2 + (rot * Math.PI) / 180;
      const on = progress(t, tRings + 0.15 + (i / n) * 0.55, 0.12);
      if (on <= 0) continue;
      const long = i % 8 === 0;
      const len = (long ? 26 : 11) * u * on;
      ticks.push(
        <line
          key={i}
          x1={round(core.x + Math.cos(ang) * r0, 2)}
          y1={round(core.y + Math.sin(ang) * r0, 2)}
          x2={round(core.x + Math.cos(ang) * (r0 + len), 2)}
          y2={round(core.y + Math.sin(ang) * (r0 + len), 2)}
          stroke={long ? accent : ringColor}
          strokeOpacity={long ? 0.9 : E.rings.opacity * 0.75}
          strokeWidth={(long ? 2.2 : 1.3) * u}
        />,
      );
    }
  }

  const cross = progress(t, tRings, 0.9, ease.cinematic);
  const crossLen = Math.max(L.width, L.height) * cross;
  const crossColor = withAlpha(env.color(E.rings.color), 0.14 * E.rings.opacity * 2);

  /* ---------------- pulse waves --------------------------------------- */
  const coreColor = env.color(E.core.color);
  const waves = E.core.visible
    ? beats.map((b) => {
        const age = t - b;
        if (age > WAVE_LIFE || age < 0) return null;
        const r = R * 0.22 + age * 1500 * u * 0.55;
        const op = (1 - age / WAVE_LIFE) ** 2 * 0.7 * E.core.intensity;
        return <circle key={b} cx={core.x} cy={core.y} r={r} fill="none" stroke={coreColor} strokeOpacity={op} strokeWidth={(3 - age) * u} />;
      })
    : null;

  /* ---------------- orbiters ------------------------------------------ */
  const orbColor = env.color(E.orbiters.color);
  const orbIn = springWithIntensity(t - tOrb, SPRINGS.bouncy, k);
  const orbiters = E.orbiters.visible
    ? [
        { ring: 0.58, speed: 0.55, size: 9, phase: 0.2, color: orbColor },
        { ring: 0.8, speed: -0.32, size: 13, phase: 2.4, color: accent },
        { ring: 1.02, speed: 0.2, size: 7, phase: 4.1, color: orbColor },
      ].map((o2, i) => {
        const ang = o2.phase + t * o2.speed * TAU * 0.5 * E.orbiters.intensity;
        const x = core.x + Math.cos(ang) * R * o2.ring * ringScale;
        const y = core.y + Math.sin(ang) * R * o2.ring * ringScale;
        const s = o2.size * u * clamp(orbIn, 0, 1.4);
        return (
          <circle
            key={i}
            cx={round(x, 2)}
            cy={round(y, 2)}
            r={round(s / 2, 2)}
            fill={o2.color}
            opacity={E.orbiters.opacity}
            style={{ filter: `drop-shadow(0 0 ${round(10 * u)}px ${withAlpha(o2.color, 0.8)})` }}
          />
        );
      })
    : null;

  /* ---------------- core ---------------------------------------------- */
  const coreIn = springWithIntensity(t - tCore, SPRINGS.bouncy, k);
  const coreR = R * 0.2 * Math.max(0, coreIn) * (1 + pulse * 0.16 * k * E.core.intensity) * (1 + exitP * 7);

  /* ---------------- typography ---------------------------------------- */
  const headBox = {
    family: DISPLAY,
    size: (P ? 168 : 168) * u * o.scale,
    maxWidth: (P ? L.safe.width : core.x - L.safe.left - R * 0.32) * o.scale,
    maxHeight: L.safe.height * 0.28,
    lineHeight: 0.92,
  };
  const head = useTextLayout(scene.texts.headline, headBox, L.format);
  const lead = useTextLayout(
    scene.texts.lead,
    { family: DISPLAY, size: head.layout.fontSize * 0.5, maxWidth: headBox.maxWidth, lineHeight: 1 },
    L.format,
  );
  const align = o.align;
  const anchorBase = P ? { x: alignX(L, align), y: L.height * 0.735 } : { x: alignX(L, align), y: L.cy };
  const anchor = blockAnchor(L, o, anchorBase);
  const blockW = Math.max(head.layout.width, lead.layout.width);
  const leftEdge = align === 'start' ? anchor.x : align === 'end' ? anchor.x - blockW : anchor.x - blockW / 2;

  const charPush = (i: number, n: number, lineTop: number) => {
    const cx = leftEdge + ((i + 0.5) / Math.max(1, n)) * head.layout.width;
    const cy = lineTop;
    const dx = cx - core.x;
    const dy = cy - core.y;
    const d = Math.hypot(dx, dy) || 1;
    let disp = 0;
    for (const b of beats) {
      const age = t - b;
      if (age > WAVE_LIFE || age < 0) continue;
      const front = R * 0.25 + age * 1500 * u;
      disp += Math.exp(-(((d - front) / (140 * u)) ** 2)) * (1 - age / WAVE_LIFE) * 14 * u * k;
    }
    return { x: (dx / d) * disp, y: (dy / d) * disp };
  };

  const textExit = progress(t, exitStart, 0.4, ease.inQuart) * 140 * u;
  const textExitX = P ? 0 : -textExit;
  const textExitY = P ? textExit : 0;
  const headTop = anchor.y + (lead.layout.height + 18 * u) / 2;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SceneBackground env={env} focus={{ x: core.x, y: core.y }} />

      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g data-lms-target={env.target('grid')} opacity={exitFade}>
          {gridNodes}
        </g>
        <g data-lms-target={env.target('rings')} opacity={exitFade}>
          <line x1={core.x - crossLen} y1={core.y} x2={core.x + crossLen} y2={core.y} stroke={crossColor} strokeWidth={1.2 * u} />
          <line x1={core.x} y1={core.y - crossLen} x2={core.x} y2={core.y + crossLen} stroke={crossColor} strokeWidth={1.2 * u} />
          <g transform={`translate(${round(core.x * (1 - ringScale), 2)} ${round(core.y * (1 - ringScale), 2)}) scale(${round(ringScale, 4)})`}>
            {rings}
            {ticks}
          </g>
        </g>
        <g data-lms-target={env.target('core')}>{waves}</g>
        <g data-lms-target={env.target('orbiters')} opacity={exitFade}>
          {orbiters}
        </g>
      </svg>

      {/* Core disc */}
      {E.core.visible && coreR > 0 ? (
        <div
          data-lms-target={env.target('core')}
          style={{
            position: 'absolute',
            left: core.x - coreR,
            top: core.y - coreR,
            width: coreR * 2,
            height: coreR * 2,
            borderRadius: '50%',
            opacity: E.core.opacity,
            background: `radial-gradient(circle at 42% 38%, #FFFFFF 0%, ${coreColor} 34%, ${withAlpha(coreColor, 0.85)} 62%, ${withAlpha(
              env.palette.secondary,
              0.9,
            )} 100%)`,
            boxShadow: `0 0 ${round(R * 0.35 * (1 + pulse * 0.5))}px ${round(R * 0.04)}px ${withAlpha(coreColor, 0.55 * E.core.intensity)}, 0 0 ${round(
              R * 0.9,
            )}px ${withAlpha(env.palette.secondary, 0.35)}`,
          }}
        />
      ) : null}

      {/* Readout bound to the real pulse rate */}
      {ringsOn ? (
        <div
          style={{
            position: 'absolute',
            left: core.x + R * 0.72,
            top: core.y - R * 1.02,
            fontFamily: `"${MONO}"`,
            fontSize: 17 * u,
            letterSpacing: '0.22em',
            color: withAlpha(env.palette.foreground, 0.55),
            opacity: progress(t, tRings + 0.5, 0.3) * exitFade,
            whiteSpace: 'pre',
            lineHeight: 1.6,
          }}
        >
          {`PULSE ${scene.props.pulseRate.toFixed(2)} HZ\nPHASE ${String(Math.floor(((t * scene.props.pulseRate) % 1) * 360)).padStart(3, '0')}°`}
        </div>
      ) : null}

      {/* Incoming light line collapsing into the core */}
      {col < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: lineX - lineLen / 2,
            top: lineY - 1.5 * u,
            width: lineLen,
            height: 3 * u,
            background: `linear-gradient(90deg, transparent, ${accent} 12%, #FFFFFF 50%, ${accent} 88%, transparent)`,
            boxShadow: `0 0 ${round(22 * u)}px ${round(3 * u)}px ${withAlpha(accent, 0.75)}`,
          }}
        />
      ) : null}
      {flash > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: core.x - R,
            top: core.y - R,
            width: R * 2,
            height: R * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha('#FFFFFF', 0.9 * flash)} 0%, ${withAlpha(accent, 0.5 * flash)} 18%, transparent 60%)`,
          }}
        />
      ) : null}

      {/* Typography */}
      <div
        style={{
          position: 'absolute',
          left: anchor.x,
          top: anchor.y,
          transform: `translate(${alignShift(align)}, -50%) translate(${round(textExitX)}px, ${round(textExitY)}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
          gap: 18 * u,
          opacity: exitFade,
        }}
      >
        <TextBlock
          targetId={env.target('lead')}
          text={lead}
          color={env.color(scene.texts.lead.color)}
          align={align}
          split="words"
          renderUnit={(unit, content) => {
            const s = tLead + unit.index * (0.1 / anim.pace);
            const p = springWithIntensity(t - s, SPRINGS.type, k);
            return (
              <MaskReveal progress={p} direction="up">
                {content}
              </MaskReveal>
            );
          }}
        />
        <TextBlock
          targetId={env.target('headline')}
          text={head}
          color={env.color(scene.texts.headline.color)}
          align={align}
          split="chars"
          renderUnit={(unit, content) => {
            const s = tHead + unit.index * (0.034 / anim.pace);
            const f = (x: number) => springWithIntensity(x - s, SPRINGS.type, k);
            const p = f(t);
            const blur = motionBlurFromVelocity(velocityOf(f, t) * head.layout.fontSize, fps, 22 * u);
            const push = charPush(unit.indexInLine, unit.countInLine, headTop + unit.lineIndex * head.layout.fontSize * head.layout.lineHeight);
            return (
              <MaskReveal progress={p} direction="up" bleed={0.14}>
                <DirectionalBlur
                  as="span"
                  y={blur}
                  style={{ display: 'inline-block', transform: `translate(${round(push.x, 2)}px, ${round(push.y, 2)}px)` }}
                >
                  {content}
                </DirectionalBlur>
              </MaskReveal>
            );
          }}
        />
      </div>
    </div>
  );
};
