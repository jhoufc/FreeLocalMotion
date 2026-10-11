import { SPRINGS, clamp, ease, progress, round, springWithIntensity } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, alignX, useRoleText, columnX, familyOf } from '@lms/scene-kit';
import { PHONE_CHOREO as C, type FloatingPhoneScene } from '../scenes/floatingPhone';
import { at } from '../common';
import { Phone } from './Device';
import { AppScreen, ImageOr } from './procedural';

type Env = SceneRuntime<FloatingPhoneScene>;

export const FloatingPhoneView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const exitStart = env.duration - C.exit;
  const persp = props.perspective;

  const pw = (P ? 410 : 400) * u * props.scale;
  const ph = pw * 2.06;
  const px = (P ? L.cx : L.width * 0.68) + props.positionX * L.width;
  const py = (P ? L.height * 0.615 : L.cy) + props.positionY * L.height;

  const tIn = at(C.device.in, anim);
  const sp = springWithIntensity(Math.max(0, t - tIn), SPRINGS.heavy, 0.3 + anim.intensity * 0.5);
  const out = progress(t, exitStart, C.exit, ease.inCubic);
  const life = t - tIn;
  const rotY = props.rotation * persp + Math.sin(life * 0.55) * 7 * persp + (1 - sp) * -40 * persp + out * 30;
  const rotX = 9 * persp + Math.cos(life * 0.42) * 3 * persp + (1 - sp) * 35 * persp - out * 20;
  const rotZ = (1 - sp) * 6 + Math.sin(life * 0.3) * 1.2 * persp;
  const floatY = Math.sin(life * 0.9) * 14 * u;
  const push = 1 + 0.06 * ease.inOutSine(progress(t, tIn + 1, env.duration - tIn - 1.5));
  const dy = (1 - sp) * 700 * u + out * 160 * u + floatY;
  const scale = (0.86 + 0.14 * clamp(sp, 0, 1.2)) * push * (1 - out * 0.12);
  const glareX = progress(t, at(C.reflection.in, anim), 0.9, ease.inOutQuart) * 1.4 - 0.2;

  const screen = (
    <ImageOr
      assetId={props.screenAssetId}
      fallback={<AppScreen variant={props.screenVariant} w={pw * 0.93} h={ph * 0.955} pal={{ bg: env.palette.surface, fg: env.palette.foreground, accent: env.palette.accent, secondary: env.palette.secondary }} t={life} font={familyOf(env, 'text')} />}
    />
  );
  const glow = E.glow.visible ? progress(t, at(C.glow.in, anim), C.glow.dur, ease.cinematic) * (1 - out) : 0;
  const glowR = pw * (1.1 + 0.6 * E.glow.intensity) * (1 + 0.05 * Math.sin(t * 2));

  const kicker = useRoleText(env, scene.texts.kicker, 'mono', { size: (P ? 26 : 22) * u, maxWidth: L.safe.width, lineHeight: 1.1 });
  const headline = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 104 : 100) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.42) * o.scale,
    maxHeight: (P ? L.height * 0.17 : L.height * 0.4) * o.scale,
    lineHeight: 1.02,
  });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 36 : 32) * u * o.scale, maxWidth: (P ? L.safe.width * 0.9 : L.width * 0.36) * o.scale, lineHeight: 1.35 });
  const align = P ? (o.align === 'start' ? 'center' : o.align) : o.align;
  const ax = (P ? alignX(L, align) : columnX(L.safe.left, L.width * 0.44, align)) + o.offsetX * L.safe.width;
  const blockH = kicker.layout.height + 26 * u + headline.layout.height + 26 * u + sub.layout.height;
  const ty = (P ? L.safe.top + 10 * u : L.cy - blockH / 2) + o.offsetY * L.safe.height;
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);

  const phoneNode = (reflect: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: -pw / 2,
        top: -ph / 2,
        transform: `perspective(${round(2600 * u, 1)}px) rotateX(${round(rotX, 3)}deg) rotateY(${round(rotY, 3)}deg) rotateZ(${round(rotZ, 3)}deg)`,
        transformStyle: 'preserve-3d',
      }}
    >
      <Phone w={pw} model={props.model} screen={screen} glare={reflect ? 0 : E.reflection.visible ? E.reflection.opacity * E.reflection.intensity : 0} glareX={glareX} />
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: px, y: py }} />
      {glow > 0 && (
        <div
          data-lms-target={env.target('glow')}
          style={{
            position: 'absolute',
            left: px - glowR,
            top: py - glowR + dy * 0.5,
            width: glowR * 2,
            height: glowR * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(env.color(E.glow.color), 0.5 * E.glow.opacity)} 0%, ${withAlpha(env.palette.secondary, 0.18 * E.glow.opacity)} 40%, transparent 68%)`,
            opacity: glow,
          }}
        />
      )}
      {/* contact shadow */}
      <div
        style={{
          position: 'absolute',
          left: px - pw * 0.6,
          top: py + ph * 0.52,
          width: pw * 1.2,
          height: 40 * u,
          borderRadius: '50%',
          background: withAlpha('#000000', 0.45 * E.device.intensity * clamp(sp) * (1 - out)),
          filter: `blur(${round(18 * u, 2)}px)`,
          transform: `scale(${round(1 - floatY / (200 * u), 4)})`,
        }}
      />
      {E.device.visible && (
        <div data-lms-target={env.target('device')} style={{ position: 'absolute', left: px, top: py, transform: `translateY(${round(dy, 2)}px) scale(${round(scale, 4)})`, opacity: E.device.opacity * clamp(sp * 3) * (1 - out) }}>
          {!P && E.reflection.visible && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: ph + 30 * u,
                transform: 'scaleY(-1)',
                opacity: 0.18 * E.reflection.opacity,
                maskImage: 'linear-gradient(to top, black, transparent 35%)',
                WebkitMaskImage: 'linear-gradient(to top, black, transparent 35%)',
              }}
            >
              {phoneNode(true)}
            </div>
          )}
          {phoneNode(false)}
        </div>
      )}

      <Anchor x={ax} y={ty} align={align} width={P ? L.safe.width : L.width * 0.44}>
        <MaskedLines text={kicker} env={env} color={env.color(scene.texts.kicker.color)} align={align} start={at(C.kicker.in, anim, scene.texts.kicker.delay)} out={textOut} targetId={env.target('kicker')} />
        <div style={{ height: 26 * u }} />
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={align} start={at(C.headline.in, anim, scene.texts.headline.delay)} each={0.1} out={textOut} targetId={env.target('headline')} />
        <div style={{ height: 26 * u }} />
        <MaskedLines text={sub} env={env} color={withAlpha(env.color(scene.texts.sub.color), 0.75)} align={align} start={at(C.sub.in, anim, scene.texts.sub.delay)} out={textOut} targetId={env.target('sub')} />
      </Anchor>
    </div>
  );
};
