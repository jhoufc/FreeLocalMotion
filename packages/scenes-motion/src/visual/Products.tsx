import type { ReactNode } from 'react';
import { DirectionalBlur, EchoTrail, SPRINGS, TAU, arcPath, clamp, ease, lerp, lineUnitWidth, progress, randomRange, round, springWithIntensity } from '@lms/motion-core';
import { mixHex, withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, alignX, columnX, familyOf, useRoleText } from '@lms/scene-kit';
import { CALLOUT_CHOREO, HERO_CHOREO, IMPACT_CHOREO, type ProductCalloutsScene, type ProductHeroScene, type ProductImpactScene } from '../scenes/products';
import { at } from '../common';
import { ImageOr, ProductArt } from './procedural';

const ProductImage = ({ assetId, w, h, color, accent, t }: { assetId: string | null; w: number; h: number; color: string; accent: string; t: number }) => (
  <div style={{ width: w, height: h }}>
    <ImageOr assetId={assetId} fit="contain" fallback={<ProductArt w={w} h={h} color={color} accent={accent} t={t} />} />
  </div>
);

/* ------------------------------------------------------------------ */
/* 08 — Product Hero 2.5D                                              */
/* ------------------------------------------------------------------ */

export const ProductHeroView = ({ env }: { env: SceneRuntime<ProductHeroScene> }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const C = HERO_CHOREO;
  const exitStart = env.duration - C.exit;
  const k = anim.intensity;

  const ph = (P ? 820 : 760) * u * props.scale;
  const pw = ph * 0.48;
  const px = (P ? L.cx : L.width * 0.66) + props.positionX * L.width;
  const py = (P ? L.height * 0.42 : L.cy + 10 * u) + props.positionY * L.height;

  const tIn = at(C.product.in, anim);
  const rise = springWithIntensity(Math.max(0, t - tIn), SPRINGS.heavy, 0.3 + k * 0.5);
  const out = progress(t, exitStart, C.exit, ease.inCubic);
  const life = Math.max(0, t - tIn);
  const float = Math.sin(life * 1.3) * 14 * u * E.product.intensity;

  // Views: the main image plus optional real angles. The "turn" crossfades photographs.
  const views = [props.assetId, ...props.angles.map((a) => a.assetId).filter((a): a is string => Boolean(a))];
  const turnSpan = Math.max(0.8, (exitStart - tIn - 1.2) / Math.max(1, views.length));
  const vi = views.length > 1 ? Math.min(views.length - 1, Math.floor(Math.max(0, life - 1) / turnSpan)) : 0;
  const turn = views.length > 1 && vi < views.length - 1 ? progress(life - 1, (vi + 1) * turnSpan - 0.35, 0.35, ease.inOutQuart) : 0;
  const rotY = Math.sin(life * 0.6) * 10 * k + (1 - rise) * -25 + turn * 80;
  const pColor = env.color(E.product.color);

  const light = env.color(E.light.color);
  const lightIn = progress(t, at(C.light.in, anim), C.light.dur, ease.cinematic) * (1 - out);
  const linesIn = progress(t, at(C.lines.in, anim), C.lines.dur, ease.cinematic) * (1 - out);
  const sweep = progress(t, tIn + 1.1, 1.1, ease.inOutQuart);
  const ticks = Math.round(8 + E.lines.intensity * 8);

  const productNode = (assetId: string | null) => <ProductImage assetId={assetId} w={pw} h={ph} color={pColor} accent={env.palette.accent} t={life} />;

  const kicker = useRoleText(env, scene.texts.kicker, 'mono', { size: (P ? 26 : 22) * u, maxWidth: L.safe.width, lineHeight: 1.1 });
  const name = useRoleText(env, scene.texts.name, 'display', { size: (P ? 120 : 112) * u * o.scale, maxWidth: (P ? L.safe.width : L.width * 0.42) * o.scale, maxHeight: L.height * 0.3, lineHeight: 0.98 });
  const desc = useRoleText(env, scene.texts.description, 'text', { size: (P ? 36 : 32) * u * o.scale, maxWidth: (P ? L.safe.width * 0.9 : L.width * 0.36) * o.scale, lineHeight: 1.35 });
  const align = o.align;
  const colW = P ? L.safe.width : L.width * 0.42;
  const ax = (P ? alignX(L, align) : columnX(L.safe.left, colW, align)) + o.offsetX * L.safe.width;
  const blockH = kicker.layout.height + 22 * u + name.layout.height + 26 * u + desc.layout.height;
  const ty = (P ? L.height * 0.765 - blockH / 2 : L.cy - blockH / 2) + o.offsetY * L.safe.height;
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: px, y: py }} />
      {E.light.visible && (
        <>
          <div
            data-lms-target={env.target('light')}
            style={{
              position: 'absolute',
              left: px - ph * 0.9,
              top: py - ph * 0.9,
              width: ph * 1.8,
              height: ph * 1.8,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${withAlpha(light, 0.42 * E.light.opacity * E.light.intensity)} 0%, ${withAlpha(light, 0.1)} 40%, transparent 68%)`,
              opacity: lightIn,
            }}
          />
          {/* turntable floor */}
          <div
            style={{
              position: 'absolute',
              left: px - pw * 1.6,
              top: py + ph * 0.44,
              width: pw * 3.2,
              height: pw * 0.7,
              borderRadius: '50%',
              background: `radial-gradient(ellipse at 50% 40%, ${withAlpha(mixHex(light, '#FFFFFF', 0.3), 0.25 * lightIn)}, transparent 70%)`,
              border: `${Math.max(1, u)}px solid ${withAlpha(env.palette.foreground, 0.12 * lightIn)}`,
            }}
          />
        </>
      )}
      {/* contact shadow */}
      <div
        style={{
          position: 'absolute',
          left: px - pw * 0.55,
          top: py + ph * 0.48,
          width: pw * 1.1,
          height: pw * 0.16,
          borderRadius: '50%',
          background: withAlpha('#000000', 0.55 * props.shadow * clamp(rise) * (1 - out)),
          filter: `blur(${round(14 * u, 2)}px)`,
          transform: `scale(${round(1 - float / (220 * u), 4)})`,
        }}
      />
      {E.lines.visible && (
        <svg data-lms-target={env.target('lines')} width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: E.lines.opacity }}>
          {[0, 1].map((i) => {
            const r = ph * (0.62 + i * 0.1);
            const a0 = -Math.PI * (0.85 - i * 0.1) + life * 0.08 * (i ? -1 : 1);
            return <path key={i} d={arcPath(px, py, r, a0, a0 + Math.PI * 0.55 * linesIn)} fill="none" stroke={i ? light : env.color(E.lines.color)} strokeWidth={Math.max(1, (1.5 + E.lines.intensity) * u)} strokeLinecap="round" />;
          })}
          {Array.from({ length: ticks }, (_, i) => {
            const a = Math.PI * 0.15 + (i / ticks) * Math.PI * 0.5;
            const r = ph * 0.62;
            return <line key={i} x1={px + Math.cos(a) * r} y1={py + Math.sin(a) * r} x2={px + Math.cos(a) * (r + (i % 4 ? 10 : 22) * u)} y2={py + Math.sin(a) * (r + (i % 4 ? 10 : 22) * u)} stroke={env.color(E.lines.color)} strokeWidth={Math.max(1, u)} opacity={clamp(linesIn * 2 - i / ticks)} />;
          })}
        </svg>
      )}
      {E.product.visible && (
        <div
          data-lms-target={env.target('product')}
          style={{
            position: 'absolute',
            left: px - pw / 2,
            top: py - ph / 2,
            width: pw,
            height: ph,
            opacity: E.product.opacity * clamp(rise * 2) * (1 - out),
            transform: `perspective(${round(1800 * u, 1)}px) translateY(${round((1 - rise) * 300 * u + float + out * 80 * u, 2)}px) rotateY(${round(rotY, 3)}deg) scale(${round(0.86 + 0.14 * clamp(rise, 0, 1.1), 4)})`,
            filter: `drop-shadow(0 ${round(30 * u, 1)}px ${round(40 * u, 1)}px ${withAlpha('#000000', 0.4 * props.shadow)}) drop-shadow(0 0 ${round(2 * u, 1)}px ${withAlpha(light, 0.6 * lightIn)})`,
          }}
        >
          {views.length > 1 ? (
            <>
              <div style={{ position: 'absolute', inset: 0, opacity: 1 - turn }}>{productNode(views[vi]!)}</div>
              {turn > 0 && <div style={{ position: 'absolute', inset: 0, opacity: turn, transform: `rotateY(${round(-80 * (1 - turn), 3)}deg)` }}>{productNode(views[vi + 1]!)}</div>}
            </>
          ) : (
            productNode(views[0] ?? null)
          )}
          {/* specular sweep, masked to the product box */}
          {sweep > 0 && sweep < 1 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(110deg, transparent ${round(sweep * 140 - 40, 2)}%, ${withAlpha('#FFFFFF', 0.35 * E.light.intensity)} ${round(sweep * 140 - 25, 2)}%, transparent ${round(sweep * 140 - 10, 2)}%)`,
                mixBlendMode: 'overlay',
              }}
            />
          )}
        </div>
      )}

      <Anchor x={ax} y={ty} align={align} width={colW}>
        <MaskedLines text={kicker} env={env} color={env.color(scene.texts.kicker.color)} align={align} start={at(C.kicker.in, anim, scene.texts.kicker.delay)} out={textOut} targetId={env.target('kicker')} />
        <div style={{ height: 22 * u }} />
        <MaskedLines text={name} env={env} color={env.color(scene.texts.name.color)} align={align} start={at(C.name.in, anim, scene.texts.name.delay)} each={0.1} out={textOut} targetId={env.target('name')} />
        <div style={{ height: 26 * u }} />
        <MaskedLines text={desc} env={env} color={withAlpha(env.color(scene.texts.description.color), 0.75)} align={align} start={at(C.description.in, anim, scene.texts.description.delay)} out={textOut} targetId={env.target('description')} />
      </Anchor>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 09 — Product Detail Callout                                         */
/* ------------------------------------------------------------------ */

export const ProductCalloutsView = ({ env }: { env: SceneRuntime<ProductCalloutsScene> }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const C = CALLOUT_CHOREO;
  const exitStart = env.duration - C.exit;

  const ph = (P ? 900 : 780) * u * o.scale;
  const pw = ph * 0.48;
  const px = L.cx + o.offsetX * L.safe.width;
  const py = (P ? L.height * 0.53 : L.cy + 40 * u) + o.offsetY * L.safe.height;
  const tIn = at(C.product.in, anim);
  const pop = springWithIntensity(Math.max(0, t - tIn), SPRINGS.heavy, 0.3 + anim.intensity * 0.5);
  const out = progress(t, exitStart, C.exit, ease.inCubic);
  const float = Math.sin(t * 1.2) * 10 * u * E.product.intensity;

  // Labels: one column per side, distributed evenly in the available height.
  const sides = props.benefits.map((b, i) => ({ ...b, i, side: b.anchorX < 0 ? 'left' : 'right' }));
  const colGap = (P ? 70 : 140) * u;
  const labelW = (P ? (L.safe.width - pw) / 2 - 40 * u : 420 * u);
  const fsLabel = (P ? 34 : 30) * u;
  const fsDetail = (P ? 25 : 22) * u;
  const lineColor = env.color(E.lines.color);
  const markColor = env.color(E.markers.color);
  const display = familyOf(env, 'display');
  const textFam = familyOf(env, 'text');

  const items = sides.map((b) => {
    const group = sides.filter((s) => s.side === b.side);
    const j = group.indexOf(b);
    const top = py - ph * 0.42;
    const span = ph * 0.84;
    const ly = group.length === 1 ? py : top + (span * (j + 0.5)) / group.length;
    const mx = px + b.anchorX * pw;
    const my = py + b.anchorY * ph + float;
    const lx = b.side === 'left' ? px - pw / 2 - colGap : px + pw / 2 + colGap;
    const s = at(C.markers.in, anim) + b.i * props.stagger;
    const markIn = springWithIntensity(Math.max(0, t - s), SPRINGS.bouncy, 0.5 + anim.intensity * 0.5);
    const lineIn = progress(t, s + 0.15, 0.45, ease.cinematic) * (1 - out);
    const labelIn = progress(t, s + 0.4, 0.5, ease.cinematic) * (1 - out);
    const elbowX = b.side === 'left' ? lx + 20 * u : lx - 20 * u;
    const pts =
      props.lineStyle === 'elbow'
        ? [
            { x: mx, y: my },
            { x: lerp(mx, elbowX, 0.55), y: ly },
            { x: elbowX, y: ly },
          ]
        : [
            { x: mx, y: my },
            { x: elbowX, y: ly },
          ];
    return { b, mx, my, lx, ly, markIn, lineIn, labelIn, pts };
  });

  const headline = useRoleText(env, scene.texts.headline, 'display', { size: (P ? 92 : 84) * u * o.scale, maxWidth: L.safe.width, lineHeight: 1.02 });
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: px, y: py }} />
      <Anchor x={L.cx} y={L.safe.top + (P ? 10 : 0) * u} align="center" width={L.safe.width}>
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align="center" start={at(C.headline.in, anim, scene.texts.headline.delay)} each={0.1} out={textOut} targetId={env.target('headline')} />
      </Anchor>
      <div style={{ position: 'absolute', left: px - pw * 0.6, top: py + ph * 0.47, width: pw * 1.2, height: pw * 0.14, borderRadius: '50%', background: withAlpha('#000000', 0.3 * clamp(pop) * (1 - out)), filter: `blur(${round(12 * u, 2)}px)` }} />
      {E.product.visible && (
        <div
          data-lms-target={env.target('product')}
          style={{
            position: 'absolute',
            left: px - pw / 2,
            top: py - ph / 2,
            opacity: E.product.opacity * clamp(pop * 2) * (1 - out),
            transform: `translateY(${round((1 - pop) * 200 * u + float, 2)}px) scale(${round(0.9 + 0.1 * clamp(pop, 0, 1.1), 4)})`,
            filter: `drop-shadow(0 ${round(24 * u, 1)}px ${round(30 * u, 1)}px rgba(0,0,0,0.25))`,
          }}
        >
          <ProductImage assetId={props.assetId} w={pw} h={ph} color={env.color(E.product.color)} accent={env.palette.accent} t={t} />
        </div>
      )}
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {E.lines.visible && (
          <g data-lms-target={env.target('lines')} opacity={E.lines.opacity}>
            {items.map(({ b, pts, lineIn }) => (
              <path
                key={b.i}
                d={pts.map((p, i) => `${i ? 'L' : 'M'}${round(p.x, 1)} ${round(p.y, 1)}`).join(' ')}
                fill="none"
                stroke={lineColor}
                strokeWidth={Math.max(1, (1.2 + E.lines.intensity) * u)}
                pathLength={1}
                strokeDasharray={props.lineStyle === 'dotted' ? `${round(0.012, 4)} ${round(0.02, 4)}` : `${round(lineIn, 4)} 1`}
                opacity={props.lineStyle === 'dotted' ? lineIn : 1}
              />
            ))}
          </g>
        )}
        {E.markers.visible && (
          <g data-lms-target={env.target('markers')} opacity={E.markers.opacity * (1 - out)}>
            {items.map(({ b, mx, my, markIn }) => {
              const ph2 = ((t * 1.1 + b.i * 0.3) % 1 + 1) % 1;
              return (
                <g key={b.i}>
                  <circle cx={mx} cy={my} r={(10 + 26 * ph2) * u * clamp(markIn)} fill="none" stroke={markColor} strokeWidth={Math.max(1, 2 * u)} opacity={(1 - ph2) * E.markers.intensity} />
                  <circle cx={mx} cy={my} r={9 * u * clamp(markIn, 0, 1.4)} fill={markColor} />
                  <circle cx={mx} cy={my} r={3.5 * u * clamp(markIn)} fill="#FFFFFF" />
                </g>
              );
            })}
          </g>
        )}
      </svg>
      {items.map(({ b, lx, ly, labelIn }) => (
        <div
          key={b.i}
          style={{
            position: 'absolute',
            left: b.side === 'left' ? lx - labelW : lx,
            width: labelW,
            top: ly - fsLabel * 0.9,
            textAlign: b.side === 'left' ? 'right' : 'left',
            opacity: labelIn,
            transform: `translateX(${round((1 - labelIn) * (b.side === 'left' ? 30 : -30) * u, 2)}px)`,
          }}
        >
          <div style={{ fontFamily: `"${display}"`, fontWeight: 800, fontSize: fsLabel, color: env.palette.foreground, lineHeight: 1.1 }}>{b.label}</div>
          <div style={{ fontFamily: `"${textFam}"`, fontSize: fsDetail, color: withAlpha(env.palette.foreground, 0.65), marginTop: 6 * u }}>{b.detail}</div>
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 10 — Product Color Impact                                           */
/* ------------------------------------------------------------------ */

export const ProductImpactView = ({ env }: { env: SceneRuntime<ProductImpactScene> }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const C = IMPACT_CHOREO;
  const exitStart = env.duration - C.exit;
  const k = anim.intensity;
  const A = props.colorA;
  const B = props.colorB;

  // Three fast beats (one per impact word), then the product reveal.
  const beat = 0.42 / anim.pace;
  const tReveal = at(C.product.in, anim);
  const bi = t < tReveal ? Math.min(2, Math.floor(t / beat)) : -1;
  const lt = bi >= 0 ? t - bi * beat : 0;
  const bgA = bi % 2 === 0 ? A : B;
  const bgB = bi % 2 === 0 ? B : A;
  const x1 = round(60 + Math.sin(bi * 2) * 10, 2);
  const x2 = round(30 + Math.sin(bi * 2) * 10, 2);
  const split = `polygon(${x1}% 0, 100% 0, 100% 100%, ${x2}% 100%)`;
  const inverse = `polygon(0 0, ${x1}% 0, ${x2}% 100%, 0 100%)`;

  const display = familyOf(env, 'display');
  const word = bi >= 0 ? props.words[bi]!.text.toLocaleUpperCase() : '';
  const wordFs = word ? Math.min((P ? 300 : 360) * u, (L.width * 0.86) / Math.max(0.5, lineUnitWidth(word, { family: display, weight: 900, stretch: 'expanded' }, -0.04))) : 0;
  const wordX = (tt: number) => lerp((bi % 2 ? 1 : -1) * L.width * 0.6, 0, ease.outExpo(progress(tt, 0, 0.16))) + (tt - 0.16) * (bi % 2 ? -60 : 60) * u;
  const vel = (wordX(lt + 1 / 120) - wordX(lt - 1 / 120)) * 60;

  const reveal = progress(t, tReveal - 0.1, 0.5, ease.outExpo);
  const pop = springWithIntensity(Math.max(0, t - tReveal), SPRINGS.bouncy, 0.4 + k * 0.6);
  const out = progress(t, exitStart, C.exit, ease.inCubic);
  const ph = (P ? 780 : 760) * u * o.scale;
  const pw = ph * 0.48;
  const px = (P ? L.cx : L.width * 0.62) + o.offsetX * L.safe.width;
  const py = (P ? L.height * 0.37 : L.cy) + o.offsetY * L.safe.height;
  const pulse = 1 + Math.max(0, Math.sin((t - tReveal) * 6)) * 0.02 * E.product.intensity;

  const headline = useRoleText(env, scene.texts.headline, 'display', { size: (P ? 120 : 120) * u * o.scale, maxWidth: (P ? L.safe.width : L.width * 0.3) * o.scale, maxHeight: (P ? L.height * 0.2 : L.height * 0.5), lineHeight: 0.88 });
  const sub = useRoleText(env, scene.texts.sub, 'mono', { size: (P ? 28 : 22) * u, maxWidth: (P ? L.safe.width : L.width * 0.28), lineHeight: 1.3 });
  const textOut = progress(t, exitStart, 0.3, ease.inCubic);

  const shapes: ReactNode[] = [];
  if (E.shapes.visible) {
    const n = Math.round(4 + E.shapes.intensity * 5);
    const sc = env.color(E.shapes.color);
    if (bi >= 0) {
      for (let i = 0; i < n; i++) {
        const a = randomRange(`pi-a${bi}`, i, 0, TAU);
        const d = progress(lt, 0.05, 0.35, ease.outExpo) * randomRange(`pi-d${bi}`, i, 300, 900) * u;
        const s = randomRange(`pi-s${bi}`, i, 20, 70) * u;
        shapes.push(<div key={`b${i}`} style={{ position: 'absolute', left: L.cx + Math.cos(a) * d - s / 2, top: L.cy + Math.sin(a) * d - s / 2, width: s, height: i % 2 ? s : s * 0.3, borderRadius: i % 3 === 0 ? '50%' : 0, background: i % 2 ? sc : bgB, transform: `rotate(${round(a * 60, 2)}deg)` }} />);
      }
    } else {
      const R = ph * (P ? 0.62 : 0.55) * reveal;
      shapes.push(<div key="disc" style={{ position: 'absolute', left: px - R, top: py - R, width: R * 2, height: R * 2, borderRadius: '50%', background: B, opacity: 1 - out }} />);
      shapes.push(<div key="ring" style={{ position: 'absolute', left: px - R * 1.25, top: py - R * 1.25, width: R * 2.5, height: R * 2.5, borderRadius: '50%', border: `${Math.max(2, 6 * u)}px solid ${sc}`, opacity: (1 - out) * 0.9, clipPath: `inset(0 0 ${round((1 - reveal) * 100, 2)}% 0)` }} />);
      for (let i = 0; i < 3; i++) {
        const w = (60 + i * 26) * u;
        shapes.push(<div key={`bar${i}`} style={{ position: 'absolute', left: px + R * 1.1 + i * 26 * u, top: py - R * 0.9 + i * 40 * u, width: w * reveal, height: 14 * u, background: i === 1 ? sc : A, opacity: 1 - out }} />);
      }
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bi >= 0 ? bgA : A }}>
      {/* diagonal split of the two colors, flips on every beat */}
      <div style={{ position: 'absolute', inset: 0, background: bi >= 0 ? bgB : A, clipPath: bi >= 0 ? split : 'polygon(0 0, 0 0, 0 0)' }} />
      <div data-lms-target={env.target('shapes')} style={{ position: 'absolute', inset: 0, opacity: E.shapes.opacity }}>
        {shapes}
      </div>
      {bi >= 0 &&
        // Two-tone word: each half takes the opposite color of the background it sits on.
        [
          { clip: inverse, color: bgB },
          { clip: split, color: bgA },
        ].map((layer, li) => (
          <div key={li} style={{ position: 'absolute', inset: 0, clipPath: layer.clip }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: L.cy - wordFs * 0.55, height: wordFs * 1.1, fontFamily: `"${display}"`, fontWeight: 900, fontStretch: '125%', fontSize: wordFs, lineHeight: 1.1, letterSpacing: '-0.04em', textAlign: 'center' }}>
              {E.echo.visible && (
                <div data-lms-target={li ? undefined : env.target('echo')} style={{ position: 'absolute', inset: 0, opacity: E.echo.opacity }}>
                  <EchoTrail
                    t={lt}
                    count={Math.round(2 + E.echo.intensity * 3)}
                    spacing={0.03}
                    decay={0.6}
                    render={(tt, i) => (i === 0 ? null : <div style={{ transform: `translateX(${round(wordX(tt), 2)}px)`, color: 'transparent', WebkitTextStroke: `${round(3 * u, 2)}px ${layer.color}` }}>{word}</div>)}
                  />
                </div>
              )}
              <DirectionalBlur x={Math.min(50 * u, Math.abs(vel) / 70)} style={{ position: 'absolute', inset: 0, transform: `translateX(${round(wordX(lt), 2)}px) scale(${round(1 + (1 - progress(lt, 0, 0.2, ease.outCubic)) * 0.3, 4)})`, color: layer.color }}>
                {word}
              </DirectionalBlur>
            </div>
          </div>
        ))}
      {bi < 0 && E.product.visible && (
        <div
          data-lms-target={env.target('product')}
          style={{
            position: 'absolute',
            left: px - pw / 2,
            top: py - ph / 2,
            opacity: E.product.opacity * clamp(pop * 2) * (1 - out),
            transform: `translateY(${round((1 - pop) * 260 * u + out * 120 * u, 2)}px) rotate(${round((1 - clamp(pop)) * -12, 3)}deg) scale(${round((0.7 + 0.3 * clamp(pop, 0, 1.15)) * pulse, 4)})`,
            filter: `drop-shadow(0 ${round(30 * u, 1)}px ${round(30 * u, 1)}px rgba(0,0,0,0.35))`,
          }}
        >
          <ProductImage assetId={props.assetId} w={pw} h={ph} color={env.color(E.product.color)} accent={A} t={t} />
        </div>
      )}
      {bi < 0 && (
        <>
          <Anchor x={P ? L.cx : L.safe.left} y={P ? L.height * 0.7 : L.cy - (headline.layout.height + sub.layout.height + 30 * u) / 2} align={P ? 'center' : 'start'} width={P ? L.safe.width : L.width * 0.3}>
            <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={P ? 'center' : 'start'} start={at(C.headline.in, anim, scene.texts.headline.delay)} each={0.08} dur={0.6} out={textOut} targetId={env.target('headline')} />
          </Anchor>
          <Anchor x={P ? L.cx : L.safe.left} y={P ? L.height * 0.7 + headline.layout.height + 30 * u : L.cy + headline.layout.height / 2 + 30 * u} align={P ? 'center' : 'start'} width={P ? L.safe.width : L.width * 0.28}>
            <MaskedLines text={sub} env={env} color={env.color(scene.texts.sub.color)} align={P ? 'center' : 'start'} start={at(C.sub.in, anim, scene.texts.sub.delay)} out={textOut} targetId={env.target('sub')} />
          </Anchor>
        </>
      )}
    </div>
  );
};
