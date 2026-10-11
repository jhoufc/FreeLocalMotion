import type { ReactNode } from 'react';
import { SPRINGS, TAU, arcPath, clamp, ease, lerp, progress, round, springWithIntensity } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, alignX, columnX } from '@lms/scene-kit';
import { ORBITAL_CHOREO as C, type OrbitalDataScene } from '../scenes/orbitalData';
import { at } from '../common';
import { Anchor, MaskedLines, familyOf, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<OrbitalDataScene>;

const ORBITS = [0.42, 0.7, 1] as const;
const SQUASH = 0.38;
const TILT = (-14 * Math.PI) / 180;

export const OrbitalDataView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const E = scene.elements;
  const exitStart = env.duration - C.exit;
  const collapse = progress(t, exitStart, C.exit * 0.8, ease.inOutQuart);
  const fadeOut = progress(t, exitStart + C.exit * 0.45, C.exit * 0.55, ease.inCubic);

  /* ---------- camera: hero framing, then pull back to make room for the headline ---------- */
  const tHead = at(C.headline.in, anim, scene.texts.headline.delay);
  const pull = progress(t, tHead - 0.35, 1.2, ease.cinematic);
  const R = (P ? 390 : 380) * u * lerp(1.16, 1, pull) * o.scale;
  const cx = P ? L.cx : lerp(L.cx, L.width * 0.68, pull);
  const cy = P ? lerp(L.height * 0.45, L.height * 0.37, pull) : L.cy;

  const accent = env.palette.accent;
  const nodeColor = env.color(E.nodes.color);
  const linkColor = env.color(E.links.color);
  const orbitColor = env.color(E.orbits.color);
  const speed = scene.props.rotationSpeed;

  const toScreen = (r: number, a: number) => {
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * SQUASH;
    return { x: cx + x * Math.cos(TILT) - y * Math.sin(TILT), y: cy + x * Math.sin(TILT) + y * Math.cos(TILT), depth: Math.sin(a) };
  };

  /* ---------- orbits ---------- */
  const orbitIn = progress(t, at(C.orbits.in, anim), C.orbits.dur, ease.cinematic);
  const dots = Math.round(24 + E.orbits.intensity * 24);
  const orbits = E.orbits.visible
    ? ORBITS.map((k, i) => {
        const r = R * k;
        const circ = TAU * r;
        const draw = clamp(orbitIn * 1.4 - i * 0.2);
        return (
          <g key={i} opacity={E.orbits.opacity * (1 - fadeOut)}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={r}
              ry={r * SQUASH}
              fill="none"
              stroke={orbitColor}
              strokeWidth={Math.max(1, (i === 2 ? 1.6 : 1.1) * u)}
              strokeDasharray={i === 1 ? `${4 * u} ${10 * u}` : `${circ * draw} ${circ}`}
              transform={`rotate(${round((TILT * 180) / Math.PI, 3)} ${cx} ${cy})`}
              opacity={i === 1 ? draw : 1}
            />
            {i === 2 &&
              Array.from({ length: dots }, (_, j) => {
                const p = toScreen(r, (j / dots) * TAU + t * 0.05 * speed);
                return <circle key={j} cx={p.x} cy={p.y} r={Math.max(1, 1.6 * u)} fill={orbitColor} opacity={clamp(draw * 2 - j / dots) * (0.4 + 0.6 * (p.depth + 1) / 2)} />;
              })}
          </g>
        );
      })
    : null;

  /* ---------- nodes ---------- */
  const tNodes = at(C.nodes.in, anim);
  const tLinks = at(C.links.in, anim);
  // Nodes alternate between the two outer orbits, evenly spaced on each, so labels never pile up.
  const count = scene.props.nodes.length;
  const nodes = scene.props.nodes.map((node, i) => {
    const ring = 1 + (i % 2);
    const onRing = ring === 1 ? Math.floor(count / 2) : Math.ceil(count / 2);
    const j = Math.floor(i / 2);
    const dir = ring === 2 ? 1 : -1;
    const a0 = (j / onRing) * TAU + (ring === 1 ? TAU / onRing / 2 + 0.55 : 0) + 0.4;
    const a = a0 + t * dir * speed * (ring === 2 ? 0.12 : 0.18);
    const r = R * ORBITS[ring]! * (1 - collapse);
    const p = toScreen(r, a);
    const s = tNodes + i * (1.1 / Math.max(3, scene.props.nodes.length));
    const pop = springWithIntensity(Math.max(0, t - s), SPRINGS.bouncy, 0.4 + anim.intensity * 0.6);
    return { node, i, p, s, pop, front: p.depth };
  });

  const links: ReactNode[] = [];
  if (E.links.visible) {
    nodes.forEach(({ p, s, i }) => {
      const draw = progress(t, Math.max(s, tLinks) + 0.1, 0.5, ease.cinematic) * (1 - collapse);
      if (draw <= 0) return;
      const ex = lerp(cx, p.x, draw);
      const ey = lerp(cy, p.y, draw);
      const w = Math.max(1, (1 + E.links.intensity) * u);
      links.push(<line key={`c${i}`} x1={cx} y1={cy} x2={ex} y2={ey} stroke={withAlpha(linkColor, E.links.opacity * (0.35 + 0.35 * (p.depth + 1) / 2))} strokeWidth={w} />);
      // Data packets travelling outwards.
      const k = ((t * 0.9 + i * 0.37) % 1 + 1) % 1;
      if (draw >= 1) links.push(<circle key={`pk${i}`} cx={lerp(cx, p.x, k)} cy={lerp(cy, p.y, k)} r={Math.max(1.5, 3 * u)} fill={accent} opacity={(1 - k) * E.links.opacity} />);
      const next = nodes[(i + 1) % nodes.length]!;
      const nd = progress(t, Math.max(next.s, s) + 0.45, 0.6, ease.cinematic) * (1 - collapse);
      if (nd > 0)
        links.push(
          <line
            key={`n${i}`}
            x1={p.x}
            y1={p.y}
            x2={lerp(p.x, next.p.x, nd)}
            y2={lerp(p.y, next.p.y, nd)}
            stroke={withAlpha(linkColor, 0.28 * E.links.opacity)}
            strokeWidth={Math.max(1, u)}
            strokeDasharray={`${3 * u} ${7 * u}`}
          />,
        );
    });
  }

  /* ---------- core ---------- */
  const coreIn = springWithIntensity(Math.max(0, t - at(C.core.in, anim)), SPRINGS.heavy, 0.5 + anim.intensity * 0.5);
  const cr = R * 0.13 * coreIn * (1 + collapse * 0.6);
  const beat = 0.5 + 0.5 * Math.sin(t * TAU * 1.1);
  const glow = E.core.intensity;
  const flash = Math.sin(Math.PI * clamp(collapse)) * glow;
  const coreColor = env.color(E.core.color);
  const segments = 6;
  const core = E.core.visible ? (
    <g opacity={E.core.opacity * (1 - fadeOut)}>
      {[0, 1, 2].map((w) => {
        const ph = ((t * 1.1 + w / 3) % 1 + 1) % 1;
        return <circle key={w} cx={cx} cy={cy} r={cr * (1 + ph * 3.2)} fill="none" stroke={coreColor} strokeWidth={Math.max(1, 1.5 * u)} opacity={(1 - ph) * 0.5 * coreIn} />;
      })}
      {Array.from({ length: segments }, (_, i) => {
        const a0 = (i / segments) * TAU + t * 0.9;
        return <path key={i} d={arcPath(cx, cy, cr * 1.65, a0, a0 + TAU / segments - 0.18)} fill="none" stroke={coreColor} strokeWidth={Math.max(2, 4 * u)} strokeLinecap="round" opacity={0.85 * coreIn} />;
      })}
      <path d={arcPath(cx, cy, cr * 2.15, -t * 2.4, -t * 2.4 + 1.1)} fill="none" stroke={withAlpha(coreColor, 0.7)} strokeWidth={Math.max(1, 2 * u)} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={cr} fill={coreColor} />
      <circle cx={cx} cy={cy} r={cr * 0.45} fill="#FFFFFF" opacity={0.75 + 0.25 * beat} />
    </g>
  ) : null;
  const glowSize = R * (0.9 + 0.5 * glow) * coreIn * (1 + flash * 1.4);

  /* ---------- text ---------- */
  const headline = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 108 : 98) * u * o.scale,
    maxWidth: (P ? L.safe.width : L.width * 0.36) * o.scale,
    maxHeight: (P ? L.height * 0.18 : L.height * 0.4) * o.scale,
    lineHeight: 1.02,
  });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 36 : 32) * u * o.scale, maxWidth: (P ? L.safe.width * 0.85 : L.width * 0.32) * o.scale, lineHeight: 1.35 });
  const align = P ? (o.align === 'start' ? 'center' : o.align) : o.align;
  const ax = (P ? alignX(L, align) : columnX(L.safe.left, L.width * 0.38, align)) + o.offsetX * L.safe.width;
  const blockH = headline.layout.height + 28 * u + sub.layout.height;
  const ty = (P ? L.height * 0.66 : L.cy - blockH / 2) + o.offsetY * L.safe.height;
  const textOut = progress(t, exitStart, 0.4, ease.inCubic);
  const textW = P ? L.safe.width : L.width * 0.38;

  const mono = familyOf(env, 'mono');
  const display = familyOf(env, 'display');

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: cx, y: cy }} />
      {E.core.visible && (
        <div
          style={{
            position: 'absolute',
            left: cx - glowSize,
            top: cy - glowSize,
            width: glowSize * 2,
            height: glowSize * 2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${withAlpha(coreColor, 0.32 * (0.7 + 0.3 * beat) + flash * 0.4)} 0%, ${withAlpha(coreColor, 0.08)} 40%, transparent 70%)`,
            opacity: 1 - fadeOut,
          }}
        />
      )}
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g data-lms-target={env.target('orbits')}>{orbits}</g>
        <g data-lms-target={env.target('links')}>{links}</g>
        {/* Nodes behind the core */}
        <g data-lms-target={env.target('nodes')}>
          {E.nodes.visible &&
            nodes
              .filter((n) => n.front < 0)
              .map((n) => (
                <circle key={n.i} cx={n.p.x} cy={n.p.y} r={Math.max(2, (7 + 5 * E.nodes.intensity) * u * n.pop * (0.75 + 0.25 * (n.front + 1)))} fill={nodeColor} opacity={0.55 * E.nodes.opacity * (1 - fadeOut)} />
              ))}
        </g>
        <g data-lms-target={env.target('core')}>{core}</g>
        <g>
          {E.nodes.visible &&
            nodes
              .filter((n) => n.front >= 0)
              .map((n) => (
                <g key={n.i} opacity={E.nodes.opacity * (1 - fadeOut)}>
                  <circle cx={n.p.x} cy={n.p.y} r={Math.max(3, (16 + 8 * E.nodes.intensity) * u * n.pop)} fill={withAlpha(nodeColor, 0.18)} />
                  <circle cx={n.p.x} cy={n.p.y} r={Math.max(2, (7 + 5 * E.nodes.intensity) * u * n.pop)} fill={nodeColor} />
                </g>
              ))}
        </g>
      </svg>

      {/* Data chips */}
      {E.nodes.visible &&
        nodes.map(({ node, i, p, s }) => {
          const chipIn = progress(t, s + 0.25, 0.5, ease.cinematic) * (1 - progress(t, exitStart, 0.3, ease.inCubic));
          if (chipIn <= 0) return null;
          const right = p.x >= cx;
          const dim = 0.55 + 0.45 * (p.depth + 1) / 2;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: right ? p.x + 22 * u : undefined,
                right: right ? undefined : L.width - p.x + 22 * u,
                top: p.y - 26 * u,
                textAlign: right ? 'left' : 'right',
                opacity: chipIn * dim,
                clipPath: right ? `inset(0 ${round((1 - chipIn) * 100, 2)}% 0 0)` : `inset(0 0 0 ${round((1 - chipIn) * 100, 2)}%)`,
                whiteSpace: 'nowrap',
              }}
            >
              <div style={{ fontFamily: `"${mono}"`, fontSize: 15 * u, letterSpacing: '0.16em', textTransform: 'uppercase', color: withAlpha(env.palette.foreground, 0.6) }}>{node.label}</div>
              <div style={{ fontFamily: `"${display}"`, fontWeight: 800, fontSize: 30 * u, color: env.palette.foreground, lineHeight: 1.1 }}>{node.value}</div>
            </div>
          );
        })}

      <Anchor x={ax} y={ty} align={align} width={textW}>
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={align} start={tHead} each={0.1} dur={0.85} out={textOut} targetId={env.target('headline')} />
        <div style={{ height: 28 * u }} />
        <MaskedLines text={sub} env={env} color={withAlpha(env.color(scene.texts.sub.color), 0.75)} align={align} start={at(C.sub.in, anim, scene.texts.sub.delay)} out={textOut} targetId={env.target('sub')} />
      </Anchor>
    </div>
  );
};
