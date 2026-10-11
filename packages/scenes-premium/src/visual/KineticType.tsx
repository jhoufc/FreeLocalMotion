import type { CSSProperties, ReactNode } from 'react';
import { DirectionalBlur, SPRINGS, clamp, ease, progress, randomAt, randomRange, round, springWithIntensity, velocityOf } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, TextBlock, alignX } from '@lms/scene-kit';
import { KINETIC_CHOREO as C, type KineticTypeScene } from '../scenes/kineticType';
import { at } from '../common';
import { Anchor, MaskedLines, familyOf, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<KineticTypeScene>;
type Dir = KineticTypeScene['props']['direction'];

const horizontal = (d: Dir) => d === 'right' || d === 'left';
/** Unit vector of travel. */
const vec = (d: Dir): [number, number] => (d === 'right' ? [1, 0] : d === 'left' ? [-1, 0] : d === 'down' ? [0, 1] : [0, -1]);

/** Transform-origin where a bar starts growing (opposite of travel) and where it collapses (travel side). */
const origins = (d: Dir): [string, string] =>
  d === 'right' ? ['left center', 'right center'] : d === 'left' ? ['right center', 'left center'] : d === 'down' ? ['center top', 'center bottom'] : ['center bottom', 'center top'];

/** Diagonal kinetic bands behind the type. */
const Stripes = ({ env }: { env: Env }) => {
  const el = env.scene.elements.stripes;
  if (!el.visible) return null;
  const { t, layout: L } = env;
  const u = L.u;
  const [vx] = vec(env.scene.props.direction);
  const dir = vx === 0 ? 1 : vx;
  const n = Math.round(5 + el.intensity * 4);
  const ex = progress(t, env.duration - C.exit, C.exit, ease.inExpo);
  const base = at(C.stripes.in, env.scene.animation);
  const bands: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const y = randomRange('kt-y', i, -0.1, 1.1);
    const h = randomRange('kt-h', i, 18, 150) * u;
    const speed = randomRange('kt-s', i, 40, 160) * u * (0.6 + env.scene.animation.intensity * 0.4);
    const grow = progress(t, base + i * 0.05, 0.7, ease.cinematic);
    const accent = randomAt('kt-c', i) > 0.78;
    const color = accent ? env.palette.accent : env.color(el.color);
    const alpha = (accent ? 0.5 : 0.22 + randomAt('kt-a', i) * 0.25) * el.opacity;
    bands.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '-30%',
          width: '160%',
          top: `${round(y * 100, 2)}%`,
          height: h,
          background: `linear-gradient(90deg, transparent, ${withAlpha(color, alpha)} 30%, ${withAlpha(color, alpha * 0.6)} 75%, transparent)`,
          transformOrigin: dir > 0 ? 'left center' : 'right center',
          transform: `translateX(${round(dir * (t * speed + ex * 900 * u), 2)}px) scaleX(${round(grow, 4)})`,
        }}
      />,
    );
  }
  return (
    <div style={{ position: 'absolute', inset: '-25%', transform: `rotate(${L.isPortrait ? -22 : -12}deg)`, opacity: 1 - ex }} data-lms-target={env.target('stripes')}>
      {bands}
    </div>
  );
};

/** Giant outlined first word drifting behind the composition. */
const Echo = ({ env, word, size, y }: { env: Env; word: string; size: number; y: number }) => {
  const el = env.scene.elements.echo;
  if (!el.visible || !word) return null;
  const { t, layout: L } = env;
  const [vx, vy] = vec(env.scene.props.direction);
  const start = at(C.echo.in, env.scene.animation);
  const inP = progress(t, start, C.echo.dur, ease.cinematic);
  const ex = progress(t, env.duration - C.exit, C.exit, ease.inCubic);
  const drift = (t - start) * 34 * L.u;
  const fs = size * (2.1 + el.intensity * 0.5);
  return (
    <div
      data-lms-target={env.target('echo')}
      style={{
        position: 'absolute',
        left: 0,
        top: y - fs * 0.55,
        width: L.width,
        whiteSpace: 'nowrap',
        fontFamily: `"${familyOf(env, 'display')}"`,
        fontWeight: 900,
        fontStretch: '125%',
        fontSize: fs,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        textTransform: 'uppercase',
        color: 'transparent',
        WebkitTextStroke: `${round(2 * L.u, 2)}px ${withAlpha(env.color(el.color), 1)}`,
        opacity: el.opacity * inP * (1 - ex),
        transform: `translate(${round((vx * drift - (1 - inP) * vx * 200 * L.u) - L.width * 0.08, 2)}px, ${round(vy * drift * 0.5, 2)}px)`,
      }}
    >
      {`${word} ${word}`}
    </div>
  );
};

export const KineticTypeView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const k = anim.intensity;
  const dir = scene.props.direction;
  const [vx, vy] = vec(dir);
  const [growOrigin, shrinkOrigin] = origins(dir);
  const H = horizontal(dir);

  const head = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 236 : 214) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.8) * o.scale,
    maxHeight: (P ? L.height * 0.46 : L.height * 0.52) * o.scale,
    lineHeight: 0.86,
  });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 42 : 40) * u * o.scale, maxWidth: (P ? L.safe.width * 0.92 : L.width * 0.46) * o.scale, lineHeight: 1.25 });
  const tag = useRoleText(env, scene.texts.tag, 'mono', { size: (P ? 24 : 21) * u * o.scale, maxWidth: L.safe.width, lineHeight: 1 });

  const ax = alignX(L, o.align, P ? 0 : L.width * 0.02) + o.offsetX * L.safe.width;
  const centerY = (P ? L.height * 0.47 : L.height * 0.47) + o.offsetY * L.safe.height;
  const headTop = centerY - head.layout.height / 2;
  const blockW = Math.max(head.layout.width, sub.layout.width, tag.layout.width) + 40 * u;

  const tHead = at(C.headline.in, anim, scene.texts.headline.delay);
  const tBlocks = at(C.blocks.in, anim);
  const tSub = at(C.sub.in, anim, scene.texts.sub.delay);
  const tTag = at(C.tag.in, anim, scene.texts.tag.delay);
  const exitStart = env.duration - C.exit;
  const blockColor = env.color(scene.elements.blocks.color);
  const blocksOn = scene.elements.blocks.visible;
  const barPad = 0.02 + scene.elements.blocks.intensity * 0.03;
  const each = 0.12 / anim.pace;
  const firstWord = head.layout.lines[0]?.split(' ')[0] ?? '';

  const renderWord = (unitIndex: number, word: string): ReactNode => {
    const s = Math.max(tHead, tBlocks) + unitIndex * each;
    const grow = blocksOn ? progress(t, s, 0.22, ease.snap) : 1;
    const shrink = blocksOn ? progress(t, s + 0.22, 0.28, ease.inOutQuart) : 1;
    const revealAt = s + (blocksOn ? 0.2 : 0);
    // Exit: the block covers the word again, then collapses in the travel direction.
    const ex0 = exitStart + unitIndex * 0.04;
    const cover = blocksOn ? progress(t, ex0, 0.14, ease.snap) : 0;
    const collapse = blocksOn ? progress(t, ex0 + 0.16, 0.18, ease.inExpo) : progress(t, ex0, 0.3, ease.inCubic);
    const visible = t >= revealAt && cover < 1;
    const chars = Array.from(word);
    const charEach = scene.props.split === 'chars' ? 0.028 / anim.pace : 0;
    const content = chars.map((ch, ci) => {
      const cs = revealAt + ci * charEach;
      const f = (x: number) => springWithIntensity(Math.max(0, x - cs), SPRINGS.bouncy, 0.35 + k * 0.65);
      const sp = f(t);
      const v = velocityOf(f, t);
      const dist = 0.55;
      const off = (1 - sp) * dist;
      const style: CSSProperties = {
        display: 'inline-block',
        transform: `translate(${round(-vx * off, 4)}em, ${round(-vy * off, 4)}em) scale(${round(1 + (1 - sp) * 0.4 * k, 4)}) skewX(${round(H ? -vx * (1 - sp) * 14 * k : 0, 3)}deg)`,
        transformOrigin: 'center bottom',
        opacity: clamp(sp * 3),
      };
      const blur = Math.min(18, Math.abs(v) * 2.2 * u);
      return (
        <DirectionalBlur key={ci} as="span" x={H ? blur : 0} y={H ? 0 : blur} style={style}>
          {ch}
        </DirectionalBlur>
      );
    });
    const barScale = cover > 0 ? cover * (1 - collapse) : grow * (1 - shrink);
    const barOrigin = cover > 0 ? (collapse > 0 ? shrinkOrigin : growOrigin) : shrink > 0 ? shrinkOrigin : growOrigin;
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ display: 'inline-block', visibility: visible ? 'visible' : 'hidden' }}>{content}</span>
        {blocksOn && barScale > 0.001 && (
          <span
            style={{
              position: 'absolute',
              left: `${-barPad}em`,
              right: `${-barPad}em`,
              top: `${0.04 - barPad}em`,
              bottom: `${0.02 - barPad}em`,
              background: blockColor,
              opacity: scene.elements.blocks.opacity,
              transformOrigin: barOrigin,
              transform: H ? `scaleX(${round(barScale, 4)})` : `scaleY(${round(barScale, 4)})`,
            }}
          />
        )}
      </span>
    );
  };

  // Accent rule that draws before the subheadline.
  const rule = progress(t, tSub - 0.15, 0.5, ease.cinematic) * (1 - progress(t, exitStart, 0.3, ease.inCubic));
  const subOut = progress(t, exitStart, 0.35, ease.inCubic);
  const tagIn = progress(t, tTag, 0.5, ease.cinematic);
  const tagOut = progress(t, exitStart + 0.1, 0.3, ease.inCubic);
  const M = scene.elements.marker;
  const blink = t < tTag + 0.6 ? (Math.floor((t - tTag) * 10) % 2 === 0 ? 1 : 0.2) : 1;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />
      <Stripes env={env} />
      <Echo env={env} word={firstWord} size={head.layout.fontSize} y={centerY} />

      {scene.texts.tag.visible && (
        <Anchor x={ax} y={headTop - (P ? 86 : 74) * u} align={o.align} width={blockW} style={{ opacity: tagIn * (1 - tagOut) }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 * u }}>
            {M.visible && (
              <span
                data-lms-target={env.target('marker')}
                style={{ width: 14 * u * M.intensity, height: 14 * u * M.intensity, background: env.color(M.color), opacity: blink * M.opacity, display: 'inline-block', flex: 'none' }}
              />
            )}
            <TextBlock
              text={tag}
              color={env.color(scene.texts.tag.color)}
              align={o.align}
              split="lines"
              targetId={env.target('tag')}
              renderUnit={(_u, c) => <span style={{ display: 'inline-block', transform: `translateX(${round((1 - tagIn) * -20 * u, 2)}px)` }}>{c}</span>}
            />
          </span>
        </Anchor>
      )}

      <Anchor x={ax} y={headTop} align={o.align} width={blockW}>
        <TextBlock
          text={head}
          color={env.color(scene.texts.headline.color)}
          align={o.align}
          split="words"
          targetId={env.target('headline')}
          renderUnit={(unit, c) => renderWord(unit.index, String(c))}
        />
      </Anchor>

      <Anchor x={ax} y={headTop + head.layout.height + (P ? 56 : 44) * u} align={o.align} width={blockW}>
        <div
          style={{
            height: Math.max(2, 4 * u),
            width: 120 * u * rule,
            background: env.palette.accent,
            marginBottom: 22 * u,
            display: 'inline-block',
          }}
        />
        <MaskedLines text={sub} env={env} color={env.color(scene.texts.sub.color)} align={o.align} start={tSub} out={subOut} targetId={env.target('sub')} />
      </Anchor>
    </div>
  );
};
