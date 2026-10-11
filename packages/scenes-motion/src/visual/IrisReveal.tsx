import { TAU, blobPoints, clamp, ease, lerp, pointsToPath, polygonClip, progress, round, type Point } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, TextBlock, alignX, useRoleText } from '@lms/scene-kit';
import { IRIS_CHOREO as C, type IrisRevealScene } from '../scenes/irisReveal';
import { at } from '../common';
import { ImageOr } from './procedural';

type Env = SceneRuntime<IrisRevealScene>;

/** Mask outline for a preset at reveal amount `r` (0 closed … 1 open), plus whether it is a circle. */
const maskShape = (preset: IrisRevealScene['props']['preset'], r: number, O: Point, maxR: number, W: number, H: number, t: number, origin: string) => {
  switch (preset) {
    case 'iris':
      return { circle: { x: O.x, y: O.y, r: r * maxR }, pts: null as Point[] | null };
    case 'liquid':
      return { circle: null, pts: blobPoints(O.x, O.y, r * maxR * 1.12, t * 1.6, { seed: 'liquid', amplitude: 0.22 * (1 - r * 0.6), lobes: 3 }) };
    case 'aperture': {
      const rot = (1 - r) * (Math.PI * 0.75);
      return { circle: null, pts: Array.from({ length: 6 }, (_, i) => ({ x: O.x + Math.cos(rot + (i / 6) * TAU) * r * maxR * 1.2, y: O.y + Math.sin(rot + (i / 6) * TAU) * r * maxR * 1.2 })) };
    }
    case 'burst': {
      const n = 12;
      const w = (TAU / n) * clamp(r * 1.15);
      const far = maxR * 1.5 * clamp(r * 3);
      const pts: Point[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU - Math.PI / 2;
        pts.push(O, { x: O.x + Math.cos(a - w / 2) * far, y: O.y + Math.sin(a - w / 2) * far }, { x: O.x + Math.cos(a + w / 2) * far, y: O.y + Math.sin(a + w / 2) * far });
      }
      return { circle: null, pts };
    }
    case 'diagonal':
    default: {
      // A slanted front sweeping across, from the chosen side.
      const vertical = origin === 'top' || origin === 'bottom';
      const span = vertical ? H : W;
      const slant = (vertical ? W : H) * 0.45;
      const front = lerp(-slant, span + slant, r);
      const rev = origin === 'right' || origin === 'bottom';
      const f = rev ? span - front : front;
      const pts: Point[] = vertical
        ? rev
          ? [{ x: 0, y: H }, { x: W, y: H }, { x: W, y: f - slant / 2 }, { x: 0, y: f + slant / 2 }]
          : [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: f - slant / 2 }, { x: 0, y: f + slant / 2 }]
        : rev
          ? [{ x: W, y: 0 }, { x: W, y: H }, { x: f - slant / 2, y: H }, { x: f + slant / 2, y: 0 }]
          : [{ x: 0, y: 0 }, { x: 0, y: H }, { x: f - slant / 2, y: H }, { x: f + slant / 2, y: 0 }];
      return { circle: null, pts };
    }
  }
};

export const IrisRevealView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const W = L.width;
  const H = L.height;
  const exitStart = env.duration - C.exit;

  const O: Point =
    props.origin === 'left' ? { x: 0, y: L.cy } : props.origin === 'right' ? { x: W, y: L.cy } : props.origin === 'top' ? { x: L.cx, y: 0 } : props.origin === 'bottom' ? { x: L.cx, y: H } : { x: L.cx, y: L.cy };
  const maxR = Math.max(...[{ x: 0, y: 0 }, { x: W, y: 0 }, { x: 0, y: H }, { x: W, y: H }].map((c) => Math.hypot(c.x - O.x, c.y - O.y))) * 1.02;

  const tReveal = at(C.content.in, anim);
  const open = progress(t, tReveal, props.revealDuration / anim.pace, ease.inOutQuart);
  const close = progress(t, exitStart, C.exit, ease.inOutQuart);
  const r = open * (1 - close);
  const shape = maskShape(props.preset, r, O, maxR, W, H, t, props.origin);
  const clip = shape.circle ? `circle(${round(shape.circle.r, 2)}px at ${round(shape.circle.x, 2)}px ${round(shape.circle.y, 2)}px)` : polygonClip(shape.pts!);
  const zoom = lerp(1.18, 1, ease.cinematic(open)) + close * 0.06;

  // Cover word: anticipation squash right before the mask opens.
  const coverIn = progress(t, at(C.cover.in, anim), 0.6, ease.cinematic);
  const pre = Math.sin(Math.PI * progress(t, tReveal - 0.25, 0.35));
  const cover = useRoleText(env, scene.texts.cover, 'display', { size: (P ? 300 : 360) * u, maxWidth: W * 0.86, lineHeight: 0.9 });
  const coverColor = env.color(E.curtain.color);

  const headline = useRoleText(env, scene.texts.headline, 'display', { size: (P ? 120 : 112) * u * o.scale, maxWidth: (P ? L.safe.width : W * 0.5) * o.scale, maxHeight: H * 0.35, lineHeight: 0.98 });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 38 : 34) * u * o.scale, maxWidth: (P ? L.safe.width : W * 0.4) * o.scale, lineHeight: 1.3 });
  const align = P ? (o.align === 'start' ? 'center' : o.align) : o.align;
  const ax = alignX(L, align) + o.offsetX * L.safe.width;
  const blockH = headline.layout.height + 26 * u + sub.layout.height;
  const ty = (P ? H * 0.62 : L.cy - blockH / 2) + o.offsetY * L.safe.height;
  const textOut = progress(t, exitStart, 0.3, ease.inCubic);
  const contentColor = env.color(E.content.color);
  const accent = env.palette.accent;
  const depth = E.content.intensity;

  const edgeColor = env.color(E.edge.color);
  const edgeW = Math.max(1, (3 + 3 * E.edge.intensity) * u);
  const edgeOn = E.edge.visible && r > 0.001 && r < 0.999;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Cover */}
      <div data-lms-target={env.target('curtain')} style={{ position: 'absolute', inset: 0, background: coverColor, opacity: E.curtain.visible ? E.curtain.opacity : 0 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(-45deg, transparent 0 ${24 * u}px, ${withAlpha('#000000', 0.06 * E.curtain.intensity)} ${24 * u}px ${26 * u}px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: L.cy - cover.layout.height / 2,
            textAlign: 'center',
            opacity: coverIn,
            transform: `scale(${round(1 + (1 - coverIn) * 0.15 + pre * 0.04, 4)}, ${round(1 + (1 - coverIn) * 0.15 - pre * 0.08, 4)})`,
          }}
        >
          <TextBlock text={cover} color={env.color(scene.texts.cover.color)} align="center" split="lines" targetId={env.target('cover')} renderUnit={(_u, c) => c} />
        </div>
      </div>

      {/* Revealed content */}
      <div data-lms-target={env.target('content')} style={{ position: 'absolute', inset: 0, clipPath: clip, opacity: E.content.visible ? 1 : 0 }}>
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${round(zoom, 4)})`, transformOrigin: `${round(O.x, 1)}px ${round(O.y, 1)}px` }}>
          <SceneBackground env={env} focus={O} />
          <ImageOr
            assetId={props.assetId}
            style={{ position: 'absolute', inset: 0, opacity: E.content.opacity }}
            fallback={
              <div style={{ position: 'absolute', inset: 0, opacity: E.content.opacity }}>
                {[0, 1, 2].map((i) => {
                  const s = (P ? 900 : 1100) * u * (1 - i * 0.22);
                  const dx = Math.sin(t * 0.4 + i * 2) * 60 * u * depth;
                  const dy = Math.cos(t * 0.3 + i) * 40 * u * depth;
                  const c = i === 1 ? accent : contentColor;
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: (P ? W * 0.5 : W * 0.68) - s / 2 + dx + (i - 1) * 140 * u,
                        top: (P ? H * 0.32 : L.cy) - s / 2 + dy,
                        width: s,
                        height: s,
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 40% 35%, ${withAlpha(c, 0.9)}, ${withAlpha(c, 0.25)} 55%, transparent 72%)`,
                      }}
                    />
                  );
                })}
                <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
                  {Array.from({ length: 9 }, (_, i) => (
                    <circle key={i} cx={P ? W * 0.5 : W * 0.68} cy={P ? H * 0.32 : L.cy} r={(140 + i * 70) * u} fill="none" stroke={withAlpha('#FFFFFF', 0.08)} strokeWidth={Math.max(1, u)} />
                  ))}
                </svg>
              </div>
            }
          />
          {props.assetId && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${P ? '0deg' : '90deg'}, ${withAlpha(env.palette.background, 0.75)}, transparent 70%)` }} />}
        </div>
        <Anchor x={ax} y={ty} align={align} width={P ? L.safe.width : W * 0.52}>
          <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={align} start={at(C.headline.in, anim, scene.texts.headline.delay)} each={0.1} out={textOut} targetId={env.target('headline')} />
          <div style={{ height: 26 * u }} />
          <MaskedLines text={sub} env={env} color={withAlpha(env.color(scene.texts.sub.color), 0.8)} align={align} start={at(C.sub.in, anim, scene.texts.sub.delay)} out={textOut} targetId={env.target('sub')} />
        </Anchor>
      </div>

      {/* Luminous edge of the mask */}
      {edgeOn && (
        <svg data-lms-target={env.target('edge')} width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: E.edge.opacity }}>
          {shape.circle ? (
            <circle cx={shape.circle.x} cy={shape.circle.y} r={shape.circle.r} fill="none" stroke={edgeColor} strokeWidth={edgeW} style={{ filter: `drop-shadow(0 0 ${round(14 * u, 2)}px ${accent})` }} />
          ) : (
            <path d={pointsToPath(shape.pts!, true)} fill="none" stroke={edgeColor} strokeWidth={edgeW} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${round(14 * u, 2)}px ${accent})` }} />
          )}
        </svg>
      )}
    </div>
  );
};
