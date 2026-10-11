import type { ReactNode } from 'react';
import { DirectionalBlur, ProgressRing, SPRINGS, clamp, countValue, ease, formatNumber, lerp, progress, round, springWithIntensity } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, TextBlock, alignX, columnX, familyOf, useRoleText } from '@lms/scene-kit';
import { BRAND_CHOREO, INFO_CHOREO, parseSeries, type BrandRevealScene, type InfoWidget, type InfographicScene } from '../scenes/dataBrand';
import { at } from '../common';
import { ImageOr, Monogram } from './procedural';

/* ------------------------------------------------------------------ */
/* 11 — Animated Infographic                                           */
/* ------------------------------------------------------------------ */

const Widget = ({ env, w, h, widget, start }: { env: SceneRuntime<InfographicScene>; w: number; h: number; widget: InfoWidget; start: number }) => {
  const { t, layout: L, scene } = env;
  const u = L.u;
  const E = scene.elements;
  const chart = env.color(E.charts.color);
  const fg = env.palette.foreground;
  const pad = 30 * u;
  const display = familyOf(env, 'display');
  const mono = familyOf(env, 'mono');
  const cv = countValue(t, start + 0.15, 1.3, 0, widget.value);
  const frac = clamp(widget.value / widget.max);
  const grow = ease.outQuart(progress(t, start + 0.15, 1.3));
  const valueText = `${formatNumber(cv, { decimals: widget.decimals, separator: 'comma' })}${widget.unit}`;
  const sw = Math.max(2, (3 + 2 * E.charts.intensity) * u);
  const innerW = w - pad * 2;
  let chartNode: ReactNode = null;
  if (widget.kind === 'bar') {
    chartNode = (
      <div style={{ marginTop: 22 * u }}>
        <div style={{ height: 16 * u, borderRadius: 99, background: withAlpha(fg, 0.1), overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${round(frac * grow * 100, 3)}%`, borderRadius: 99, background: chart }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 * u, fontFamily: `"${mono}"`, fontSize: 16 * u, color: withAlpha(fg, 0.5) }}>
          <span>0</span>
          <span>
            {formatNumber(widget.max, { decimals: widget.decimals, separator: 'comma' })}
            {widget.unit}
          </span>
        </div>
      </div>
    );
  } else if (widget.kind === 'line') {
    const pts = parseSeries(widget.series);
    const ch = Math.max(60 * u, h - pad * 2 - 150 * u);
    if (pts.length >= 2) {
      const lo = Math.min(...pts);
      const hi = Math.max(...pts);
      const span = hi - lo || 1;
      const xy = pts.map((v, i) => ({ x: (i / (pts.length - 1)) * innerW, y: ch - ((v - lo) / span) * ch * 0.9 - ch * 0.05 }));
      const d = xy.map((p, i) => `${i ? 'L' : 'M'}${round(p.x, 1)} ${round(p.y, 1)}`).join(' ');
      const last = xy[xy.length - 1]!;
      chartNode = (
        <svg width={innerW} height={ch} style={{ display: 'block', marginTop: 18 * u, overflow: 'visible' }}>
          <path d={`${d} L${innerW} ${ch} L0 ${ch} Z`} fill={withAlpha(chart, 0.14 * grow)} />
          <path d={d} fill="none" stroke={chart} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${round(grow, 4)} 1`} />
          {xy.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4 * u} fill={chart} opacity={clamp(grow * pts.length - i)} />
          ))}
          {grow > 0.98 && <circle cx={last.x} cy={last.y} r={(9 + 4 * Math.sin(t * 5)) * u} fill="none" stroke={chart} strokeWidth={Math.max(1, 2 * u)} />}
        </svg>
      );
    } else chartNode = <div style={{ marginTop: 18 * u, fontFamily: `"${mono}"`, fontSize: 16 * u, color: withAlpha(fg, 0.45) }}>Informe a série (ex.: 12, 18, 9)</div>;
  } else if (widget.kind === 'ring') {
    const R = Math.min(innerW, h - pad * 2 - 90 * u) * 0.38;
    chartNode = (
      <svg width={innerW} height={R * 2 + 20 * u} style={{ display: 'block', marginTop: 10 * u, overflow: 'visible' }}>
        <ProgressRing cx={innerW / 2} cy={R + 10 * u} r={R} value={frac * grow} width={sw * 3} color={chart} track={withAlpha(fg, 0.08)} />
        <text x={innerW / 2} y={R + 10 * u + 12 * u} textAnchor="middle" fontFamily={display} fontWeight={800} fontSize={R * 0.42} fill={fg}>
          {Math.round(frac * grow * 100)}%
        </text>
      </svg>
    );
  } else {
    chartNode = <div style={{ marginTop: 22 * u, height: Math.max(2, 4 * u), width: innerW * grow * 0.4, background: chart }} />;
  }
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: 'border-box',
        padding: pad,
        borderRadius: 26 * u,
        background: withAlpha(env.color(E.cards.color), E.cards.opacity),
        border: `${Math.max(1, 1.5 * u)}px solid ${withAlpha(fg, 0.06 + 0.1 * E.cards.intensity)}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ fontFamily: `"${mono}"`, fontSize: 18 * u, letterSpacing: '0.12em', textTransform: 'uppercase', color: withAlpha(fg, 0.6) }}>{widget.label}</div>
      {widget.kind !== 'ring' && (
        <div style={{ fontFamily: `"${display}"`, fontWeight: 800, fontSize: (widget.kind === 'counter' ? 92 : 64) * u, letterSpacing: '-0.03em', color: fg, marginTop: 10 * u, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{valueText}</div>
      )}
      {E.charts.visible && chartNode}
    </div>
  );
};

export const InfographicView = ({ env }: { env: SceneRuntime<InfographicScene> }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const widgets = scene.props.widgets;
  const n = widgets.length;
  const C = INFO_CHOREO;
  const exitStart = env.duration - C.exit;
  const out = progress(t, exitStart, C.exit, ease.inCubic);

  const title = useRoleText(env, scene.texts.title, 'display', { size: (P ? 104 : 92) * u * o.scale, maxWidth: L.safe.width, maxHeight: L.height * 0.18, lineHeight: 1.02 });
  const note = useRoleText(env, scene.texts.note, 'text', { size: (P ? 26 : 22) * u, maxWidth: L.safe.width, lineHeight: 1.3 });
  const gap = 24 * u;
  const cols = P ? (n >= 2 ? 2 : 1) : n;
  const rows = Math.ceil(n / cols);
  const gridTop = L.safe.top + title.layout.height + (P ? 70 : 60) * u;
  const gridBottom = L.height - L.safe.bottom - note.layout.height - 40 * u;
  const cw = (L.safe.width * o.scale - gap * (cols - 1)) / cols;
  const chH = Math.min((P ? 640 : 520) * u, (gridBottom - gridTop - gap * (rows - 1)) / rows);
  const gridH = chH * rows + gap * (rows - 1);
  const gy = gridTop + Math.max(0, (gridBottom - gridTop - gridH) / 2);
  const gridW = cw * cols + gap * (cols - 1);
  const gx = L.cx - gridW / 2 + o.offsetX * L.safe.width;
  const align = o.align;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />
      <Anchor x={alignX(L, align)} y={L.safe.top} align={align} width={L.safe.width}>
        <MaskedLines text={title} env={env} color={env.color(scene.texts.title.color)} align={align} start={at(C.title.in, anim, scene.texts.title.delay)} each={0.1} out={progress(t, exitStart, 0.3, ease.inCubic)} targetId={env.target('title')} />
      </Anchor>
      <div data-lms-target={env.target('cards')} style={{ position: 'absolute', inset: 0 }}>
        {widgets.map((wd, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const lastRow = r === rows - 1 && n % cols !== 0;
          const rowOffset = lastRow ? (cw + gap) * (cols - (n % cols)) * 0.5 : 0;
          const start = at(C.cards.in, anim) + i * (scene.props.entry === 'cascade' ? 0.2 : 0.12);
          const sp = springWithIntensity(Math.max(0, t - start), scene.props.entry === 'pop' ? SPRINGS.bouncy : SPRINGS.type, 0.3 + anim.intensity * 0.6);
          const transform =
            scene.props.entry === 'pop'
              ? `scale(${round(clamp(sp, 0, 1.2), 4)})`
              : scene.props.entry === 'cascade'
                ? `translateY(${round((1 - sp) * -220 * u, 2)}px) rotate(${round((1 - clamp(sp)) * (i % 2 ? 6 : -6), 3)}deg)`
                : `translateY(${round((1 - sp) * 120 * u, 2)}px)`;
          const cardOut = progress(t, exitStart + i * 0.05, 0.35, ease.inCubic);
          return (
            <div key={i} style={{ position: 'absolute', left: gx + rowOffset + c * (cw + gap), top: gy + r * (chH + gap), transform, opacity: clamp(sp * 2) * (1 - cardOut) * (1 - out * 0.5) }}>
              <Widget env={env} w={cw} h={chH} widget={wd} start={at(INFO_CHOREO.charts.in, anim) + i * 0.15} />
            </div>
          );
        })}
      </div>
      <Anchor x={alignX(L, align)} y={L.height - L.safe.bottom - note.layout.height} align={align} width={L.safe.width}>
        <MaskedLines text={note} env={env} color={withAlpha(env.color(scene.texts.note.color), 0.55)} align={align} start={at(C.note.in, anim, scene.texts.note.delay)} out={out} targetId={env.target('note')} />
      </Anchor>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 12 — Personal Brand Reveal                                          */
/* ------------------------------------------------------------------ */

export const BrandRevealView = ({ env }: { env: SceneRuntime<BrandRevealScene> }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const C = BRAND_CHOREO;
  const exitStart = env.duration - C.exit;
  const out = progress(t, exitStart, C.exit, ease.inCubic);
  const k = anim.intensity;

  const size = (P ? 470 : 470) * u * o.scale;
  const cx = (P ? L.cx : L.width * 0.27) + o.offsetX * L.safe.width;
  const cy = (P ? L.height * 0.3 : L.cy) + o.offsetY * L.safe.height;
  const round_ = props.photoShape === 'circle';
  const frameR = size / 2 + 26 * u;
  const lineColor = env.color(E.line.color);
  const lw = Math.max(1.5, (2 + 2 * E.line.intensity) * u);

  // Text column.
  const align = P ? (o.align === 'start' ? 'center' : o.align) : o.align;
  const colLeft = P ? L.safe.left : L.width * 0.47;
  const colW = P ? L.safe.width : L.width * 0.47;
  const ax = P ? alignX(L, align) : columnX(colLeft, colW, align);
  const headline = useRoleText(env, scene.texts.headline, 'mono', { size: (P ? 26 : 22) * u, maxWidth: colW, lineHeight: 1.1 });
  const name = useRoleText(env, scene.texts.name, 'display', { size: (P ? 120 : 118) * u * o.scale, maxWidth: colW, maxHeight: L.height * 0.24, lineHeight: 0.96 });
  const role = useRoleText(env, scene.texts.role, 'text', { size: (P ? 36 : 32) * u, maxWidth: colW * 0.95, lineHeight: 1.3 });
  const hl = props.highlights;
  const hlH = hl.length ? 120 * u : 0;
  const blockH = headline.layout.height + 18 * u + name.layout.height + 18 * u + role.layout.height + (hl.length ? 46 * u + hlH : 0) + 50 * u + 70 * u;
  const ty = P ? cy + frameR + 70 * u : L.cy - blockH / 2;
  const nameY = ty + headline.layout.height + 18 * u;
  const underlineY = nameY + name.layout.height + 8 * u;

  // The line: frame around the photo, then a stroke that underlines the name.
  const lineDraw = progress(t, at(C.line.in, anim), C.line.dur, ease.inOutQuart) * (1 - out);
  const frameD = round_
    ? `M ${cx} ${cy - frameR} A ${frameR} ${frameR} 0 1 1 ${cx - 0.01} ${cy - frameR}`
    : `M ${cx - frameR} ${cy - frameR} H ${cx + frameR} V ${cy + frameR} H ${cx - frameR} Z`;
  const underlineLen = Math.min(colW, Math.max(name.layout.width, 200 * u));
  const ulStart = align === 'start' ? ax : align === 'end' ? ax - underlineLen : ax - underlineLen / 2;
  const underD = `M ${ulStart} ${underlineY} H ${ulStart + underlineLen}`;

  // Photo reveal.
  const reveal = progress(t, at(C.photo.in, anim), C.photo.dur, ease.inOutQuart);
  const photoClip = round_ ? `circle(${round(reveal * 50, 3)}% at 50% 50%)` : `inset(${round((1 - reveal) * 100, 3)}% 0 0 0 round ${round(30 * u, 1)}px)`;
  const pal = { bg: env.palette.background, fg: env.palette.foreground, accent: env.palette.accent, secondary: env.palette.secondary };
  const ring = 0.5 + 0.5 * Math.sin(t * 2);

  // CTA.
  const btnIn = springWithIntensity(Math.max(0, t - at(C.button.in, anim)), SPRINGS.bouncy, 0.4 + k * 0.6);
  const pulse = 1 + Math.max(0, Math.sin((t - at(C.button.in, anim)) * 4)) * 0.035 * E.button.intensity;
  const cta = useRoleText(env, scene.texts.cta, 'text', { size: (P ? 32 : 28) * u, maxWidth: colW * 0.8, lineHeight: 1 });
  const handle = useRoleText(env, scene.texts.handle, 'text', { size: (P ? 30 : 26) * u, maxWidth: colW * 0.6, lineHeight: 1 });
  const handleIn = progress(t, at(C.handle.in, anim, scene.texts.handle.delay), 0.5, ease.cinematic) * (1 - out);
  const display = familyOf(env, 'display');
  const mono = familyOf(env, 'mono');
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);
  const tName = at(C.name.in, anim, scene.texts.name.delay);
  const rowJustify = align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: cx, y: cy }} />
      {E.photo.visible && (
        <div
          data-lms-target={env.target('photo')}
          style={{
            position: 'absolute',
            left: cx - size / 2,
            top: cy - size / 2,
            width: size,
            height: size,
            borderRadius: round_ ? '50%' : 30 * u,
            overflow: 'hidden',
            clipPath: photoClip,
            opacity: E.photo.opacity * (1 - out),
            boxShadow: `0 0 ${round(60 * u * E.photo.intensity * ring, 1)}px ${withAlpha(env.color(E.photo.color), 0.35)}`,
          }}
        >
          <div style={{ width: '100%', height: '100%', transform: `scale(${round(lerp(1.2, 1, ease.cinematic(reveal)), 4)})` }}>
            <ImageOr assetId={props.photoAssetId} fallback={<Monogram size={size} name={scene.texts.name.content} pal={pal} t={t} font={display} />} />
          </div>
        </div>
      )}
      {E.line.visible && (
        <svg data-lms-target={env.target('line')} width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: E.line.opacity }}>
          <path d={frameD} fill="none" stroke={lineColor} strokeWidth={lw} pathLength={1} strokeDasharray={`${round(clamp(lineDraw * 1.25), 4)} 1`} strokeLinecap="round" />
          <circle cx={cx} cy={cy - frameR} r={6 * u * clamp(lineDraw * 4)} fill={lineColor} />
          <path d={underD} fill="none" stroke={lineColor} strokeWidth={lw} pathLength={1} strokeDasharray={`${round(progress(t, tName + 0.4, 0.6, ease.cinematic) * (1 - out), 4)} 1`} strokeLinecap="round" />
        </svg>
      )}

      <Anchor x={ax} y={ty} align={align} width={colW}>
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={align} start={at(C.headline.in, anim, scene.texts.headline.delay)} out={textOut} targetId={env.target('headline')} />
        <div style={{ height: 18 * u }} />
        <TextBlock
          text={name}
          color={env.color(scene.texts.name.color)}
          align={align}
          split="chars"
          targetId={env.target('name')}
          renderUnit={(unit, c) => {
            const s = tName + unit.index * 0.035;
            const sp = springWithIntensity(Math.max(0, t - s), SPRINGS.type, 0.3 + k * 0.6);
            const o2 = progress(t, exitStart + unit.index * 0.01, 0.3, ease.inCubic);
            return (
              <DirectionalBlur as="span" y={(1 - clamp(sp)) * 12 * u} style={{ display: 'inline-block', transform: `translateY(${round((1 - sp) * 0.6 - o2 * 0.4, 4)}em)`, opacity: clamp(sp * 2) * (1 - o2) }}>
                {c}
              </DirectionalBlur>
            );
          }}
        />
        <div style={{ height: 26 * u }} />
        <MaskedLines text={role} env={env} color={withAlpha(env.color(scene.texts.role.color), 0.75)} align={align} start={at(C.role.in, anim, scene.texts.role.delay)} out={textOut} targetId={env.target('role')} />
        {hl.length > 0 && (
          <div style={{ display: 'flex', gap: 50 * u, marginTop: 46 * u, justifyContent: rowJustify, opacity: 1 - textOut }}>
            {hl.map((h, i) => {
              const s = at(C.role.in, anim) + 0.35 + i * 0.15;
              const v = countValue(t, s, 1.2, 0, h.value);
              const inn = progress(t, s - 0.1, 0.4, ease.cinematic);
              return (
                <div key={i} style={{ opacity: inn, transform: `translateY(${round((1 - inn) * 20 * u, 2)}px)`, textAlign: align === 'start' ? 'left' : align === 'end' ? 'right' : 'center' }}>
                  <div style={{ fontFamily: `"${display}"`, fontWeight: 900, fontSize: 64 * u, letterSpacing: '-0.03em', color: env.palette.accent, fontVariantNumeric: 'tabular-nums' }}>
                    {formatNumber(v, { decimals: 0, separator: 'comma' })}
                    {h.suffix}
                  </div>
                  <div style={{ fontFamily: `"${mono}"`, fontSize: 17 * u, letterSpacing: '0.12em', textTransform: 'uppercase', color: withAlpha(env.palette.foreground, 0.6), marginTop: 6 * u }}>{h.label}</div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 * u, marginTop: 50 * u, justifyContent: rowJustify, flexWrap: 'wrap' }}>
          {scene.texts.handle.visible && (
            <div data-lms-target={env.target('handle')} style={{ display: 'flex', alignItems: 'center', gap: 12 * u, opacity: handleIn, transform: `translateX(${round((1 - handleIn) * -20 * u, 2)}px)` }}>
              <svg width={34 * u} height={34 * u} viewBox="0 0 24 24">
                <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke={env.palette.accent} strokeWidth="2" />
                <circle cx="12" cy="12" r="4.4" fill="none" stroke={env.palette.accent} strokeWidth="2" />
                <circle cx="17.4" cy="6.6" r="1.3" fill={env.palette.accent} />
              </svg>
              <TextBlock text={handle} color={env.color(scene.texts.handle.color)} align="start" split="lines" targetId={env.target('handle-text')} renderUnit={(_u, c) => c} />
            </div>
          )}
          {E.button.visible && scene.texts.cta.visible && (
            <div
              data-lms-target={env.target('button')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14 * u,
                padding: `${round(18 * u, 1)}px ${round(30 * u, 1)}px`,
                borderRadius: 99,
                background: env.color(E.button.color),
                opacity: E.button.opacity * clamp(btnIn * 2) * (1 - out),
                transform: `scale(${round(clamp(btnIn, 0, 1.15) * pulse, 4)})`,
              }}
            >
              <TextBlock text={cta} color={env.color(scene.texts.cta.color)} align="start" split="lines" targetId={env.target('cta')} renderUnit={(_u, c) => c} />
              <span style={{ display: 'inline-block', color: env.color(scene.texts.cta.color), fontSize: 30 * u, transform: `translateX(${round(Math.max(0, Math.sin(t * 4)) * 6 * u, 2)}px)` }}>→</span>
            </div>
          )}
        </div>
      </Anchor>
    </div>
  );
};
