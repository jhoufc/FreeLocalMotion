import type { CSSProperties, ReactNode } from 'react';
import {
  DirectionalBlur,
  EchoTrail,
  SPRINGS,
  TAU,
  clamp,
  ease,
  lerp,
  lineUnitWidth,
  noise1D,
  progress,
  randomRange,
  round,
  springWithIntensity,
  useFontsEpoch,
} from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { MaskedLines, SceneBackground, alignX, familyOf, useRoleText } from '@lms/scene-kit';
import { SEMANTIC_CHOREO as C, type SemanticWordsScene, type WordPreset } from '../scenes/semanticWords';

type Env = SceneRuntime<SemanticWordsScene>;

interface WordCtx {
  env: Env;
  word: string;
  preset: WordPreset;
  /** Seconds since the word's slot started, and the slot length. */
  lt: number;
  slot: number;
  /** End of the behaviour (seconds into the slot); after it, the out-transition. */
  active: number;
  fs: number;
  charX: number[];
  charW: number[];
  totalW: number;
  /** Word block origin (left edge, baseline-ish top). */
  x: number;
  y: number;
  color: string;
  accent: string;
  k: number;
  index: number;
}

const charStyle = (extra: CSSProperties): CSSProperties => ({ position: 'absolute', top: 0, whiteSpace: 'pre', display: 'inline-block', ...extra });

const renderWord = (c: WordCtx): ReactNode => {
  const { lt, slot, fs, charX, word, k, env } = c;
  const u = env.layout.u;
  const chars = Array.from(word);
  const inP = (dur: number, e = ease.cinematic) => progress(lt, 0, dur, e);
  const outStart = c.active;
  const outP = (dur: number, e = ease.inCubic) => progress(lt, outStart, dur, e);
  const nodes: ReactNode[] = [];
  const extras: ReactNode[] = [];
  let container: CSSProperties = {};

  switch (c.preset) {
    case 'explode': {
      const pop = springWithIntensity(lt, SPRINGS.bouncy, 0.4 + k * 0.6);
      const charge = progress(lt, outStart - 0.3, 0.3, ease.inQuart); // anticipation: compress before the blast
      const blast = outP(Math.min(0.55, slot - outStart + 0.05), ease.outExpo);
      chars.forEach((ch, i) => {
        const a = randomRange('se-a', i + c.index * 13, 0, TAU);
        const d = blast * randomRange('se-d', i, 500, 1100) * u * (0.6 + k * 0.4);
        nodes.push(
          <span
            key={i}
            style={charStyle({
              left: charX[i],
              transform: `translate(${round(Math.cos(a) * d, 2)}px, ${round(Math.sin(a) * d + blast * blast * 300 * u, 2)}px) rotate(${round(blast * randomRange('se-r', i, -260, 260), 2)}deg) scale(${round(clamp(pop, 0, 1.3) * (1 - charge * 0.12) + blast * 0.6, 4)}, ${round(clamp(pop, 0, 1.3) * (1 - charge * 0.25), 4)})`,
              opacity: 1 - clamp(blast * 1.4 - 0.4),
            })}
          >
            {ch}
          </span>,
        );
      });
      const shards = Math.round(10 + c.k * 14);
      for (let i = 0; i < shards && blast > 0; i++) {
        const a = randomRange('se-sa', i + c.index * 7, 0, TAU);
        const d = blast * randomRange('se-sd', i, 200, 900) * u;
        const s = randomRange('se-ss', i, 8, 26) * u;
        extras.push(
          <div
            key={`s${i}`}
            style={{ position: 'absolute', left: c.totalW / 2 + Math.cos(a) * d - s / 2, top: fs * 0.45 + Math.sin(a) * d - s / 2, width: s, height: s, background: i % 3 ? c.accent : c.color, opacity: 1 - blast, transform: `rotate(${round(a * 90, 2)}deg)` }}
          />,
        );
      }
      if (blast > 0 && blast < 1)
        extras.push(<div key="ring" style={{ position: 'absolute', left: c.totalW / 2 - blast * 700 * u, top: fs * 0.45 - blast * 700 * u, width: blast * 1400 * u, height: blast * 1400 * u, borderRadius: '50%', border: `${Math.max(1, 4 * u * (1 - blast))}px solid ${withAlpha(c.accent, 1 - blast)}` }} />);
      break;
    }
    case 'fast': {
      const W = env.layout.width;
      const xAt = (tt: number) => lerp(-W, 0, ease.outExpo(progress(tt, 0, 0.45))) + lerp(0, W * 1.2, ease.inExpo(progress(tt, outStart, Math.max(0.2, slot - outStart))));
      const v = (xAt(lt + 1 / 120) - xAt(lt - 1 / 120)) * 60;
      const blur = Math.min(60 * u, Math.abs(v) / 60);
      const wordNode = (tt: number, alpha: number) => (
        <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateX(${round(xAt(tt), 2)}px) skewX(${round(-clamp(v / 4000, -1, 1) * 18, 2)}deg)`, opacity: alpha, whiteSpace: 'pre' }}>
          <DirectionalBlur x={blur}>{word}</DirectionalBlur>
        </div>
      );
      nodes.push(
        <EchoTrail key="trail" t={lt} count={Math.round(2 + c.k * 3)} spacing={0.035} decay={0.5} render={(tt, i) => wordNode(tt, i === 0 ? 1 : 0.6)} />,
      );
      const speed = clamp(Math.abs(v) / 6000);
      for (let i = 0; i < 12 && speed > 0.02; i++) {
        extras.push(
          <div
            key={`l${i}`}
            style={{ position: 'absolute', left: -W * 0.3 + randomRange('sf-x', i + c.index, 0, W) * 1.2, top: randomRange('sf-y', i, -0.2, 1.1) * fs, width: randomRange('sf-w', i, 120, 520) * u * speed, height: Math.max(1, 3 * u), background: withAlpha(c.accent, 0.8 * speed) }}
          />,
        );
      }
      break;
    }
    case 'grow': {
      const g = ease.cinematic(progress(lt, 0, outStart, ease.linear));
      const s = lerp(0.18, 1.05, g);
      const out = outP(Math.max(0.2, slot - outStart), ease.inExpo);
      container = { transform: `scale(${round(s * (1 + out * 3.5), 4)})`, opacity: clamp(g * 4) * (1 - out), letterSpacing: `${round(-0.03 + g * 0.05, 4)}em` };
      nodes.push(<span key="w" style={charStyle({ left: 0, position: 'relative' })}>{word}</span>);
      extras.push(
        <div key="disc" style={{ position: 'absolute', left: c.totalW / 2 - fs * 2.2 * g, top: fs * 0.45 - fs * 2.2 * g, width: fs * 4.4 * g, height: fs * 4.4 * g, borderRadius: '50%', background: `radial-gradient(circle, ${withAlpha(c.accent, 0.22)}, transparent 70%)`, opacity: 1 - out }} />,
      );
      break;
    }
    case 'focus': {
      const f = inP(Math.min(1.1, outStart), ease.outCubic);
      const out = outP(Math.max(0.2, slot - outStart));
      const blur = (1 - f) * 40 * u + out * 30 * u;
      container = { filter: `blur(${round(blur, 2)}px)`, transform: `scale(${round(1.15 - f * 0.15 + out * 0.1, 4)})`, opacity: clamp(f * 2) * (1 - out) };
      nodes.push(<span key="w" style={charStyle({ left: 0, position: 'relative' })}>{word}</span>);
      const pad = lerp(260, 30, f) * u;
      const s = 50 * u;
      const bw = Math.max(1, 4 * u);
      [0, 1, 2, 3].forEach((q) => {
        const right = q % 2 === 1;
        const bottom = q > 1;
        extras.push(
          <div
            key={`b${q}`}
            style={{
              position: 'absolute',
              left: right ? c.totalW + pad - s : -pad,
              top: bottom ? fs * 0.95 + pad - s : -pad * 0.6,
              width: s,
              height: s,
              borderLeft: right ? undefined : `${bw}px solid ${c.accent}`,
              borderRight: right ? `${bw}px solid ${c.accent}` : undefined,
              borderTop: bottom ? undefined : `${bw}px solid ${c.accent}`,
              borderBottom: bottom ? `${bw}px solid ${c.accent}` : undefined,
              opacity: clamp(f * 3) * (1 - out),
            }}
          />,
        );
      });
      break;
    }
    case 'connect': {
      const pts = chars.map((_, i) => ({ sx: randomRange('sc-x', i + c.index * 5, -0.4, 1.4) * c.totalW, sy: randomRange('sc-y', i + c.index * 3, -1.2, 1.6) * fs }));
      const arrive = chars.map((_, i) => springWithIntensity(Math.max(0, lt - 0.15 - i * 0.07), SPRINGS.type, 0.3 + k * 0.5));
      const out = outP(Math.max(0.2, slot - outStart), ease.inOutQuart);
      const pos = chars.map((_, i) => ({ x: lerp(pts[i]!.sx, charX[i]!, arrive[i]!) * (1 - out) + c.totalW / 2 * out, y: lerp(pts[i]!.sy, 0, arrive[i]!) * (1 - out) + fs * 0.45 * out }));
      const lineDraw = progress(lt, 0, 0.5, ease.cinematic);
      extras.push(
        <svg key="net" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1} height={1}>
          {pos.slice(1).map((p, i) => {
            const a = pos[i]!;
            return <line key={i} x1={a.x + c.charW[i]! / 2} y1={a.y + fs * 0.5} x2={lerp(a.x + c.charW[i]! / 2, p.x + c.charW[i + 1]! / 2, lineDraw)} y2={lerp(a.y + fs * 0.5, p.y + fs * 0.5, lineDraw)} stroke={withAlpha(c.accent, 0.8 * (1 - out))} strokeWidth={Math.max(1, 3 * u)} />;
          })}
          {pos.map((p, i) => (
            <circle key={`d${i}`} cx={p.x + c.charW[i]! / 2} cy={p.y + fs * 0.5} r={10 * u * (1 - arrive[i]! * 0.7)} fill={c.accent} opacity={1 - out} />
          ))}
        </svg>,
      );
      chars.forEach((ch, i) =>
        nodes.push(
          <span key={i} style={charStyle({ left: 0, transform: `translate(${round(pos[i]!.x, 2)}px, ${round(pos[i]!.y, 2)}px) scale(${round(0.4 + 0.6 * clamp(arrive[i]!), 4)})`, opacity: clamp(arrive[i]! * 1.5 - 0.2) * (1 - out) })}>
            {ch}
          </span>,
        ),
      );
      break;
    }
    case 'rise':
    case 'spin': {
      chars.forEach((ch, i) => {
        const sp = springWithIntensity(Math.max(0, lt - i * 0.05), c.preset === 'rise' ? SPRINGS.bouncy : SPRINGS.type, 0.3 + k * 0.7);
        const out = outP(0.35 + i * 0.02, ease.inQuart);
        const transform =
          c.preset === 'rise'
            ? `translateY(${round((1 - sp) * fs * 0.9 - out * fs * 1.1, 2)}px) scale(${round(1 + (1 - Math.min(1, sp)) * 0.2, 4)}, ${round(clamp(sp, 0, 1.3), 4)})`
            : `perspective(${round(fs * 4, 1)}px) rotateX(${round((1 - sp) * -100 + out * 100, 2)}deg)`;
        nodes.push(
          <span key={i} style={charStyle({ left: charX[i], transform, transformOrigin: c.preset === 'rise' ? 'center bottom' : 'center center', opacity: clamp(sp * 2) * (1 - out) })}>
            {ch}
          </span>,
        );
      });
      break;
    }
    case 'shake': {
      const slam = progress(lt, 0, 0.18, ease.inQuart);
      const after = Math.max(0, lt - 0.18);
      const amp = Math.exp(-after * 7) * 26 * u * (0.5 + k * 0.5) * (slam >= 1 ? 1 : 0);
      const out = outP(Math.max(0.2, slot - outStart));
      container = {
        transform: `translate(${round(noise1D(`sh${c.index}`, lt * 30) * amp, 2)}px, ${round(noise1D(`sv${c.index}`, lt * 30) * amp, 2)}px) scale(${round(lerp(2.4, 1, slam) * (1 - out * 0.3), 4)})`,
        opacity: clamp(slam * 3) * (1 - out),
      };
      nodes.push(<span key="w" style={charStyle({ left: 0, position: 'relative' })}>{word}</span>);
      if (slam >= 1 && after < 0.4) {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          const d = (c.totalW * 0.6 + after * 900 * u) * 1;
          extras.push(<div key={`i${i}`} style={{ position: 'absolute', left: c.totalW / 2 + Math.cos(a) * d, top: fs * 0.45 + Math.sin(a) * d * 0.55, width: 40 * u, height: Math.max(1, 4 * u), background: withAlpha(c.accent, 1 - after / 0.4), transform: `rotate(${round((a * 180) / Math.PI, 2)}deg)` }} />);
        }
      }
      break;
    }
  }
  return (
    <>
      <div style={{ position: 'absolute', left: c.x, top: c.y, width: c.totalW, height: fs }}>{extras}</div>
      <div style={{ position: 'absolute', left: c.x, top: c.y, width: c.totalW, height: fs, transformOrigin: 'center center', ...container }}>{nodes}</div>
    </>
  );
};

export const SemanticWordsView = ({ env }: { env: Env }) => {
  useFontsEpoch();
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const props = scene.props;
  const el = scene.elements.words;
  const family = familyOf(env, 'display');
  const font = { family, weight: props.weight, stretch: 'normal' as const };
  const tracking = -0.03;
  const available = Math.max(0.5, env.duration - C.exit);
  const n = props.words.length;
  const slot = available / n;
  const idx = Math.min(n - 1, Math.max(0, Math.floor(t / slot)));
  const lt = t - idx * slot;
  const entry = props.words[idx]!;
  const word = props.uppercase ? entry.text.toLocaleUpperCase() : entry.text;
  const maxW = (P ? L.safe.width : L.width * 0.8) * o.scale;
  const unit = lineUnitWidth(word, font, tracking);
  const fs = Math.min((P ? 230 : 280) * u * o.scale * (0.8 + el.intensity * 0.2), maxW / Math.max(0.1, unit));
  const chars = Array.from(word);
  const charW = chars.map((ch) => lineUnitWidth(ch, font, tracking) * fs);
  const charX = charW.map((_, i) => charW.slice(0, i).reduce((a, b) => a + b, 0));
  const totalW = unit * fs;
  const ax = alignX(L, o.align) + o.offsetX * L.safe.width;
  const x = o.align === 'start' ? ax : o.align === 'end' ? ax - totalW : ax - totalW / 2;
  const y = L.cy - fs * 0.55 + o.offsetY * L.safe.height;
  const accent = env.color(scene.elements.accents.color);
  const exitOut = progress(t, env.duration - C.exit, C.exit, ease.inCubic);

  const caption = useRoleText(env, scene.texts.caption, 'mono', { size: (P ? 26 : 22) * u, maxWidth: L.safe.width * 0.9, lineHeight: 1.3 });

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />
      <div
        data-lms-target={env.target('words')}
        style={{
          position: 'absolute',
          inset: 0,
          fontFamily: `"${family}"`,
          fontWeight: props.weight,
          fontSize: fs,
          lineHeight: 1,
          letterSpacing: `${tracking}em`,
          color: env.color(el.color),
          opacity: el.opacity * (1 - exitOut),
          visibility: el.visible ? 'visible' : 'hidden',
        }}
      >
        {renderWord({
          env,
          word,
          preset: entry.preset,
          lt,
          slot,
          active: slot * props.timing,
          fs,
          charX,
          charW,
          totalW,
          x,
          y,
          color: env.color(el.color),
          accent: scene.elements.accents.visible ? accent : 'transparent',
          k: scene.animation.intensity,
          index: idx,
        })}
      </div>
      <div style={{ position: 'absolute', left: L.safe.left, top: L.safe.top, fontFamily: `"${familyOf(env, 'mono')}"`, fontSize: 20 * u, letterSpacing: '0.2em', color: withAlpha(env.palette.foreground, 0.55 * (1 - exitOut)) }}>
        {String(idx + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
        <div style={{ marginTop: 10 * u, height: Math.max(1, 2 * u), width: 120 * u, background: withAlpha(env.palette.foreground, 0.15) }}>
          <div style={{ height: '100%', width: `${round(clamp((idx + clamp(lt / slot)) / n) * 100, 2)}%`, background: accent }} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: L.safe.left, width: L.safe.width, bottom: L.safe.bottom, textAlign: 'center' }}>
        <MaskedLines text={caption} env={env} color={env.color(scene.texts.caption.color)} align="center" start={C.caption.in + scene.texts.caption.delay} out={exitOut} targetId={env.target('caption')} />
      </div>
    </div>
  );
};

