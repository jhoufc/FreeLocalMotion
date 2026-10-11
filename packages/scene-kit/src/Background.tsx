import type { ReactNode } from 'react';
import { Img } from 'remotion';
import { drift, round } from '@lms/motion-core';
import { useAssets, type SceneRuntime } from '@lms/template-sdk';
import { withAlpha, type Background } from '@lms/shared';

type SceneEnv = SceneRuntime;

const fill = { position: 'absolute', inset: 0 } as const;

/** Faint technical grid, masked to fade towards the edges. */
const Grid = ({ env, opacity, scale = 1, spacing = 90 }: { env: SceneEnv; opacity: number; scale?: number; spacing?: number }) => {
  const { layout } = env;
  const s = spacing * layout.u;
  const line = withAlpha(env.palette.foreground, opacity);
  return (
    <div
      aria-hidden
      style={{
        ...fill,
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${s}px ${s}px`,
        backgroundPosition: `${layout.cx}px ${layout.cy}px`,
        transform: `scale(${round(scale, 4)})`,
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 0%, rgba(0,0,0,0.35) 55%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 0%, rgba(0,0,0,0.35) 55%, transparent 85%)',
      }}
    />
  );
};

const Procedural = ({ env, bg, focus }: { env: SceneEnv; bg: Background; focus: { x: number; y: number } }) => {
  const { t, palette, layout } = env;
  const k = bg.procedural.intensity;
  const base = env.color(bg.procedural.base);
  const fx = `${round((focus.x / layout.width) * 100, 2)}%`;
  const fy = `${round((focus.y / layout.height) * 100, 2)}%`;
  switch (bg.procedural.variant) {
    case 'radial': {
      const breathe = 0.85 + 0.15 * Math.sin(t * 2.2);
      return (
        <>
          <div style={{ ...fill, background: base }} />
          <div
            style={{
              ...fill,
              background: `radial-gradient(circle at ${fx} ${fy}, ${withAlpha(palette.secondary, 0.26 * k * breathe)} 0%, ${withAlpha(
                palette.secondary,
                0.08 * k,
              )} 28%, transparent 62%)`,
            }}
          />
          <div
            style={{
              ...fill,
              background: `radial-gradient(circle at ${fx} ${fy}, ${withAlpha(palette.accent, 0.07 * k * breathe)} 0%, transparent 22%)`,
            }}
          />
          <Grid env={env} opacity={0.035 * k} scale={1 + t * 0.01} />
        </>
      );
    }
    case 'tunnel': {
      return (
        <>
          <div
            style={{
              ...fill,
              background: `radial-gradient(ellipse 80% 70% at ${fx} ${fy}, ${withAlpha(palette.surface, 1)} 0%, ${base} 70%)`,
            }}
          />
          <div
            style={{
              ...fill,
              background: `radial-gradient(circle at ${fx} ${fy}, ${withAlpha(palette.secondary, 0.16 * k)} 0%, transparent 35%)`,
            }}
          />
          <div
            style={{
              ...fill,
              background: `repeating-radial-gradient(circle at ${fx} ${fy}, transparent 0, transparent ${round(
                118 * layout.u,
              )}px, ${withAlpha(palette.foreground, 0.025 * k)} ${round(119 * layout.u)}px, transparent ${round(121 * layout.u)}px)`,
              transform: `scale(${round(1 + t * 0.08, 4)})`,
            }}
          />
        </>
      );
    }
    case 'aurora': {
      const blob = (seed: string, color: string, size: number, ox: number, oy: number) => {
        const x = ox + drift(seed, t * 0.25) * 0.18;
        const y = oy + drift(`${seed}y`, t * 0.22) * 0.14;
        return (
          <div
            style={{
              position: 'absolute',
              left: `${round(x * 100, 2)}%`,
              top: `${round(y * 100, 2)}%`,
              width: size * layout.u,
              height: size * layout.u,
              marginLeft: (-size * layout.u) / 2,
              marginTop: (-size * layout.u) / 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${withAlpha(color, 0.32 * k)} 0%, transparent 65%)`,
            }}
          />
        );
      };
      return (
        <>
          <div style={{ ...fill, background: base }} />
          {blob('a1', palette.secondary, 1500, 0.3, 0.35)}
          {blob('a2', palette.accent, 900, 0.72, 0.68)}
          {blob('a3', palette.surface, 1300, 0.6, 0.2)}
          <Grid env={env} opacity={0.03 * k} />
        </>
      );
    }
    case 'void':
    default: {
      return (
        <>
          <div style={{ ...fill, background: base }} />
          <div
            style={{
              ...fill,
              background: `radial-gradient(ellipse 65% 55% at ${fx} ${fy}, ${withAlpha(palette.surface, 0.95)} 0%, transparent 72%)`,
              opacity: Math.min(1, 0.55 + 0.45 * k),
            }}
          />
          <Grid env={env} opacity={0.05 * k} scale={1 + t * 0.012} />
        </>
      );
    }
  }
};

const ImageBackground = ({ env, bg }: { env: SceneEnv; bg: Background }) => {
  const assets = useAssets();
  const img = bg.image;
  const url = assets.url(img.assetId);
  const push = 1 + img.motion * Math.min(1, env.t / Math.max(0.1, env.duration));
  return (
    <>
      <div style={{ ...fill, background: env.palette.background }} />
      {url ? (
        <Img
          src={url}
          style={{
            ...fill,
            width: '100%',
            height: '100%',
            objectFit: img.fit,
            objectPosition: `${round(50 + img.x * 50, 2)}% ${round(50 + img.y * 50, 2)}%`,
            transform: `scale(${round(img.scale * push, 4)})`,
            filter: img.blur > 0 ? `blur(${round(img.blur * env.layout.u, 2)}px)` : undefined,
            opacity: img.opacity,
          }}
        />
      ) : null}
      <div style={{ ...fill, background: img.overlayColor, opacity: img.overlayOpacity }} />
    </>
  );
};

/**
 * Scene background in any of its modes (procedural variants, solid, gradient, image). `focus` lets the scene aim the procedural
 * light at its own center of interest (e.g. the energy core).
 */
export const SceneBackground = ({ env, focus }: { env: SceneEnv; focus?: { x: number; y: number } }) => {
  // `inherit` is already resolved by the runtime (composition default background).
  const bg = env.background;
  const f = focus ?? { x: env.layout.cx, y: env.layout.cy };
  let content: ReactNode;
  switch (bg.mode) {
    case 'solid':
      content = <div style={{ ...fill, background: env.color(bg.solid.color) }} />;
      break;
    case 'gradient': {
      const stops = [...bg.gradient.stops]
        .sort((a, b) => a.position - b.position)
        .map((s) => `${env.color(s.color)} ${round(s.position * 100, 2)}%`)
        .join(', ');
      const angle = bg.gradient.angle + bg.gradient.drift * env.t;
      content = (
        <div
          style={{
            ...fill,
            background:
              bg.gradient.kind === 'linear'
                ? `linear-gradient(${round(angle, 2)}deg, ${stops})`
                : `radial-gradient(circle at ${round((f.x / env.layout.width) * 100, 2)}% ${round((f.y / env.layout.height) * 100, 2)}%, ${stops})`,
          }}
        />
      );
      break;
    }
    case 'image':
      content = <ImageBackground env={env} bg={bg} />;
      break;
    case 'procedural':
    default:
      content = <Procedural env={env} bg={bg} focus={f} />;
  }
  return (
    <div data-lms-target={env.scene.id} style={{ ...fill, overflow: 'hidden' }}>
      {content}
      {bg.mode !== 'procedural' && bg.texture ? <Grid env={env} opacity={0.04} /> : null}
    </div>
  );
};
