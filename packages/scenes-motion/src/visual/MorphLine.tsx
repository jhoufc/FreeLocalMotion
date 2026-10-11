import { useMemo } from 'react';
import { CLOSED_SHAPES, clamp, ease, lerpPoints, pointAlong, pointsToPath, progress, round, shapePoints, type Point, type ShapeKind } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, alignX, useRoleText } from '@lms/scene-kit';
import { MORPH_CHOREO as C, MORPH_PRESETS, type MorphLineScene } from '../scenes/morphLine';
import { at } from '../common';

type Env = SceneRuntime<MorphLineScene>;
const N = 160;

export const MorphLineView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const props = scene.props;
  const anim = scene.animation;
  const exitStart = env.duration - C.exit;
  const R = (P ? 300 : 260) * u * o.scale;
  const cx = L.cx + o.offsetX * L.safe.width;
  const cy = (P ? L.height * 0.4 : L.height * 0.42) + o.offsetY * L.safe.height;
  const kinds = MORPH_PRESETS[props.preset] as readonly ShapeKind[];
  const flip = props.direction === 'counter';

  const shapes = useMemo(
    () => kinds.map((k) => shapePoints(k, N, 0, 0, R).map((p) => ({ x: cx + (flip ? -p.x : p.x), y: cy + p.y }))),
    [kinds, R, cx, cy, flip],
  );

  // Timeline: draw the line, then one morph per remaining shape, holding briefly on each.
  const speed = props.speed * anim.pace;
  const tDraw = at(C.line.in, anim);
  const drawDur = 0.6 / speed;
  const morphDur = 0.55 / speed;
  const hold = 0.28 / speed;
  const morphAt = (i: number) => tDraw + drawDur + hold + (i - 1) * (morphDur + hold);
  let stage = 0;
  let m = 0;
  for (let i = 1; i < shapes.length; i++) {
    const s = morphAt(i);
    if (t >= s) {
      stage = i - 1;
      m = progress(t, s, morphDur, ease.inOutQuart);
      if (t >= s + morphDur) {
        stage = i;
        m = 0;
      }
    }
  }
  const from = shapes[stage]!;
  const to = shapes[Math.min(shapes.length - 1, stage + 1)]!;
  // Back-ease overshoot on the morph for a lively settle.
  const overshoot = m > 0 ? m + Math.sin(Math.PI * m) * 0.08 * anim.intensity : 0;
  const pts = m > 0 ? lerpPoints(from, to, overshoot) : from;
  const closed = CLOSED_SHAPES.has(kinds[m > 0.5 ? Math.min(kinds.length - 1, stage + 1) : stage]!);
  const draw = progress(t, tDraw, drawDur, ease.cinematic) * props.length;
  const exitP = progress(t, exitStart, C.exit, ease.inCubic);
  const visible = clamp(draw / Math.max(0.01, props.length)) > 0 ? (1 - exitP) * props.length : 0;
  const drawn = t < tDraw + drawDur ? draw : visible;
  const path = pointsToPath(pts, closed);

  const lineEl = scene.elements.line;
  const color = env.color(lineEl.color);
  const sw = props.thickness * u;
  const glow = lineEl.intensity;

  // Echo of the previous shapes that dissolve outward.
  const echoes = scene.elements.echo.visible
    ? Array.from({ length: Math.round(1 + scene.elements.echo.intensity * 2) }, (_, j) => {
        const prevStage = stage - j;
        if (prevStage < 1 && !(prevStage === 0 && m > 0)) return null;
        const base = shapes[Math.max(0, prevStage)]!;
        const age = m > 0 ? m + j : 1 + j;
        const sc = 1 + age * 0.12;
        const ep = base.map((p) => ({ x: cx + (p.x - cx) * sc, y: cy + (p.y - cy) * sc }));
        return (
          <path
            key={j}
            d={pointsToPath(ep, CLOSED_SHAPES.has(kinds[Math.max(0, prevStage)]!))}
            fill="none"
            stroke={env.color(scene.elements.echo.color)}
            strokeWidth={Math.max(1, sw * 0.35)}
            opacity={scene.elements.echo.opacity * clamp(1 - age / 3) * (1 - exitP)}
          />
        );
      })
    : null;

  // Spark travelling along the stroke.
  const sparkU = ((t * 0.55 * speed) % 1 + 1) % 1;
  const sp: Point & { angle: number } = pointAlong(closed ? [...pts, pts[0]!] : pts, sparkU * Math.min(1, drawn));
  const sparkR = (6 + 6 * scene.elements.spark.intensity) * u;

  const headline = useRoleText(env, scene.texts.headline, 'display', { size: (P ? 104 : 96) * u * o.scale, maxWidth: (P ? L.safe.width : L.width * 0.7) * o.scale, lineHeight: 1.02 });
  const caption = useRoleText(env, scene.texts.caption, 'text', { size: (P ? 36 : 32) * u * o.scale, maxWidth: L.safe.width, lineHeight: 1.3 });
  const textY = cy + R * 1.35 + (P ? 60 : 10) * u;
  const ax = alignX(L, o.align) + o.offsetX * L.safe.width;
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: cx, y: cy }} />
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <filter id={`ml-glow-${scene.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={round(sw * 1.4 * glow, 2)} />
          </filter>
        </defs>
        <g data-lms-target={env.target('echo')}>{echoes}</g>
        {lineEl.visible && (
          <g data-lms-target={env.target('line')} opacity={lineEl.opacity}>
            <path d={path} fill="none" stroke={withAlpha(color, 0.55 * glow)} strokeWidth={sw * 1.6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${round(drawn, 5)} 1`} filter={`url(#ml-glow-${scene.id})`} />
            <path d={path} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${round(drawn, 5)} 1`} />
          </g>
        )}
        {scene.elements.spark.visible && drawn > 0.02 && (
          <g data-lms-target={env.target('spark')} opacity={scene.elements.spark.opacity * (1 - exitP)}>
            <circle cx={sp.x} cy={sp.y} r={sparkR * 2.6} fill={withAlpha(env.color(scene.elements.spark.color), 0.18)} />
            <circle cx={sp.x} cy={sp.y} r={sparkR} fill={env.color(scene.elements.spark.color)} />
          </g>
        )}
      </svg>
      <Anchor x={ax} y={textY} align={o.align} width={P ? L.safe.width : L.width * 0.72}>
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={o.align} start={at(C.headline.in, anim, scene.texts.headline.delay) / props.speed} each={0.1} out={textOut} targetId={env.target('headline')} />
        <div style={{ height: 18 * u }} />
        <MaskedLines text={caption} env={env} color={withAlpha(env.color(scene.texts.caption.color), 0.7)} align={o.align} start={at(C.caption.in, anim, scene.texts.caption.delay) / props.speed} out={textOut} targetId={env.target('caption')} />
      </Anchor>
    </div>
  );
};
