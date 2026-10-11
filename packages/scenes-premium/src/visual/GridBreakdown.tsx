import type { ReactNode } from 'react';
import { SPRINGS, clamp, ease, progress, randomAt, randomRange, round, springWithIntensity } from '@lms/motion-core';
import { mixHex, withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { SceneBackground, alignX } from '@lms/scene-kit';
import { GRID_CHOREO as C, type GridBreakdownScene } from '../scenes/gridBreakdown';
import { at } from '../common';
import { Anchor, MaskedLines, useRoleText } from '@lms/scene-kit';

type Env = SceneRuntime<GridBreakdownScene>;

export const GridBreakdownView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const E = scene.elements;
  const k = anim.intensity;
  const exitStart = env.duration - C.exit;

  /* ---------- grid ---------- */
  const cols = P ? Math.max(5, Math.round(scene.props.density * 0.58)) : scene.props.density;
  const size = L.width / cols;
  const rows = Math.ceil(L.height / size) + 1;
  const oy = (L.height - rows * size) / 2;
  const gap = Math.max(1, 3 * u);

  /* ---------- text block → cleared band ---------- */
  const headline = useRoleText(env, scene.texts.headline, 'display', {
    size: (P ? 150 : 150) * u * o.scale,
    maxWidth: (P ? L.safe.width * 0.95 : L.width * 0.66) * o.scale,
    maxHeight: (P ? L.height * 0.3 : L.height * 0.42) * o.scale,
    lineHeight: 0.92,
  });
  const sub = useRoleText(env, scene.texts.sub, 'text', { size: (P ? 36 : 32) * u * o.scale, maxWidth: (P ? L.safe.width * 0.85 : L.width * 0.46) * o.scale, lineHeight: 1.35 });
  const blockW = Math.max(headline.layout.width, sub.layout.width);
  const blockH = headline.layout.height + 30 * u + sub.layout.height;
  const ax = alignX(L, o.align) + o.offsetX * L.safe.width;
  const left = o.align === 'start' ? ax : o.align === 'end' ? ax - blockW : ax - blockW / 2;
  const top = L.cy - blockH / 2 + o.offsetY * L.safe.height;
  // Band in cell coordinates (snapped outwards, one cell of padding).
  const c0 = Math.max(0, Math.floor((left - size * 0.6) / size));
  const c1 = Math.min(cols - 1, Math.floor((left + blockW + size * 0.6) / size));
  const r0 = Math.max(0, Math.floor((top - oy - size * 0.5) / size));
  const r1 = Math.min(rows - 1, Math.floor((top + blockH - oy + size * 0.5) / size));
  const bandCx = (c0 + c1 + 1) / 2;
  const bandCy = (r0 + r1 + 1) / 2;

  const tCells = at(C.cells.in, anim);
  const tBreak = at(C.breakdown.in, anim);
  const cellsColor = env.color(E.cells.color);
  const accent = env.color(E.accents.color);
  const fg = env.palette.foreground;

  const cells: ReactNode[] = [];
  if (E.cells.visible) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = c * size;
        const y = oy + r * size;
        const dx = (c + 0.5) / cols - 0.5;
        const dy = (y + size / 2) / L.height - 0.5;
        const d = Math.hypot(dx, dy * (L.height / L.width));
        const appear = tCells + d * 0.9 + randomAt('gb-a', i) * 0.12;
        const sp = springWithIntensity(Math.max(0, t - appear), SPRINGS.snappy, 0.3 + k * 0.7);
        const inBand = c >= c0 && c <= c1 && r >= r0 && r <= r1;
        const isAccent = E.accents.visible && !inBand && randomAt('gb-x', i) < 0.05 + E.accents.intensity * 0.05;

        let tx = 0;
        let ty = 0;
        let rot = 0;
        let sc = sp;
        let op = 1;
        if (inBand) {
          // Break away: outwards from the band center, with spin; mirrored on the exit.
          const bd = Math.hypot(c + 0.5 - bandCx, r + 0.5 - bandCy) / Math.max(1, (c1 - c0 + 1) / 2);
          const away = progress(t, tBreak + bd * 0.3 + randomAt('gb-b', i) * 0.08, 0.55, ease.inCubic);
          const back = progress(t, exitStart + (1 - clamp(bd)) * 0.18, 0.32, ease.cinematic);
          const e = away * (1 - back);
          const ang = Math.atan2(r + 0.5 - bandCy, c + 0.5 - bandCx) + randomRange('gb-r', i, -0.5, 0.5);
          const dist = (300 + randomAt('gb-d', i) * 500) * u * (0.6 + 0.4 * k);
          tx = Math.cos(ang) * dist * e;
          ty = Math.sin(ang) * dist * e + e * e * 260 * u;
          rot = randomRange('gb-s', i, -160, 160) * e * k;
          sc = sp * (1 - 0.55 * e);
          op = 1 - e;
        } else {
          // Block displacement: some cells slide one step and come back, the rest breathe.
          const bump = Math.sin(Math.PI * progress(t, tBreak + randomAt('gb-m', i) * 0.6, 0.7, ease.inOutQuart));
          if (randomAt('gb-p', i) < 0.18 * (0.5 + k * 0.5)) {
            const horizontalMove = randomAt('gb-h', i) > 0.5;
            const sign = randomAt('gb-g', i) > 0.5 ? 1 : -1;
            tx = horizontalMove ? sign * size * bump : 0;
            ty = horizontalMove ? 0 : sign * size * bump;
          }
          // Settle into a calmer checker after the breakdown.
          const settle = progress(t, tBreak + 0.6, 0.8, ease.cinematic);
          op = 1 - settle * ((r + c) % 2 === 0 ? 0.25 : 0.62) * (1 - (isAccent ? 1 : 0));
        }
        // Exit: everything shrinks towards the edges.
        const shrink = progress(t, exitStart + 0.25 + (0.5 - Math.min(0.5, d)) * 0.5, 0.35, ease.inCubic);
        sc *= 1 - shrink;
        if (sc <= 0.001 || op <= 0.001) continue;
        const tone = randomAt('gb-t', i) * E.cells.intensity;
        const pulse = isAccent ? 0.75 + 0.25 * Math.sin(t * 4 + i) : 1;
        const bg = isAccent ? withAlpha(accent, E.accents.opacity * pulse * progress(t, at(C.accents.in, anim) + randomAt('gb-q', i) * 0.6, 0.4)) : mixHex(cellsColor, fg, tone * 0.12);
        cells.push(
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + gap / 2,
              top: y + gap / 2,
              width: size - gap,
              height: size - gap,
              background: isAccent && t < at(C.accents.in, anim) ? mixHex(cellsColor, fg, tone * 0.12) : bg,
              opacity: op * E.cells.opacity,
              transform: `translate(${round(tx, 2)}px, ${round(ty, 2)}px) rotate(${round(rot, 2)}deg) scale(${round(sc, 4)})`,
            }}
          />,
        );
      }
    }
  }

  /* ---------- grid lines ---------- */
  const lineIn = at(C.lines.in, anim);
  const lineOut = progress(t, exitStart + 0.3, 0.4, ease.inCubic);
  const lw = Math.max(1, (0.8 + E.lines.intensity * 0.8) * u);
  const gridLines: ReactNode[] = [];
  if (E.lines.visible) {
    for (let c = 1; c < cols; c++) {
      const p = progress(t, lineIn + Math.abs(c - cols / 2) * 0.03, 0.6, ease.cinematic) * (1 - lineOut);
      gridLines.push(<line key={`v${c}`} x1={c * size} x2={c * size} y1={L.cy - (L.height / 2) * p} y2={L.cy + (L.height / 2) * p} />);
    }
    for (let r = 0; r <= rows; r++) {
      const y = oy + r * size;
      const p = progress(t, lineIn + Math.abs(r - rows / 2) * 0.03, 0.6, ease.cinematic) * (1 - lineOut);
      gridLines.push(<line key={`h${r}`} y1={y} y2={y} x1={L.cx - (L.width / 2) * p} x2={L.cx + (L.width / 2) * p} />);
    }
  }

  const textOut = progress(t, exitStart, 0.3, ease.inCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} />
      <Anchor x={ax} y={top} align={o.align} width={blockW}>
        <MaskedLines text={headline} env={env} color={env.color(scene.texts.headline.color)} align={o.align} start={at(C.headline.in, anim, scene.texts.headline.delay)} each={0.1} dur={0.8} out={textOut} targetId={env.target('headline')} />
        <div style={{ height: 30 * u }} />
        <MaskedLines text={sub} env={env} color={withAlpha(env.color(scene.texts.sub.color), 0.75)} align={o.align} start={at(C.sub.in, anim, scene.texts.sub.delay)} out={textOut} targetId={env.target('sub')} />
      </Anchor>
      <div data-lms-target={env.target('cells')} style={{ position: 'absolute', inset: 0 }}>
        {cells}
      </div>
      <svg width={L.width} height={L.height} style={{ position: 'absolute', inset: 0 }} data-lms-target={env.target('lines')}>
        <g stroke={withAlpha(env.color(E.lines.color), E.lines.opacity)} strokeWidth={lw}>
          {gridLines}
        </g>
      </svg>
    </div>
  );
};
