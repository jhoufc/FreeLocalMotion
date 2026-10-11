import type { CSSProperties, ReactNode } from 'react';
import { SPRINGS, clamp, ease, lerp, progress, round, springWithIntensity } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, alignX, columnX, familyOf, useRoleText } from '@lms/scene-kit';
import { SCREENS_CHOREO as C, type AppScreensScene } from '../scenes/appScreens';
import { at } from '../common';
import { Phone } from './Device';
import { AppScreen, ImageOr } from './procedural';

type Env = SceneRuntime<AppScreensScene>;

export const AppScreensView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const screens = props.screens;
  const n = screens.length;
  const exitStart = env.duration - C.exit;

  const pw = (P ? 390 : 380) * u * o.scale;
  const ph = pw * 2.06;
  const px = (P ? L.cx : L.width * 0.66) + o.offsetX * L.safe.width;
  const py = (P ? L.height * 0.555 : L.cy) + o.offsetY * L.safe.height;

  // Timeline: entrance, then n holds separated by n-1 transitions, then the exit.
  const tIn = at(C.device.in, anim);
  const start = tIn + 0.8;
  const td = props.transitionDuration;
  const hold = Math.max(0.3, (exitStart - start - (n - 1) * td) / n);
  const tr = (i: number) => start + (i + 1) * hold + i * td; // start of transition i -> i+1
  let current = 0;
  let p = 0;
  for (let i = 0; i < n - 1; i++) {
    if (t >= tr(i)) {
      current = i;
      p = progress(t, tr(i), td, ease.inOutQuart);
      if (t >= tr(i) + td) {
        current = i + 1;
        p = 0;
      }
    }
  }
  const next = Math.min(n - 1, current + 1);
  const transitioning = p > 0 && p < 1;
  const dir = props.direction === 'right' ? -1 : 1;
  const vertical = props.direction === 'up';

  const pal = { bg: env.palette.surface, fg: env.palette.foreground, accent: env.palette.accent, secondary: env.palette.secondary };
  const sw = pw * 0.93;
  const sh = ph * 0.955;
  const screenNode = (i: number) => (
    <ImageOr assetId={screens[i]!.assetId} fallback={<AppScreen variant={screens[i]!.variant} w={sw} h={sh} pal={pal} t={Math.max(0, t - start)} font={familyOf(env, 'text')} />} />
  );
  const move = (frac: number): CSSProperties => ({ transform: vertical ? `translateY(${round(-frac * 100, 3)}%)` : `translateX(${round(-frac * dir * 100, 3)}%)` });

  const layer = (i: number, style: CSSProperties, child?: ReactNode, tag = 'screen') => (
    <div key={`${i}-${tag}`} style={{ position: 'absolute', inset: 0, ...style }}>
      {child ?? screenNode(i)}
    </div>
  );

  let stack: ReactNode[];
  if (!transitioning) stack = [layer(current, {})];
  else {
    switch (props.transition) {
      case 'slide':
        stack = [layer(current, move(p)), layer(next, move(p - 1))];
        break;
      case 'mask':
        stack = [
          layer(current, { transform: `scale(${round(1 - p * 0.06, 4)})`, filter: `brightness(${round(1 - p * 0.5, 3)})` }),
          layer(next, { clipPath: `circle(${round(p * 120, 3)}% at 50% ${vertical ? '100%' : '55%'})` }),
        ];
        break;
      case 'zoom':
        stack = [layer(current, { transform: `scale(${round(1 + p * 0.45, 4)})`, opacity: 1 - p }), layer(next, { transform: `scale(${round(0.82 + 0.18 * p, 4)})`, opacity: p })];
        break;
      case 'blur':
        stack = [
          layer(current, { filter: `blur(${round(p * 18 * u, 2)}px)`, opacity: 1 - p, transform: `scale(${round(1 + p * 0.06, 4)})` }),
          layer(next, { filter: `blur(${round((1 - p) * 18 * u, 2)}px)`, opacity: p }),
        ];
        break;
      case 'parallax':
      default:
        stack = [
          layer(current, { ...move(p * 0.35), filter: `brightness(${round(1 - p * 0.45, 3)})` }),
          layer(next, { ...move(p - 1), boxShadow: `0 0 ${round(40 * u, 2)}px rgba(0,0,0,0.6)`, zIndex: 2 }),
        ];
    }
    // Echo trail of the incoming screen for directional styles.
    if (E.echo.visible && (props.transition === 'slide' || props.transition === 'parallax')) {
      const echoes = Math.round(1 + E.echo.intensity * 2);
      for (let k = echoes; k >= 1; k--) {
        const pe = progress(t - k * 0.035, tr(current), td, ease.inOutQuart);
        stack.splice(1, 0, layer(next, { ...move(pe - 1), opacity: E.echo.opacity * (1 - k / (echoes + 1)), mixBlendMode: 'screen' }, <div style={{ position: 'absolute', inset: 0, background: env.color(E.echo.color) }} />, `echo-${k}`));
      }
    }
  }

  // Device: entrance spring + a swing on every transition (follow-through).
  const pop = springWithIntensity(Math.max(0, t - tIn), SPRINGS.heavy, 0.3 + anim.intensity * 0.5);
  const swing = transitioning ? Math.sin(Math.PI * p) * (vertical ? 0 : 7 * dir) * anim.intensity : 0;
  const out = progress(t, exitStart, C.exit, ease.inCubic);

  // Captions and title.
  const title = useRoleText(env, scene.texts.title, 'display', { size: (P ? 100 : 96) * u * o.scale, maxWidth: (P ? L.safe.width : L.width * 0.4) * o.scale, maxHeight: L.height * 0.25, lineHeight: 1.02 });
  const capFs = (P ? 44 : 40) * u * (0.85 + 0.15 * E.captions.intensity);
  const captionIndex = transitioning && p > 0.5 ? next : current;
  const capSwap = transitioning ? Math.abs(p - 0.5) * 2 : 1;
  const capIn = progress(t, at(C.captions.in, anim), 0.6, ease.cinematic) * (1 - out);
  const align = o.align;
  const colW = P ? L.safe.width : L.width * 0.4;
  const ax = P ? alignX(L, align) : columnX(L.safe.left, colW, align);
  const textTop = P ? L.safe.top + 10 * u : L.cy - (title.layout.height + 40 * u + capFs * 2.6) / 2;
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: px, y: py }} />
      {E.device.visible && (
        <div
          data-lms-target={env.target('device')}
          style={{
            position: 'absolute',
            left: px - pw / 2,
            top: py - ph / 2,
            opacity: E.device.opacity * clamp(pop * 3) * (1 - out),
            transform: `perspective(${round(2400 * u, 1)}px) translateY(${round((1 - pop) * 600 * u + out * 120 * u, 2)}px) rotateY(${round(-10 + swing + (1 - pop) * -25, 3)}deg) rotateX(${round(5 + (1 - pop) * 20, 3)}deg)`,
            filter: `drop-shadow(0 ${round(40 * u, 1)}px ${round(60 * u, 1)}px ${withAlpha('#000000', 0.45 * E.device.intensity)})`,
          }}
        >
          <Phone w={pw} model={props.model} screen={<div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{stack}</div>} glare={0.35} glareX={0.25 + 0.2 * Math.sin(t * 0.4)} />
        </div>
      )}

      <Anchor x={ax} y={textTop} align={align} width={colW}>
        <MaskedLines text={title} env={env} color={env.color(scene.texts.title.color)} align={align} start={at(C.title.in, anim, scene.texts.title.delay)} each={0.1} out={textOut} targetId={env.target('title')} />
      </Anchor>
      {E.captions.visible && (
        <Anchor x={ax} y={P ? py + ph / 2 + 50 * u : textTop + title.layout.height + 40 * u} align={align} width={colW}>
          <div data-lms-target={env.target('captions')} style={{ opacity: capIn * E.captions.opacity }}>
            <div
              style={{
                fontFamily: `"${familyOf(env, 'text')}"`,
                fontWeight: 500,
                fontSize: capFs,
                lineHeight: 1.25,
                color: env.color(E.captions.color),
                clipPath: `inset(0 0 ${round((1 - capSwap) * 100, 2)}% 0)`,
                transform: `translateY(${round((1 - capSwap) * capFs * 0.4, 2)}px)`,
                minHeight: capFs * 2.6,
              }}
            >
              {screens[captionIndex]!.caption}
            </div>
            <div style={{ display: 'flex', gap: 10 * u, marginTop: 24 * u, justifyContent: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center' }}>
              {screens.map((_, i) => {
                const active = i === current ? 1 - p : i === next && transitioning ? p : 0;
                return <div key={i} style={{ height: 8 * u, width: lerp(8, 40, active) * u, borderRadius: 99, background: active > 0.5 ? env.palette.accent : withAlpha(env.palette.foreground, 0.25 + active * 0.5) }} />;
              })}
            </div>
          </div>
        </Anchor>
      )}
    </div>
  );
};

