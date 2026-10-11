import { useMemo, type ReactNode } from 'react';
import { DirectionalBlur, clamp, ease, measureUnitWidth, progress, randomRange, round, smoothstep, useFontsEpoch } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, alignX } from '@lms/scene-kit';
import { NUMBER_CHOREO as C, type NumberImpactScene } from '../scenes/numberImpact';
import { at } from '../common';
import { Anchor, MaskedLines, familyOf, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<NumberImpactScene>;

const countCurve = (p: number) => 1 - (1 - p) ** 4;

export const NumberImpactView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const k = anim.intensity;
  const props = scene.props;
  const el = scene.elements.number;
  const display = familyOf(env, 'display');
  const epoch = useFontsEpoch();
  const exitStart = env.duration - C.exit;

  /* ---------- value over time (pure function of t) ---------- */
  const tCount = at(C.number.in, anim);
  const countDur = props.countDuration / anim.pace;
  const value = (x: number) => props.from + (props.to - props.from) * countCurve(progress(x, tCount, countDur));
  const scale = 10 ** props.decimals;
  const N = Math.abs(value(t)) * scale;
  const dNdt = (Math.abs(value(t + 1 / 240)) - Math.abs(value(t - 1 / 240))) * 120 * scale;
  const speed = clamp(Math.abs(dNdt) / Math.max(1, Math.abs(props.to - props.from) * scale) * countDur * 0.6);
  const maxAbs = Math.max(Math.abs(props.from), Math.abs(props.to)) * scale;
  const D = Math.max(props.decimals + 1, Math.floor(Math.log10(Math.max(1, Math.round(maxAbs)))) + 1);
  const negative = value(t) < 0;

  /* ---------- typography ---------- */
  const digitW = useMemo(() => Math.max(...'0123456789'.split('').map((d) => measureUnitWidth(d, { family: display, weight: 900, stretch: 'normal' }))), [display, epoch]);
  const sepChar = props.separator === 'comma' ? ',' : props.separator === 'dot' ? '.' : props.separator === 'space' ? ' ' : '';
  const markChar = props.separator === 'dot' ? ',' : '.';
  const groups = Math.floor((D - props.decimals - 1) / 3);
  const units = D * digitW + (sepChar ? groups * 0.32 : 0) + (props.decimals ? 0.32 : 0) + (props.prefix.length + props.suffix.length) * digitW * 0.62 + (negative ? 0.5 : 0);
  const maxW = (P ? L.safe.width : L.width * 0.78) * o.scale;
  const fs = Math.min((P ? 300 : 330) * u * o.scale, maxW / Math.max(1, units));
  const w = digitW * fs;

  /* ---------- placement ---------- */
  const ax = alignX(L, o.align) + o.offsetX * L.safe.width;
  const cy = (P ? L.height * 0.46 : L.cy) + o.offsetY * L.safe.height;
  const numTop = cy - fs * 0.55;
  const kicker = useRoleText(env, scene.texts.kicker, 'mono', { size: (P ? 28 : 24) * u * o.scale, maxWidth: maxW, lineHeight: 1.1 });
  const caption = useRoleText(env, scene.texts.caption, 'text', { size: (P ? 38 : 34) * u * o.scale, maxWidth: (P ? L.safe.width * 0.9 : L.width * 0.45) * o.scale, lineHeight: 1.3 });

  /* ---------- end-of-count pulse ---------- */
  const tEnd = tCount + countDur;
  const q = progress(t, tEnd - 0.05, 0.5);
  const pulse = q > 0 && q < 1 ? Math.sin(Math.PI * q) * (1 - q) : 0;
  const bump = 1 + pulse * 0.12 * k * el.intensity;
  const out = progress(t, exitStart, 0.45, ease.inCubic);

  /* ---------- odometer columns ---------- */
  const columns: ReactNode[] = [];
  const pushSep = (key: string, ch: string, presence: number) =>
    columns.push(
      <span key={key} style={{ display: 'inline-block', width: 0.32 * fs * presence, textAlign: 'center', opacity: presence, overflow: 'visible' }}>
        {ch}
      </span>,
    );
  if (negative) columns.push(<span key="neg" style={{ display: 'inline-block', width: 0.5 * fs }}>−</span>);
  if (props.prefix) columns.push(<span key="pre" style={{ fontSize: '0.5em', verticalAlign: '0.85em', marginRight: '0.08em', color: env.palette.accent }}>{props.prefix}</span>);
  for (let p = D - 1; p >= 0; p--) {
    const unit = 10 ** p;
    const leading = p > props.decimals;
    const presence = leading ? smoothstep(unit * 0.9, unit, N) : 1;
    if (presence <= 0.001) continue;
    // Real odometer: a column only rolls while every lower digit is carrying over (…9 → …0).
    const rem = N % unit;
    const carry = p === 0 ? rem : Math.max(0, rem - (unit - 1));
    const pos = (Math.floor(N / unit) % 10) + carry;
    const vel = Math.abs(dNdt) / unit;
    const blur = Math.min(40 * u, vel * fs * 0.0045);
    const colOut = progress(t, exitStart + (D - 1 - p) * 0.03, 0.3, ease.inExpo);
    columns.push(
      <span
        key={`d${p}`}
        style={{
          display: 'inline-block',
          width: w * presence,
          height: '1em',
          overflow: 'hidden',
          verticalAlign: 'top',
          opacity: presence * (1 - colOut),
          clipPath: `inset(0 0 ${round(colOut * 100, 2)}% 0)`,
        }}
      >
        <DirectionalBlur as="span" y={blur} style={{ display: 'block', transform: `translateY(${round(-pos, 4)}em)` }}>
          {'01234567890'.split('').map((d, i) => (
            <span key={i} style={{ display: 'block', height: '1em', width: w, textAlign: 'center' }}>
              {d}
            </span>
          ))}
        </DirectionalBlur>
      </span>,
    );
    if (props.decimals > 0 && p === props.decimals) pushSep('mark', markChar, 1);
    else if (sepChar && leading && (p - props.decimals) % 3 === 0) pushSep(`s${p}`, sepChar, presence);
  }
  if (props.suffix) columns.push(<span key="suf" style={{ color: env.palette.accent, marginLeft: '0.04em' }}>{props.suffix}</span>);

  const numberIn = progress(t, tCount - 0.15, 0.4, ease.cinematic);
  const countP = countCurve(progress(t, tCount, countDur));

  /* ---------- speed lines ---------- */
  const lines = scene.elements.lines;
  const streaks: ReactNode[] = [];
  if (lines.visible && speed > 0.01) {
    const n = Math.round(6 + lines.intensity * 8);
    for (let i = 0; i < n; i++) {
      const y = numTop + randomRange('ni-y', i, 0.05, 1.05) * fs;
      const len = (200 + randomRange('ni-l', i, 0, 700)) * u * speed;
      const x = ((randomRange('ni-x', i, 0, 1) - t * randomRange('ni-v', i, 1.2, 3)) % 1 + 1) % 1;
      streaks.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x * L.width * 1.3 - L.width * 0.15,
            top: y,
            width: len,
            height: Math.max(1, randomRange('ni-h', i, 1.5, 4) * u),
            background: `linear-gradient(90deg, transparent, ${withAlpha(env.color(lines.color), lines.opacity * speed)})`,
          }}
        />,
      );
    }
  }

  /* ---------- markers: ruler + brackets ---------- */
  const markers = scene.elements.markers;
  const mIn = progress(t, at(C.markers.in, anim), C.markers.dur, ease.cinematic) * (1 - out);
  const numW = Math.min(maxW, units * fs);
  const left = o.align === 'start' ? ax : o.align === 'end' ? ax - numW : ax - numW / 2;
  const rulerY = numTop + fs * 1.12;
  const mColor = env.color(markers.color);
  const ticks = Math.round(20 + markers.intensity * 20);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: left + numW / 2, y: cy }} />
      <div data-lms-target={env.target('lines')} style={{ position: 'absolute', inset: 0 }}>
        {streaks}
      </div>
      {pulse > 0 && el.visible && (
        <div
          style={{
            position: 'absolute',
            left: left + numW / 2 - fs * (0.6 + q * 2.2),
            top: cy - fs * (0.6 + q * 2.2),
            width: fs * (1.2 + q * 4.4),
            height: fs * (1.2 + q * 4.4),
            borderRadius: '50%',
            border: `${Math.max(1, 3 * u)}px solid ${withAlpha(env.palette.accent, (1 - q) * 0.8)}`,
          }}
        />
      )}
      {markers.visible && (
        <div data-lms-target={env.target('markers')} style={{ position: 'absolute', inset: 0, opacity: markers.opacity * mIn }}>
          <div style={{ position: 'absolute', left, top: rulerY, width: numW * mIn, height: Math.max(1, 1.5 * u), background: withAlpha(mColor, 0.5) }} />
          <div style={{ position: 'absolute', left, top: rulerY - Math.max(1, 1.5 * u), width: numW * countP, height: Math.max(2, 4 * u), background: env.palette.accent }} />
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: left + (numW * i) / ticks,
                top: rulerY + 6 * u,
                width: Math.max(1, 1.5 * u),
                height: (i % 5 === 0 ? 16 : 8) * u * clamp(mIn * 2 - i / ticks),
                background: withAlpha(mColor, i / ticks <= countP ? 0.9 : 0.35),
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              left: left + numW - 160 * u,
              width: 160 * u,
              top: rulerY + 30 * u,
              textAlign: 'right',
              fontFamily: `"${familyOf(env, 'mono')}"`,
              fontSize: 18 * u,
              letterSpacing: '0.14em',
              color: withAlpha(mColor, 0.9),
            }}
          >
            {String(Math.round(countP * 100)).padStart(3, '0')}%
          </div>
          {P && (
            <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={L.width} height={L.height}>
              {(() => {
                const R = L.width * 0.4;
                const cx = left + numW / 2;
                const ccy = cy - fs * 0.05;
                const circ = 2 * Math.PI * R;
                const n = 72;
                return (
                  <g>
                    <circle cx={cx} cy={ccy} r={R} fill="none" stroke={withAlpha(mColor, 0.25)} strokeWidth={Math.max(1, 1.5 * u)} strokeDasharray={`${circ * mIn} ${circ}`} transform={`rotate(-90 ${cx} ${ccy})`} />
                    <circle
                      cx={cx}
                      cy={ccy}
                      r={R}
                      fill="none"
                      stroke={env.palette.accent}
                      strokeWidth={Math.max(2, 5 * u)}
                      strokeLinecap="round"
                      strokeDasharray={`${circ * countP} ${circ}`}
                      transform={`rotate(-90 ${cx} ${ccy})`}
                    />
                    {Array.from({ length: n }, (_, i) => {
                      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
                      const r0 = R + 18 * u;
                      const r1 = r0 + (i % 6 === 0 ? 26 : 12) * u;
                      const on = i / n <= countP;
                      return (
                        <line
                          key={i}
                          x1={cx + Math.cos(a) * r0}
                          y1={ccy + Math.sin(a) * r0}
                          x2={cx + Math.cos(a) * r1}
                          y2={ccy + Math.sin(a) * r1}
                          stroke={withAlpha(on ? env.palette.accent : mColor, on ? 0.9 : 0.3)}
                          strokeWidth={Math.max(1, 2 * u)}
                          opacity={clamp(mIn * 2 - i / n)}
                        />
                      );
                    })}
                  </g>
                );
              })()}
            </svg>
          )}
          {[0, 1, 2, 3].map((c) => {
            const bx = c % 2 === 0 ? left - 40 * u : left + numW + 40 * u;
            const by = c < 2 ? numTop - 50 * u : rulerY + 70 * u;
            const s = 28 * u;
            return (
              <div
                key={c}
                style={{
                  position: 'absolute',
                  left: c % 2 === 0 ? bx : bx - s,
                  top: c < 2 ? by : by - s,
                  width: s,
                  height: s,
                  borderLeft: c % 2 === 0 ? `${Math.max(1, 2 * u)}px solid ${mColor}` : undefined,
                  borderRight: c % 2 === 1 ? `${Math.max(1, 2 * u)}px solid ${mColor}` : undefined,
                  borderTop: c < 2 ? `${Math.max(1, 2 * u)}px solid ${mColor}` : undefined,
                  borderBottom: c >= 2 ? `${Math.max(1, 2 * u)}px solid ${mColor}` : undefined,
                }}
              />
            );
          })}
        </div>
      )}

      <Anchor x={ax} y={numTop - (P ? 110 : 92) * u} align={o.align} width={numW + 200 * u}>
        <MaskedLines text={kicker} env={env} color={env.color(scene.texts.kicker.color)} align={o.align} start={at(C.kicker.in, anim, scene.texts.kicker.delay)} out={out} targetId={env.target('kicker')} />
      </Anchor>

      {el.visible && (
        <div
          data-lms-target={env.target('number')}
          style={{
            position: 'absolute',
            left,
            top: numTop,
            width: numW,
            whiteSpace: 'nowrap',
            fontFamily: `"${display}"`,
            fontWeight: 900,
            fontSize: fs,
            lineHeight: 1,
            letterSpacing: 0,
            color: env.color(el.color),
            opacity: el.opacity * numberIn * (1 - progress(t, exitStart + 0.05, 0.3, ease.outCubic)),
            textAlign: o.align === 'start' ? 'left' : o.align === 'end' ? 'right' : 'center',
            transform: `translateY(${round((1 - numberIn) * 60 * u, 2)}px) scale(${round(bump, 4)})`,
            transformOrigin: 'center',
          }}
        >
          {columns}
        </div>
      )}

      <Anchor x={ax} y={rulerY + (P ? 120 : 96) * u} align={o.align} width={Math.max(numW, caption.layout.width)}>
        <MaskedLines text={caption} env={env} color={withAlpha(env.color(scene.texts.caption.color), 0.8)} align={o.align} start={at(C.caption.in, anim, scene.texts.caption.delay)} out={out} targetId={env.target('caption')} />
      </Anchor>
    </div>
  );
};
