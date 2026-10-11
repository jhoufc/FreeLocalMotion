import type { CSSProperties, ReactNode } from 'react';
import { Img } from 'remotion';
import { TAU, clamp, ease, progress, randomRange, round } from '@lms/motion-core';
import { mixHex, withAlpha } from '@lms/shared';
import { useAssets } from '@lms/template-sdk';

/**
 * Procedural stand-ins for user images (app screenshots, product shots, portraits). They
 * are art-directed, animate with the scene clock and take the scene palette, so every
 * scene looks finished before the user uploads anything.
 */

export const APP_SCREENS = ['home', 'stats', 'chat', 'profile', 'checkout'] as const;
export type AppScreenVariant = (typeof APP_SCREENS)[number];

interface Pal {
  bg: string;
  fg: string;
  accent: string;
  secondary: string;
}

const Bar = ({ w, h, c, r = h / 2, style }: { w: number | string; h: number; c: string; r?: number; style?: CSSProperties }) => (
  <div style={{ width: w, height: h, borderRadius: r, background: c, ...style }} />
);

/** One phone screen (portrait UI) drawn with divs/SVG. `t` animates live data. */
export const AppScreen = ({ variant, w, h, pal, t, font }: { variant: AppScreenVariant; w: number; h: number; pal: Pal; t: number; font: string }) => {
  const s = w / 390; // design at 390 px wide
  const pad = 22 * s;
  const card = (extra: CSSProperties = {}): CSSProperties => ({
    borderRadius: 22 * s,
    background: withAlpha(pal.fg, 0.07),
    border: `${Math.max(1, s)}px solid ${withAlpha(pal.fg, 0.08)}`,
    padding: 16 * s,
    boxSizing: 'border-box',
    ...extra,
  });
  const label = (txt: string, extra: CSSProperties = {}) => (
    <div style={{ fontSize: 13 * s, letterSpacing: '0.04em', color: withAlpha(pal.fg, 0.55), fontWeight: 600, ...extra }}>{txt}</div>
  );
  const big = (txt: string, extra: CSSProperties = {}) => <div style={{ fontSize: 34 * s, fontWeight: 800, color: pal.fg, letterSpacing: '-0.02em', ...extra }}>{txt}</div>;
  let body: ReactNode = null;
  if (variant === 'home') {
    body = (
      <>
        {label('Good morning')}
        {big('Your week', { marginBottom: 16 * s })}
        <div style={card({ background: `linear-gradient(135deg, ${pal.accent}, ${mixHex(pal.accent, pal.secondary, 0.6)})`, height: 170 * s, border: 'none' })}>
          {label('Balance', { color: withAlpha('#000000', 0.55) })}
          <div style={{ fontSize: 40 * s, fontWeight: 800, color: '#0B0B0F', marginTop: 6 * s }}>$ {Math.round(12480 + Math.sin(t) * 40).toLocaleString('en-US')}</div>
          <Bar w="60%" h={8 * s} c={withAlpha('#000000', 0.18)} style={{ marginTop: 28 * s }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 * s, marginTop: 14 * s }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={card({ height: 96 * s })}>
              <div style={{ width: 30 * s, height: 30 * s, borderRadius: 10 * s, background: i % 2 ? pal.secondary : withAlpha(pal.accent, 0.85) }} />
              <Bar w="70%" h={8 * s} c={withAlpha(pal.fg, 0.25)} style={{ marginTop: 16 * s }} />
              <Bar w="45%" h={8 * s} c={withAlpha(pal.fg, 0.12)} style={{ marginTop: 8 * s }} />
            </div>
          ))}
        </div>
      </>
    );
  } else if (variant === 'stats') {
    const pts = Array.from({ length: 14 }, (_, i) => 0.35 + 0.4 * Math.sin(i * 0.7 + 1) * 0.6 + randomRange('as-s', i, 0, 0.35));
    const cw = w - pad * 2 - 32 * s;
    const ch = 150 * s;
    const draw = progress(t, 0.3, 1.4, ease.cinematic);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${round((i / 13) * cw, 1)} ${round(ch - p * ch, 1)}`).join(' ');
    body = (
      <>
        {label('Analytics')}
        {big('+38.4%', { color: pal.accent })}
        <div style={card({ marginTop: 14 * s })}>
          <svg width={cw} height={ch} style={{ display: 'block', overflow: 'visible' }}>
            <path d={d} fill="none" stroke={pal.accent} strokeWidth={3 * s} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 10 * s, marginTop: 14 * s }}>
          {[0.72, 0.48, 0.9].map((v, i) => (
            <div key={i} style={card({ flex: 1, height: 120 * s, display: 'flex', alignItems: 'flex-end' })}>
              <div style={{ width: '100%', height: `${round(v * 100 * progress(t, 0.5 + i * 0.12, 0.8, ease.cinematic), 2)}%`, borderRadius: 10 * s, background: i === 2 ? pal.accent : withAlpha(pal.fg, 0.2) }} />
            </div>
          ))}
        </div>
      </>
    );
  } else if (variant === 'chat') {
    body = (
      <>
        {label('Messages')}
        {big('Team', { marginBottom: 16 * s })}
        {[0, 1, 2, 3, 4].map((i) => {
          const mine = i % 2 === 1;
          const show = progress(t, 0.2 + i * 0.35, 0.3, ease.cinematic);
          return (
            <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 12 * s, opacity: show, transform: `translateY(${round((1 - show) * 14 * s, 2)}px)` }}>
              <div style={{ maxWidth: '72%', padding: `${12 * s}px ${16 * s}px`, borderRadius: 20 * s, background: mine ? pal.accent : withAlpha(pal.fg, 0.1) }}>
                <Bar w={randomRange('ac-w', i, 120, 210) * s} h={8 * s} c={mine ? withAlpha('#000000', 0.35) : withAlpha(pal.fg, 0.4)} />
                <Bar w={randomRange('ac-v', i, 60, 140) * s} h={8 * s} c={mine ? withAlpha('#000000', 0.2) : withAlpha(pal.fg, 0.2)} style={{ marginTop: 8 * s }} />
              </div>
            </div>
          );
        })}
      </>
    );
  } else if (variant === 'profile') {
    body = (
      <div style={{ display: 'grid', justifyItems: 'center', gap: 10 * s, paddingTop: 10 * s }}>
        <div style={{ width: 110 * s, height: 110 * s, borderRadius: '50%', background: `conic-gradient(from 200deg, ${pal.accent}, ${pal.secondary}, ${pal.accent})`, padding: 4 * s, boxSizing: 'border-box' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: mixHex(pal.bg, pal.fg, 0.15) }} />
        </div>
        <Bar w={160 * s} h={14 * s} c={withAlpha(pal.fg, 0.7)} />
        <Bar w={110 * s} h={9 * s} c={withAlpha(pal.fg, 0.3)} />
        <div style={{ display: 'flex', gap: 10 * s, width: '100%', marginTop: 10 * s }}>
          {['12K', '480', '96%'].map((v) => (
            <div key={v} style={card({ flex: 1, textAlign: 'center' })}>
              <div style={{ fontSize: 22 * s, fontWeight: 800, color: pal.fg }}>{v}</div>
              <Bar w="60%" h={6 * s} c={withAlpha(pal.fg, 0.2)} style={{ margin: `${8 * s}px auto 0` }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 * s, width: '100%', marginTop: 6 * s }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ aspectRatio: '1', borderRadius: 12 * s, background: `linear-gradient(${i * 50}deg, ${withAlpha(pal.accent, 0.5)}, ${withAlpha(pal.secondary, 0.5)})` }} />
          ))}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {label('Checkout')}
        {big('Order', { marginBottom: 14 * s })}
        {[0, 1, 2].map((i) => (
          <div key={i} style={card({ display: 'flex', alignItems: 'center', gap: 12 * s, marginBottom: 10 * s })}>
            <div style={{ width: 54 * s, height: 54 * s, borderRadius: 14 * s, background: withAlpha(i === 0 ? pal.accent : pal.secondary, 0.7) }} />
            <div style={{ flex: 1 }}>
              <Bar w="70%" h={9 * s} c={withAlpha(pal.fg, 0.55)} />
              <Bar w="40%" h={7 * s} c={withAlpha(pal.fg, 0.25)} style={{ marginTop: 8 * s }} />
            </div>
            <div style={{ fontSize: 16 * s, fontWeight: 700, color: pal.fg }}>${[49, 18, 120][i]}</div>
          </div>
        ))}
        <div
          style={{
            marginTop: 18 * s,
            height: 58 * s,
            borderRadius: 29 * s,
            background: pal.accent,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 17 * s,
            color: '#0B0B0F',
            transform: `scale(${round(1 + 0.04 * Math.max(0, Math.sin(t * 4)), 4)})`,
          }}
        >
          Pay now
        </div>
      </>
    );
  }
  return (
    <div style={{ width: w, height: h, background: `linear-gradient(180deg, ${mixHex(pal.bg, pal.fg, 0.04)}, ${pal.bg})`, padding: `${48 * s}px ${pad}px ${pad}px`, boxSizing: 'border-box', overflow: 'hidden', fontFamily: `"${font}"` }}>
      {body}
    </div>
  );
};

/** Desktop/web dashboard (landscape UI) for feature-highlight scenes. */
export const Dashboard = ({ w, h, pal, t, font }: { w: number; h: number; pal: Pal; t: number; font: string }) => {
  const s = w / 1280;
  const card = (style: CSSProperties): CSSProperties => ({ position: 'absolute', borderRadius: 16 * s, background: withAlpha(pal.fg, 0.06), border: `${Math.max(1, s)}px solid ${withAlpha(pal.fg, 0.08)}`, ...style });
  const bars = Array.from({ length: 16 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i * 0.8 + 0.4)));
  return (
    <div style={{ position: 'relative', width: w, height: h, background: pal.bg, overflow: 'hidden', fontFamily: `"${font}"` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 220 * s, background: withAlpha(pal.fg, 0.035), borderRight: `${Math.max(1, s)}px solid ${withAlpha(pal.fg, 0.08)}` }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Bar key={i} w={(i === 1 ? 150 : 120) * s} h={12 * s} c={i === 1 ? pal.accent : withAlpha(pal.fg, 0.2)} style={{ margin: `${(i ? 26 : 40) * s}px ${28 * s}px 0` }} />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} data-region={`kpi-${i}`} style={card({ left: (250 + i * 330) * s, top: 40 * s, width: 300 * s, height: 150 * s, padding: 22 * s, boxSizing: 'border-box' })}>
          <Bar w={110 * s} h={10 * s} c={withAlpha(pal.fg, 0.3)} />
          <div style={{ fontSize: 46 * s, fontWeight: 800, color: i === 0 ? pal.accent : pal.fg, marginTop: 18 * s }}>{['84.2K', '12.6%', '3.4m'][i]}</div>
        </div>
      ))}
      <div style={card({ left: 250 * s, top: 220 * s, width: 640 * s, height: 420 * s, padding: 28 * s, boxSizing: 'border-box' })}>
        <Bar w={180 * s} h={12 * s} c={withAlpha(pal.fg, 0.35)} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 * s, height: 300 * s, marginTop: 40 * s }}>
          {bars.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${round(v * 100 * progress(t, 0.2 + i * 0.03, 0.8, ease.cinematic), 2)}%`,
                borderRadius: 8 * s,
                background: i === 11 ? pal.accent : withAlpha(pal.secondary, 0.5),
              }}
            />
          ))}
        </div>
      </div>
      <div style={card({ left: 920 * s, top: 220 * s, width: 320 * s, height: 420 * s, padding: 26 * s, boxSizing: 'border-box' })}>
        <svg width={268 * s} height={200 * s}>
          <circle cx={134 * s} cy={100 * s} r={80 * s} fill="none" stroke={withAlpha(pal.fg, 0.1)} strokeWidth={18 * s} />
          <circle cx={134 * s} cy={100 * s} r={80 * s} fill="none" stroke={pal.accent} strokeWidth={18 * s} strokeLinecap="round" pathLength={1} strokeDasharray={`${round(0.72 * progress(t, 0.4, 1.2, ease.cinematic), 4)} 1`} transform={`rotate(-90 ${134 * s} ${100 * s})`} />
        </svg>
        {[0, 1, 2].map((i) => (
          <Bar key={i} w={`${80 - i * 15}%`} h={10 * s} c={withAlpha(pal.fg, 0.2)} style={{ marginTop: 18 * s }} />
        ))}
      </div>
      <div style={card({ left: 250 * s, top: 670 * s, width: 990 * s, height: 70 * s, display: 'flex', alignItems: 'center', gap: 16 * s, padding: `0 ${24 * s}px`, boxSizing: 'border-box' })}>
        <div style={{ padding: `${12 * s}px ${22 * s}px`, borderRadius: 30 * s, background: pal.accent, fontWeight: 800, fontSize: 16 * s, color: '#0B0B0F' }}>Export report</div>
        <Bar w={260 * s} h={10 * s} c={withAlpha(pal.fg, 0.2)} />
      </div>
    </div>
  );
};

/** Stylized product (bottle) with studio lighting, for product scenes without an upload. */
export const ProductArt = ({ w, h, color, accent, t }: { w: number; h: number; color: string; accent: string; t: number }) => {
  const shine = 0.5 + 0.5 * Math.sin(t * 1.2);
  return (
    <svg width={w} height={h} viewBox="0 0 200 420" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="pa-body" x1="0" x2="1">
          <stop offset="0" stopColor={mixHex(color, '#000000', 0.55)} />
          <stop offset="0.28" stopColor={color} />
          <stop offset="0.55" stopColor={mixHex(color, '#FFFFFF', 0.25)} />
          <stop offset="0.8" stopColor={color} />
          <stop offset="1" stopColor={mixHex(color, '#000000', 0.6)} />
        </linearGradient>
        <linearGradient id="pa-cap" x1="0" x2="1">
          <stop offset="0" stopColor="#1A1A1E" />
          <stop offset="0.45" stopColor="#4A4A52" />
          <stop offset="1" stopColor="#141417" />
        </linearGradient>
      </defs>
      <rect x="70" y="0" width="60" height="58" rx="10" fill="url(#pa-cap)" />
      <path d="M62 70 Q62 58 74 58 L126 58 Q138 58 138 70 L138 96 Q178 120 178 170 L178 380 Q178 420 138 420 L62 420 Q22 420 22 380 L22 170 Q22 120 62 96 Z" fill="url(#pa-body)" />
      <rect x="22" y="210" width="156" height="120" fill={withAlpha('#FFFFFF', 0.92)} />
      <rect x="22" y="210" width="156" height="10" fill={accent} />
      <rect x="44" y="246" width="80" height="12" rx="3" fill="#111114" />
      <rect x="44" y="270" width="112" height="7" rx="3" fill={withAlpha('#111114', 0.45)} />
      <rect x="44" y="286" width="90" height="7" rx="3" fill={withAlpha('#111114', 0.3)} />
      <rect x={round(40 + shine * 18, 2)} y="110" width="10" height="290" rx="5" fill={withAlpha('#FFFFFF', 0.35)} />
    </svg>
  );
};

/** Monogram portrait used when no photo is uploaded. */
export const Monogram = ({ size, name, pal, t, font }: { size: number; name: string; pal: Pal; t: number; font: string }) => {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '•';
  const a = t * 20;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from ${round(a, 2)}deg, ${pal.accent}, ${pal.secondary}, ${mixHex(pal.accent, pal.bg, 0.4)}, ${pal.accent})`,
        display: 'grid',
        placeItems: 'center',
        fontFamily: `"${font}"`,
        fontWeight: 900,
        fontSize: size * 0.36,
        letterSpacing: '-0.04em',
        color: pal.bg,
      }}
    >
      {initials}
    </div>
  );
};

/** Uploaded image when present, otherwise the procedural fallback. */
export const ImageOr = ({ assetId, fit = 'cover', fallback, style }: { assetId: string | null; fit?: 'cover' | 'contain'; fallback: ReactNode; style?: CSSProperties }) => {
  const assets = useAssets();
  const url = assets.url(assetId);
  if (!url) return <>{fallback}</>;
  return <Img src={url} style={{ width: '100%', height: '100%', objectFit: fit, display: 'block', ...style }} />;
};

/** Small helper: seeded sparkle burst positions (deterministic). */
export const burst = (n: number, seed: string, t: number, r: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU + randomRange(seed, i, -0.2, 0.2);
    const d = r * clamp(t) * randomRange(`${seed}:d`, i, 0.6, 1.2);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: randomRange(`${seed}:s`, i, 0.4, 1) };
  });
