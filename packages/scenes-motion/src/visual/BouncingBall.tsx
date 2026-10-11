import { useMemo, type ReactNode } from 'react';
import {
  EchoTrail,
  SPRINGS,
  bounceAt,
  bounceImpacts,
  clamp,
  ease,
  lerp,
  lineUnitWidth,
  progress,
  round,
  springWithIntensity,
  type BounceConfig,
} from '@lms/motion-core';
import { mixHex, withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { MaskedLines, SceneBackground, alignX, useRoleText } from '@lms/scene-kit';
import { BOUNCE_CHOREO as C, type BouncingBallScene } from '../scenes/bouncingBall';
import { at } from '../common';

type Env = SceneRuntime<BouncingBallScene>;

export const BouncingBallView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const k = anim.intensity;
  const props = scene.props;
  const exitStart = env.duration - C.exit;

  const head = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 190 : 230) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.78) * o.scale,
    lineHeight: 1,
  });
  const fs = head.layout.fontSize;
  const line = head.layout.lines[0] ?? '';
  const tracking = scene.texts.headline.tracking;
  const font = head.font;
  const width = (s: string) => lineUnitWidth(s, font, tracking) * fs;

  // Landing target: the dot of the first "i" (rendered dotless), a final period, or above.
  const iIndex = props.landing === 'dot-i' ? Array.from(line).findIndex((c) => c === 'i') : -1;
  const landing = props.landing === 'dot-i' && iIndex < 0 ? 'period' : props.landing;
  const chars = Array.from(line).map((c, i) => (i === iIndex ? 'ı' : c));
  const textW = width(line) + (landing === 'period' ? fs * 0.28 : 0);
  const ax = alignX(L, o.align) + o.offsetX * L.safe.width;
  const left = o.align === 'start' ? ax : o.align === 'end' ? ax - textW : ax - textW / 2;
  const baseline = (P ? L.height * 0.5 : L.height * 0.56) + o.offsetY * L.safe.height;

  const flightR = 34 * u * props.size * o.scale;
  const dotR = fs * (landing === 'above' ? 0.12 : 0.085);
  const finalR = landing === 'above' ? flightR : dotR;
  const target =
    landing === 'dot-i'
      ? { x: left + width(Array.from(line).slice(0, iIndex).join('')) + width('ı') / 2, y: baseline - fs * 0.71 }
      : landing === 'period'
        ? { x: left + width(line) + fs * 0.12, y: baseline - dotR }
        : { x: left + textW / 2, y: baseline - fs * 1.05 };

  const tBall = at(C.ball.in, anim) + 0.15;
  const cfg: BounceConfig = useMemo(
    () => ({
      from: { x: left - (P ? 140 : 260) * u, y: baseline - flightR },
      to: { x: target.x, y: target.y },
      floor: baseline - flightR,
      height: (P ? 420 : 380) * u,
      bounces: props.bounces,
      elasticity: props.elasticity,
      duration: 2.1 / props.speed / anim.pace,
      anticipation: 0.35 / props.speed,
    }),
    [left, baseline, flightR, target.x, target.y, props.bounces, props.elasticity, props.speed, anim.pace, P, u],
  );
  const local = t - tBall;
  const state = bounceAt(cfg, local, 0.5 + k * 0.5);
  const landT = cfg.duration + (cfg.anticipation ?? 0);
  const shrink = ease.inOutQuart(progress(local, landT - 0.35, 0.45));
  const r = lerp(flightR, finalR, shrink);

  // When does the ball first pass over each letter? (sampled once per config)
  const passTimes = useMemo(() => {
    const samples = Array.from({ length: 160 }, (_, i) => {
      const tt = (i / 159) * landT;
      return { tt, x: bounceAt(cfg, tt).x };
    });
    let acc = left;
    return chars.map((c) => {
      const cx = acc + width(c) / 2;
      acc += width(c);
      return samples.find((s) => s.x >= cx)?.tt ?? landT;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, line, fs]);

  const ballColor = env.color(scene.elements.ball.color);
  const exitPop = progress(t, exitStart, 0.3, ease.inCubic);
  const ballNode = (s: ReturnType<typeof bounceAt>, rr: number, alpha = 1): ReactNode => {
    const shift = s.rotate === 0 ? rr * (1 - s.sy) : 0; // keep the squashed ball on the floor
    return (
      <div
        style={{
          position: 'absolute',
          left: s.x - rr,
          top: s.y - rr + shift,
          width: rr * 2,
          height: rr * 2,
          borderRadius: '50%',
          opacity: alpha,
          background: `radial-gradient(circle at 34% 30%, ${mixHex(ballColor, '#FFFFFF', 0.45 * scene.elements.ball.intensity)}, ${ballColor} 45%, ${mixHex(ballColor, '#000000', 0.25)})`,
          transform: `rotate(${round(s.rotate, 3)}deg) scale(${round(s.sx, 4)}, ${round(s.sy, 4)}) rotate(${round(-s.rotate, 3)}deg)`,
        }}
      />
    );
  };

  const impacts = bounceImpacts(cfg).slice(0, -1);
  const floorEl = scene.elements.floor;
  const floorIn = progress(t, at(C.floor.in, anim), 0.6, ease.cinematic) * (1 - progress(t, exitStart, 0.4));
  const lift = clamp((cfg.floor - state.y) / cfg.height);

  let acc = left;
  const letters = chars.map((ch, i) => {
    const x = acc;
    acc += width(ch);
    const pass = tBall + passTimes[i]!;
    const sp = springWithIntensity(Math.max(0, t - pass), SPRINGS.bouncy, 0.4 + k * 0.6);
    const fall = progress(t, exitStart + i * 0.014, 0.3, ease.inQuart);
    const sy = clamp(sp, 0, 1.4) * (1 - fall);
    const sx = 1 + (1 - Math.min(1, sp)) * 0.35;
    return (
      <span
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: baseline - fs * 0.86,
          display: 'inline-block',
          transformOrigin: 'center bottom',
          transform: `translateY(${round(fall * fs * 0.4, 2)}px) scale(${round(sx, 4)}, ${round(sy, 4)})`,
          whiteSpace: 'pre',
        }}
      >
        {ch}
      </span>
    );
  });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />
      {floorEl.visible && (
        <>
          <div
            data-lms-target={env.target('floor')}
            style={{ position: 'absolute', left: L.width * 0.5 * (1 - floorIn), width: L.width * floorIn, top: baseline + 2 * u, height: Math.max(1, 2 * u), background: withAlpha(env.color(floorEl.color), floorEl.opacity * 0.6) }}
          />
          {local > -0.4 && shrink < 0.9 && (
            <div
              style={{
                position: 'absolute',
                left: state.x - r * 1.3 * (1 - lift * 0.5),
                top: baseline - 6 * u,
                width: r * 2.6 * (1 - lift * 0.5),
                height: 12 * u,
                borderRadius: '50%',
                background: withAlpha('#000000', 0.28 * floorEl.intensity * (1 - lift * 0.7)),
                filter: `blur(${round(4 * u, 2)}px)`,
              }}
            />
          )}
          {impacts.map((ti, i) => {
            const q = progress(local, ti, 0.35);
            if (q <= 0 || q >= 1) return null;
            const ix = bounceAt(cfg, ti).x;
            return [-1, 1].flatMap((side) =>
              [0, 1, 2].map((j) => (
                <div
                  key={`${i}-${side}-${j}`}
                  style={{
                    position: 'absolute',
                    left: ix + side * (r + q * (30 + j * 18) * u),
                    top: baseline - (10 + j * 14) * u * (1 - q * 0.4),
                    width: 14 * u * (1 - q),
                    height: Math.max(1, 3 * u),
                    borderRadius: 2,
                    background: withAlpha(env.color(floorEl.color), 0.6 * (1 - q)),
                    transform: `rotate(${side * (20 + j * 22)}deg)`,
                  }}
                />
              )),
            );
          })}
        </>
      )}

      <div
        data-lms-target={env.target('headline')}
        style={{
          position: 'absolute',
          inset: 0,
          fontFamily: `"${font.family}"`,
          fontWeight: font.weight,
          fontStyle: font.italic ? 'italic' : 'normal',
          fontSize: fs,
          lineHeight: 1,
          letterSpacing: `${tracking}em`,
          color: env.color(scene.texts.headline.color),
          visibility: scene.texts.headline.visible ? 'visible' : 'hidden',
        }}
      >
        {letters}
      </div>

      {scene.elements.trail.visible && local > 0 && !state.settled && (
        <div data-lms-target={env.target('trail')} style={{ position: 'absolute', inset: 0, opacity: scene.elements.trail.opacity }}>
          <EchoTrail
            t={local}
            count={Math.round(3 + scene.elements.trail.intensity * 4)}
            spacing={0.028}
            decay={0.62}
            render={(tt, i) => (i === 0 ? null : ballNode(bounceAt(cfg, tt, 0.5 + k * 0.5), r * (1 - i * 0.06)))}
          />
        </div>
      )}
      {scene.elements.ball.visible && (
        <div data-lms-target={env.target('ball')} style={{ position: 'absolute', inset: 0, opacity: scene.elements.ball.opacity * (1 - exitPop), transform: `scale(${round(1 + exitPop * 0.2, 4)})`, transformOrigin: `${round(target.x, 1)}px ${round(target.y, 1)}px` }}>
          {ballNode(state, r)}
        </div>
      )}

      <div style={{ position: 'absolute', left: P ? L.safe.left : left, width: P ? L.safe.width : Math.max(textW, 600 * u), top: baseline + (P ? 90 : 70) * u, textAlign: P ? 'center' : o.align === 'start' ? 'left' : o.align === 'end' ? 'right' : 'center' }}>
        <MaskedLines
          text={useRoleText(env, scene.texts.sub, 'text', { size: (P ? 38 : 34) * u * o.scale, maxWidth: (P ? L.safe.width : Math.max(textW, 600 * u)) * 0.95, lineHeight: 1.3 })}
          env={env}
          color={withAlpha(env.color(scene.texts.sub.color), 0.75)}
          align={P ? 'center' : o.align}
          start={at(C.sub.in, anim, scene.texts.sub.delay) / props.speed}
          out={progress(t, exitStart, 0.3, ease.inCubic)}
          targetId={env.target('sub')}
        />
      </div>
    </div>
  );
};
