import type { CSSProperties, ReactNode } from 'react';
import { Img } from 'remotion';
import { TAU, clamp, ease, lerp, progress, round } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import { useAssets, type SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, alignX, columnX } from '@lms/scene-kit';
import { PRODUCT_CHOREO as C, type ProductRevealScene } from '../scenes/productReveal';
import { at } from '../common';
import { Anchor, MaskedLines, familyOf, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<ProductRevealScene>;

/** Procedural phone with a live UI: works without any upload. */
const Device = ({ env, w, h }: { env: Env; w: number; h: number }) => {
  const { t, layout: L } = env;
  const u = L.u;
  const c = env.color(env.scene.elements.product.color);
  const glow = env.scene.elements.product.intensity;
  const fg = env.palette.foreground;
  const bezel = 16 * u;
  const ring = 0.62 + 0.3 * Math.sin(t * 1.4);
  const R = w * 0.26;
  const circ = TAU * R;
  const card = (top: number, width: number, accent: boolean): CSSProperties => ({
    position: 'absolute',
    left: 26 * u,
    top,
    width,
    height: 70 * u,
    borderRadius: 18 * u,
    background: accent ? withAlpha(c, 0.85) : withAlpha(fg, 0.08),
    border: `1px solid ${withAlpha(fg, 0.12)}`,
  });
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 70 * u,
        background: 'linear-gradient(150deg, #3A3B44 0%, #16171C 38%, #0B0B0F 70%, #2A2B33 100%)',
        boxShadow: `inset 0 0 0 ${Math.max(1, 2 * u)}px rgba(255,255,255,0.14), 0 ${50 * u}px ${120 * u}px rgba(0,0,0,0.6)`,
        padding: bezel,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 54 * u,
          overflow: 'hidden',
          background: `radial-gradient(120% 70% at 50% 0%, ${withAlpha(c, 0.55 * glow)}, transparent 60%), linear-gradient(180deg, #0E0F16, #07080B)`,
        }}
      >
        <div style={{ position: 'absolute', left: '50%', top: 16 * u, width: 110 * u, height: 32 * u, marginLeft: -55 * u, borderRadius: 99, background: '#000' }} />
        <div style={{ position: 'absolute', left: 30 * u, top: 70 * u, fontFamily: `"${familyOf(env, 'mono')}"`, fontSize: 15 * u, letterSpacing: '0.16em', color: withAlpha(fg, 0.6) }}>PULSE · LIVE</div>
        <svg width={w - bezel * 2} height={R * 2 + 60 * u} style={{ position: 'absolute', left: 0, top: 110 * u }}>
          <circle cx={(w - bezel * 2) / 2} cy={R + 20 * u} r={R} fill="none" stroke={withAlpha(fg, 0.12)} strokeWidth={14 * u} />
          <circle
            cx={(w - bezel * 2) / 2}
            cy={R + 20 * u}
            r={R}
            fill="none"
            stroke={c}
            strokeWidth={14 * u}
            strokeLinecap="round"
            strokeDasharray={`${circ * ring} ${circ}`}
            transform={`rotate(-90 ${(w - bezel * 2) / 2} ${R + 20 * u})`}
          />
          <text x={(w - bezel * 2) / 2} y={R + 36 * u} textAnchor="middle" fontFamily={familyOf(env, 'display')} fontWeight={800} fontSize={58 * u} fill={fg}>
            {Math.round(ring * 100)}
          </text>
        </svg>
        <div style={card(R * 2 + 210 * u, w - bezel * 2 - 52 * u, true)} />
        <div style={card(R * 2 + 296 * u, (w - bezel * 2 - 52 * u) * 0.7, false)} />
        <div style={card(R * 2 + 382 * u, (w - bezel * 2 - 52 * u) * 0.85, false)} />
      </div>
    </div>
  );
};

const ProductArt = ({ env, w, h }: { env: Env; w: number; h: number }) => {
  const assets = useAssets();
  const url = assets.url(env.scene.props.assetId);
  if (url) return <Img src={url} style={{ width: w, height: h, objectFit: 'contain', display: 'block' }} />;
  return <Device env={env} w={w} h={h} />;
};

export const ProductRevealView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const E = scene.elements;
  const k = (0.6 + 0.4 * anim.intensity) * (0.5 + E.light.intensity * 0.5);
  const light = env.color(E.light.color);
  const exitStart = env.duration - C.exit;
  const dim = progress(t, exitStart, C.exit, ease.inCubic);

  /* ---------- product placement ---------- */
  const custom = Boolean(env.scene.props.assetId);
  const baseH = (P ? 900 : 760) * u * scene.props.productScale;
  const pw = custom ? baseH * 0.9 : baseH * 0.48;
  const ph = baseH;
  const px = (P ? L.cx : L.width * 0.66) + scene.props.productX * L.safe.width;
  const py = (P ? L.height * 0.4 : L.cy - 20 * u) + scene.props.productY * L.safe.height;

  /* ---------- reveal timeline ---------- */
  const tProd = at(C.product.in, anim);
  const rim = progress(t, tProd + 0.1, 0.8, ease.cinematic);
  const reveal = progress(t, tProd + 0.55, 1.35 / anim.pace, ease.inOutQuart);
  const zoom = lerp(1.24, 1, progress(t, tProd, 2.8 / anim.pace, ease.cinematic)) * (1 - dim * 0.04);
  const edge = reveal * 1.5 - 0.25; // diagonal edge position across the product box (0..1+)
  const clipLit = `polygon(0% 0%, ${round((edge + 0.25) * 100, 2)}% 0%, ${round((edge - 0.25) * 100, 2)}% 100%, 0% 100%)`;

  // Light lines that ride the reveal edge, plus two thinner trailing ones.
  const lines: ReactNode[] =
    E.light.visible && reveal > 0 && reveal < 1
      ? [0, 0.07, 0.15].map((off, i) => {
          const e = (edge - off) * pw;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: e - pw * 0.25,
                top: -ph * 0.15,
                width: Math.max(1, (i === 0 ? 4 : 1.5) * u),
                height: ph * 1.3,
                transform: `skewX(${round((Math.atan2(pw * 0.5, ph) * 180) / Math.PI, 3)}deg)`,
                transformOrigin: 'top left',
                background: i === 0 ? '#FFFFFF' : light,
                boxShadow: `0 0 ${(i === 0 ? 24 : 10) * u}px ${(i === 0 ? 6 : 2) * u}px ${withAlpha(light, 0.8)}`,
                opacity: (i === 0 ? 1 : 0.6) * Math.sin(Math.PI * reveal),
              }}
            />
          );
        })
      : [];

  const spot = progress(t, at(C.light.in, anim), C.light.dur, ease.cinematic) * (1 - dim * 0.8);
  const reflIn = progress(t, at(C.reflection.in, anim), C.reflection.dur, ease.cinematic) * (1 - dim);

  /* ---------- text ---------- */
  const headline = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 110 : 104) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.4) * o.scale,
    maxHeight: (P ? L.height * 0.14 : L.height * 0.36) * o.scale,
    lineHeight: 1.02,
  });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 36 : 32) * u * o.scale, maxWidth: (P ? L.safe.width * 0.88 : L.width * 0.34) * o.scale, lineHeight: 1.35 });
  const align = P ? o.align : o.align;
  const ax = (P ? alignX(L, align) : columnX(L.safe.left, L.width * 0.42, align)) + o.offsetX * L.safe.width;
  const blockH = headline.layout.height + 26 * u + sub.layout.height;
  const ty = (P ? L.height * 0.79 - blockH / 2 : L.cy - blockH / 2) + o.offsetY * L.safe.height;
  const textOut = progress(t, exitStart, 0.4, ease.inCubic);

  const art = <ProductArt env={env} w={pw} h={ph} />;
  const productBox: CSSProperties = { position: 'absolute', left: -pw / 2, top: -ph / 2, width: pw, height: ph };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: px, y: py }} />
      {E.light.visible && (
        <div
          data-lms-target={env.target('light')}
          style={{
            position: 'absolute',
            left: px - ph,
            top: py - ph,
            width: ph * 2,
            height: ph * 2,
            background: `radial-gradient(closest-side, ${withAlpha(light, 0.28 * k * E.light.opacity)}, ${withAlpha(light, 0.06 * k)} 55%, transparent)`,
            opacity: spot,
          }}
        />
      )}

      <div style={{ position: 'absolute', left: px, top: py, transform: `scale(${round(zoom, 4)})`, opacity: 1 - dim * 0.9 }}>
        {/* Floor reflection */}
        {E.reflection.visible && (
          <div
            data-lms-target={env.target('reflection')}
            style={{
              ...productBox,
              top: ph / 2 + 10 * u,
              transform: 'scaleY(-1)',
              transformOrigin: 'top center',
              opacity: E.reflection.opacity * reflIn,
              maskImage: `linear-gradient(to top, rgba(0,0,0,0.6), transparent ${round(25 + E.reflection.intensity * 20, 2)}%)`,
              WebkitMaskImage: `linear-gradient(to top, rgba(0,0,0,0.6), transparent ${round(25 + E.reflection.intensity * 20, 2)}%)`,
              clipPath: `polygon(0 0, ${round(clamp(edge + 0.25) * 100, 2)}% 0, ${round(clamp(edge - 0.25) * 100, 2)}% 100%, 0 100%)`,
            }}
          >
            {art}
          </div>
        )}
        {/* Silhouette with rim light */}
        <div
          style={{
            ...productBox,
            filter: `brightness(0) drop-shadow(0 0 ${round(3 * u, 2)}px ${withAlpha(light, rim)}) drop-shadow(0 0 ${round(28 * u * k, 2)}px ${withAlpha(light, 0.55 * rim)})`,
          }}
        >
          {art}
        </div>
        {/* Lit product, revealed by the diagonal mask */}
        <div data-lms-target={env.target('product')} style={{ ...productBox, clipPath: clipLit }}>
          {art}
        </div>
        <div style={{ ...productBox, overflow: 'visible', pointerEvents: 'none' }}>{lines}</div>
      </div>

      <Anchor x={ax} y={ty} align={align} width={P ? L.safe.width : L.width * 0.42}>
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={align} start={at(C.headline.in, anim, scene.texts.headline.delay)} each={0.1} dur={0.85} out={textOut} targetId={env.target('headline')} />
        <div style={{ height: 26 * u }} />
        <MaskedLines text={sub} env={env} color={withAlpha(env.color(scene.texts.sub.color), 0.75)} align={align} start={at(C.sub.in, anim, scene.texts.sub.delay)} out={textOut} targetId={env.target('sub')} />
      </Anchor>
    </div>
  );
};
