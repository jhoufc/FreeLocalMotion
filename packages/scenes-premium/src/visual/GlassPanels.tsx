import type { ReactNode } from 'react';
import { Img } from 'remotion';
import { SPRINGS, clamp, ease, progress, randomRange, round, springWithIntensity } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import { useAssets, type SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, alignX, columnX } from '@lms/scene-kit';
import { GLASS_CHOREO as C, type GlassPanel, type GlassPanelsScene } from '../scenes/glassPanels';
import { at } from '../common';
import { Anchor, MaskedLines, familyOf, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<GlassPanelsScene>;

/** Slot of each panel in the fan, per format (design units). */
const slots = (portrait: boolean, n: number) => {
  const all = portrait
    ? [
        { x: -70, y: -340, z: -160, r: 1 },
        { x: 0, y: 0, z: 0, r: 0 },
        { x: 70, y: 340, z: 150, r: -1 },
      ]
    : [
        { x: -190, y: -175, z: -200, r: 1 },
        { x: 20, y: 10, z: 0, r: 0 },
        { x: 230, y: 195, z: 170, r: -1 },
      ];
  if (n === 1) return [all[1]!];
  if (n === 2) return portrait ? [{ ...all[0]!, y: -190 }, { ...all[2]!, y: 190 }] : [{ ...all[0]!, y: -110 }, { ...all[2]!, y: 120 }];
  return all;
};

const Chart = ({ env, index, w, h, color }: { env: Env; index: number; w: number; h: number; color: string }) => {
  const { t } = env;
  const start = at(C.panels.in, env.scene.animation) + 0.55 + index * 0.16;
  if (index % 2 === 0) {
    const n = 12;
    const gap = w * 0.025;
    const bw = (w - gap * (n - 1)) / n;
    return (
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        {Array.from({ length: n }, (_, i) => {
          const target = randomRange(`gp-b${index}`, i, 0.25, 1) * (0.55 + 0.45 * Math.sin(i * 0.6 + index));
          const g = progress(t, start + i * 0.035, 0.6, ease.cinematic);
          const live = 1 + Math.sin(t * 2 + i) * 0.04;
          const bh = Math.max(2, h * clamp(target, 0.12, 1) * g * live);
          return <rect key={i} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={Math.min(6, bw / 3)} fill={i === n - 3 ? color : withAlpha(env.palette.foreground, 0.28)} />;
        })}
      </svg>
    );
  }
  const pts = Array.from({ length: 24 }, (_, i) => {
    const x = (i / 23) * w;
    const y = h * (0.75 - 0.5 * (i / 23) - 0.16 * Math.sin(i * 0.9 + index * 2) + randomRange(`gp-l${index}`, i, -0.06, 0.06));
    return [x, clamp(y, 4, h - 4)] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${round(x, 1)} ${round(y, 1)}`).join(' ');
  const len = w * 1.6;
  const draw = progress(t, start, 1.1, ease.cinematic);
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={withAlpha(color, 0.16 * draw)} />
      <path d={d} fill="none" stroke={color} strokeWidth={Math.max(2, 3 * env.layout.u)} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
      {draw > 0.98 && <circle cx={pts[23]![0]} cy={pts[23]![1]} r={6 * env.layout.u * (1 + 0.25 * Math.sin(t * 5))} fill={color} />}
    </svg>
  );
};

const Panel = ({ env, panel, index, w, h }: { env: Env; panel: GlassPanel; index: number; w: number; h: number }) => {
  const assets = useAssets();
  const { layout: L, scene, t } = env;
  const u = L.u;
  const el = scene.elements.panels;
  const fg = env.palette.foreground;
  const accent = index === 1 ? env.palette.secondary : env.palette.accent;
  const url = assets.url(panel.assetId);
  const pad = 34 * u;
  const chartH = h * 0.42;
  const sheenOn = scene.elements.sheen.visible;
  const sheenP = progress(t, at(C.sheen.in, scene.animation) + index * 0.14, C.sheen.dur, ease.inOutQuart);
  const sheenW = 0.25 + scene.elements.sheen.intensity * 0.15;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 30 * u,
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(140deg, ${withAlpha(fg, 0.26)}, ${withAlpha(env.color(el.color), el.opacity)} 42%, ${withAlpha(env.color(el.color), el.opacity * 0.8)})`,
        border: `${Math.max(1, 1.5 * u)}px solid ${withAlpha(fg, 0.16 + 0.14 * el.intensity)}`,
        boxShadow: `0 ${40 * u}px ${110 * u}px rgba(0,0,0,0.45), inset 0 ${Math.max(1, 1.5 * u)}px 0 ${withAlpha('#FFFFFF', 0.28 * el.intensity)}`,
        padding: pad,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u, fontFamily: `"${familyOf(env, 'mono')}"`, fontSize: 19 * u, letterSpacing: '0.16em', textTransform: 'uppercase', color: withAlpha(fg, 0.7) }}>
          <span style={{ width: 10 * u, height: 10 * u, borderRadius: '50%', background: accent, boxShadow: `0 0 ${14 * u}px ${accent}` }} />
          {panel.label}
        </div>
        <div style={{ fontFamily: `"${familyOf(env, 'display')}"`, fontWeight: 800, fontSize: 92 * u, lineHeight: 1.05, letterSpacing: '-0.03em', color: fg, marginTop: 14 * u, whiteSpace: 'nowrap' }}>
          {panel.value}
        </div>
      </div>
      <div style={{ height: chartH, borderRadius: 16 * u, overflow: 'hidden' }}>
        {url ? (
          <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Chart env={env} index={index} w={w - pad * 2} h={chartH} color={accent} />
        )}
      </div>
      {sheenOn && sheenP > 0 && sheenP < 1 && (
        <div
          style={{
            position: 'absolute',
            inset: '-20%',
            background: `linear-gradient(115deg, transparent ${round(50 - sheenW * 50, 2)}%, ${withAlpha(env.color(scene.elements.sheen.color), scene.elements.sheen.opacity)} 50%, transparent ${round(50 + sheenW * 50, 2)}%)`,
            transform: `translateX(${round((sheenP * 2.4 - 1.2) * 100, 2)}%)`,
            mixBlendMode: 'overlay',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export const GlassPanelsView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const depth = scene.props.depth;
  const panels = scene.props.panels;
  const exitStart = env.duration - C.exit;

  const title = useRoleText(env, scene.texts.title, 'display', {
    size: (P ? 104 : 96) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.38) * o.scale,
    maxHeight: (P ? L.height * 0.2 : L.height * 0.4) * o.scale,
    lineHeight: 1.02,
  });
  const subtitle = useRoleText(env, scene.texts.subtitle, 'text', { size: (P ? 38 : 32) * u * o.scale, maxWidth: (P ? L.safe.width * 0.9 : L.width * 0.33) * o.scale, lineHeight: 1.35 });

  // Text column + panel group positions.
  const ax = (P ? alignX(L, o.align) : columnX(L.safe.left, L.width * 0.4, o.align)) + o.offsetX * L.safe.width;
  const titleTop = (P ? L.safe.top + 30 * u : L.cy - (title.layout.height + subtitle.layout.height + 40 * u) / 2) + o.offsetY * L.safe.height;
  const textW = P ? L.safe.width : L.width * 0.4;
  const group = P ? { x: L.cx, y: L.height * 0.635 } : { x: L.width * 0.69, y: L.cy + 10 * u };
  const pw = (P ? 640 : 520) * u;
  const ph = (P ? 360 : 330) * u;
  const places = slots(P, panels.length);

  const tPanels = at(C.panels.in, anim);
  const tTitle = at(C.title.in, anim, scene.texts.title.delay);
  const tSub = at(C.subtitle.in, anim, scene.texts.subtitle.delay);
  const textOut = progress(t, exitStart, 0.4, ease.inCubic);

  // Light orbs behind the glass.
  const orbsEl = scene.elements.orbs;
  const orbIn = progress(t, at(C.orbs.in, anim), C.orbs.dur, ease.cinematic) * (1 - progress(t, exitStart + 0.1, C.exit, ease.inCubic));
  const orbs: ReactNode[] = orbsEl.visible
    ? [
        { c: env.color(orbsEl.color), x: -0.18, y: -0.22, s: 1 },
        { c: env.palette.secondary, x: 0.22, y: 0.2, s: 1.15 },
        { c: env.palette.accent, x: 0.05, y: 0.42, s: 0.6 },
      ].map((orb, i) => {
        const size = 720 * u * orb.s * (0.7 + orbsEl.intensity * 0.3);
        const dx = Math.sin(t * 0.5 + i * 2) * 50 * u;
        const dy = Math.cos(t * 0.4 + i) * 40 * u;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: group.x + orb.x * (P ? L.width : 1100 * u) - size / 2 + dx,
              top: group.y + orb.y * (P ? 900 * u : 800 * u) - size / 2 + dy,
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${withAlpha(orb.c, 0.7 * orbsEl.opacity)} 0%, ${withAlpha(orb.c, 0.24 * orbsEl.opacity)} 38%, transparent 68%)`,
              opacity: orbIn,
            }}
          />
        );
      })
    : [];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={group} />
      <div data-lms-target={env.target('orbs')} style={{ position: 'absolute', inset: 0 }}>
        {orbs}
      </div>

      {/* 2.5D panel stage */}
      <div
        data-lms-target={env.target('panels')}
        style={{ position: 'absolute', left: group.x, top: group.y, width: 0, height: 0, perspective: 1900 * u, transformStyle: 'preserve-3d' }}
      >
        {scene.elements.panels.visible &&
          panels.map((panel, i) => {
            const slot = places[i] ?? places[0]!;
            const s = tPanels + i * 0.16;
            const sp = springWithIntensity(Math.max(0, t - s), SPRINGS.heavy, 0.3 + anim.intensity * 0.5);
            const out = progress(t, exitStart + (panels.length - 1 - i) * 0.07, 0.45, ease.inCubic);
            const idleR = Math.sin(t * 0.6 + i * 1.7) * 2.5 * depth;
            const idleY = Math.sin(t * 0.9 + i) * 8 * u;
            const rotY = (P ? -10 : -22) * depth + slot.r * 4 * depth + idleR + (1 - sp) * 28 * depth;
            const rotX = (P ? 12 : 8) * depth;
            const z = slot.z * u * depth + (1 - sp) * -900 * u - out * 700 * u;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: -pw / 2 + slot.x * u,
                  top: -ph / 2 + slot.y * u + idleY + (1 - sp) * 140 * u,
                  transform: `translateZ(${round(z, 2)}px) rotateY(${round(rotY, 3)}deg) rotateX(${round(rotX, 3)}deg)`,
                  opacity: clamp(progress(t, s, 0.35) * (1 - out)),
                }}
              >
                <Panel env={env} panel={panel} index={i} w={pw} h={ph} />
              </div>
            );
          })}
      </div>

      <Anchor x={ax} y={titleTop} align={o.align} width={textW}>
        <MaskedLines text={title} env={env} color={env.color(scene.texts.title.color)} align={o.align} start={tTitle} each={0.1} dur={0.85} out={textOut} targetId={env.target('title')} />
        <div style={{ height: (P ? 26 : 30) * u }} />
        <MaskedLines
          text={subtitle}
          env={env}
          color={withAlpha(env.color(scene.texts.subtitle.color), 0.78)}
          align={o.align}
          start={tSub}
          each={0.07}
          out={textOut}
          targetId={env.target('subtitle')}
        />
      </Anchor>
    </div>
  );
};
