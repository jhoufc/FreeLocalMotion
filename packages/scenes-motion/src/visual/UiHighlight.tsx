import type { ReactNode } from 'react';
import { SPRINGS, clamp, ease, lerp, progress, round, springWithIntensity } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import type { SceneRuntime } from '@lms/template-sdk';
import { Anchor, MaskedLines, SceneBackground, alignX, columnX, familyOf, useRoleText } from '@lms/scene-kit';
import { UI_CHOREO as C, type UiHighlightScene } from '../scenes/uiHighlight';
import { at } from '../common';
import { Dashboard, ImageOr } from './procedural';

type Env = SceneRuntime<UiHighlightScene>;
const UI_W = 1280;
const UI_H = 760;

export const UiHighlightView = ({ env }: { env: Env }) => {
  const { t, layout: L, scene, override: o } = env;
  const P = L.isPortrait;
  const u = L.u;
  const anim = scene.animation;
  const props = scene.props;
  const E = scene.elements;
  const exitStart = env.duration - C.exit;

  // Window geometry (content area keeps the UI aspect ratio).
  const winW = (P ? L.width * 0.92 : L.width * 0.6) * o.scale;
  const barH = 40 * u;
  const contentH = (winW * UI_H) / UI_W;
  const winH = contentH + barH;
  const wx = (P ? L.cx - winW / 2 : L.width * 0.965 - winW) + o.offsetX * L.safe.width;
  const wy = (P ? L.height * 0.5 - winH / 2 : L.cy - winH / 2) + o.offsetY * L.safe.height;
  const s = winW / UI_W;

  const tWin = at(C.window.in, anim);
  const pop = springWithIntensity(Math.max(0, t - tWin), SPRINGS.heavy, 0.3 + anim.intensity * 0.5);
  const out = progress(t, exitStart, C.exit, ease.inCubic);

  // Focus phase: camera into the region (zoom/cards) and/or spotlight.
  const tFocus = at(C.focus.in, anim);
  const f = ease.inOutQuart(progress(t, tFocus, 0.9, ease.linear)) * (1 - progress(t, exitStart - 0.1, 0.4, ease.inOutQuart));
  const fx = props.focusX * UI_W;
  const fy = props.focusY * UI_H;
  const fw = Math.min(props.focusW, 1 - props.focusX) * UI_W;
  const fh = Math.min(props.focusH, 1 - props.focusY) * UI_H;
  const maxZoom = props.reveal === 'spotlight' ? 1 : props.reveal === 'cards' ? Math.min(1.35, 0.9 / Math.max(fw / UI_W, fh / UI_H)) : Math.min(2.4, 0.78 / Math.max(fw / UI_W, fh / UI_H));
  const z = lerp(1, maxZoom, f);
  const fcx = fx + fw / 2;
  const fcy = fy + fh / 2;
  // Translate so the region center moves towards the window center (clamped to the UI edges).
  const tx = lerp(0, UI_W / 2 - fcx, f);
  const ty = lerp(0, UI_H / 2 - fcy, f);
  const cam = `translate(${round(UI_W / 2, 2)}px, ${round(UI_H / 2, 2)}px) scale(${round(z, 4)}) translate(${round(-UI_W / 2 + tx, 2)}px, ${round(-UI_H / 2 + ty, 2)}px)`;
  // Focus rect in window-content pixels after the camera.
  const toScreen = (x: number, y: number) => ({ x: (UI_W / 2 + (x - UI_W / 2 + tx) * z) * s, y: (UI_H / 2 + (y - UI_H / 2 + ty) * z) * s });
  const r0 = toScreen(fx, fy);
  const r1 = toScreen(fx + fw, fy + fh);
  const rect = { x: r0.x, y: r0.y, w: r1.x - r0.x, h: r1.y - r0.y };

  const pal = { bg: env.palette.surface, fg: env.palette.foreground, accent: env.palette.accent, secondary: env.palette.secondary };
  const ui = (
    <ImageOr assetId={props.assetId} fit="cover" fallback={<Dashboard w={UI_W} h={UI_H} pal={pal} t={Math.max(0, t - tWin)} font={familyOf(env, 'text')} />} />
  );

  // "cards": the interface assembles from tiles.
  let content: ReactNode;
  if (props.reveal === 'cards') {
    const cols = 4;
    const rows = 3;
    const tiles: ReactNode[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const tp = springWithIntensity(Math.max(0, t - tWin - 0.15 - (i + j) * 0.06), SPRINGS.type, 0.4 + anim.intensity * 0.6);
        const x0 = (i / cols) * 100;
        const y0 = (j / rows) * 100;
        tiles.push(
          <div
            key={k}
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: `inset(${round(y0, 3)}% ${round(100 - x0 - 100 / cols, 3)}% ${round(100 - y0 - 100 / rows, 3)}% ${round(x0, 3)}%)`,
              transform: `translateY(${round((1 - tp) * 60, 2)}px) scale(${round(0.92 + 0.08 * clamp(tp, 0, 1.1), 4)})`,
              transformOrigin: `${round(x0 + 50 / cols, 2)}% ${round(y0 + 50 / rows, 2)}%`,
              opacity: clamp(tp * 2),
            }}
          >
            {ui}
          </div>,
        );
      }
    content = tiles;
  } else content = ui;

  const focusColor = env.color(E.focus.color);
  const dim = (props.reveal === 'zoom' ? 0.35 : 0.62) * E.focus.intensity * f;
  const ring = progress(t, tFocus + 0.6, 0.6, ease.cinematic) * (1 - out);
  const radius = 14 * u;

  // Callouts around the focus rect.
  const callouts = props.callouts.map((c, i) => {
    const sameSide = props.callouts.slice(0, i).filter((x) => x.side === c.side).length;
    const cIn = progress(t, at(C.callouts.in, anim) + i * 0.18, 0.6, ease.cinematic) * (1 - out);
    const gap = (70 + 20 * E.callouts.intensity) * u;
    const anchor =
      c.side === 'left'
        ? { x: rect.x, y: rect.y + rect.h * (0.35 + sameSide * 0.3) }
        : c.side === 'right'
          ? { x: rect.x + rect.w, y: rect.y + rect.h * (0.35 + sameSide * 0.3) }
          : c.side === 'top'
            ? { x: rect.x + rect.w * (0.3 + sameSide * 0.4), y: rect.y }
            : { x: rect.x + rect.w * (0.3 + sameSide * 0.4), y: rect.y + rect.h };
    const end =
      c.side === 'left' ? { x: anchor.x - gap, y: anchor.y } : c.side === 'right' ? { x: anchor.x + gap, y: anchor.y } : c.side === 'top' ? { x: anchor.x, y: anchor.y - gap * 0.8 } : { x: anchor.x, y: anchor.y + gap * 0.8 };
    const line = clamp(cIn * 1.6);
    const labelIn = clamp(cIn * 1.6 - 0.5);
    const fs = (P ? 26 : 22) * u * (0.85 + 0.15 * E.callouts.intensity);
    // Keep labels inside the frame's safe area (coordinates are relative to the window content).
    const labelW = c.label.length * fs * 0.56 + fs * 1.6;
    const minX = L.safe.left - wx;
    const maxX = L.width - L.safe.right - wx - labelW;
    const leftX = c.side === 'left' ? end.x - 10 * u - labelW : end.x + (c.side === 'right' ? 10 * u : -labelW / 2);
    const labelX = Math.min(maxX, Math.max(minX, leftX));
    return (
      <div key={i} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }} width={1} height={1}>
          <line x1={anchor.x} y1={anchor.y} x2={lerp(anchor.x, end.x, line)} y2={lerp(anchor.y, end.y, line)} stroke={focusColor} strokeWidth={Math.max(1, 2 * u)} />
          <circle cx={anchor.x} cy={anchor.y} r={6 * u * clamp(cIn * 3)} fill={focusColor} />
        </svg>
        <div
          style={{
            position: 'absolute',
            left: labelX,
            top: end.y - fs * 0.95 + (c.side === 'top' ? -fs : c.side === 'bottom' ? fs * 0.6 : 0),
            padding: `${round(fs * 0.45, 2)}px ${round(fs * 0.8, 2)}px`,
            borderRadius: 99,
            background: withAlpha(env.palette.background, 0.85),
            border: `${Math.max(1, 1.5 * u)}px solid ${withAlpha(focusColor, 0.8)}`,
            color: env.color(E.callouts.color),
            fontFamily: `"${familyOf(env, 'text')}"`,
            fontWeight: 600,
            fontSize: fs,
            whiteSpace: 'nowrap',
            opacity: labelIn * E.callouts.opacity,
            transform: `scale(${round(0.85 + 0.15 * labelIn, 4)})`,
          }}
        >
          {c.label}
        </div>
      </div>
    );
  });

  const title = useRoleText(env, scene.texts.title, 'display', { size: (P ? 96 : 84) * u * o.scale, maxWidth: (P ? L.safe.width : L.width * 0.28) * o.scale, maxHeight: L.height * 0.3, lineHeight: 1.02 });
  const benefit = useRoleText(env, scene.texts.benefit, 'text', { size: (P ? 36 : 30) * u * o.scale, maxWidth: (P ? L.safe.width * 0.9 : L.width * 0.27) * o.scale, lineHeight: 1.35 });
  const align = o.align;
  const colW = L.width * 0.3;
  const textOut = progress(t, exitStart, 0.35, ease.inCubic);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SceneBackground env={env} focus={{ x: wx + winW / 2, y: wy + winH / 2 }} />
      {E.window.visible && (
        <div
          data-lms-target={env.target('window')}
          style={{
            position: 'absolute',
            left: wx,
            top: wy,
            width: winW,
            height: winH,
            borderRadius: 18 * u,
            overflow: 'hidden',
            background: env.color(E.window.color),
            border: `${Math.max(1, 1.5 * u)}px solid ${withAlpha(env.palette.foreground, 0.14)}`,
            boxShadow: `0 ${50 * u}px ${140 * u}px ${withAlpha('#000000', 0.55 * E.window.intensity)}`,
            opacity: E.window.opacity * clamp(pop * 2) * (1 - out),
            transform: `perspective(${round(3000 * u, 1)}px) translateY(${round((1 - pop) * 120 * u + out * 60 * u, 2)}px) rotateX(${round((1 - pop) * 14, 3)}deg) scale(${round(0.94 + 0.06 * clamp(pop, 0, 1.1), 4)})`,
          }}
        >
          <div style={{ height: barH, display: 'flex', alignItems: 'center', gap: 8 * u, padding: `0 ${16 * u}px`, background: withAlpha(env.palette.foreground, 0.05), borderBottom: `1px solid ${withAlpha(env.palette.foreground, 0.08)}` }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <span key={c} style={{ width: 11 * u, height: 11 * u, borderRadius: '50%', background: c }} />
            ))}
            <span style={{ marginLeft: 16 * u, height: 20 * u, width: winW * 0.35, borderRadius: 99, background: withAlpha(env.palette.foreground, 0.08) }} />
          </div>
          <div style={{ position: 'relative', width: winW, height: contentH, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: UI_W, height: UI_H, transformOrigin: '0 0', transform: `scale(${round(s, 5)})` }}>
              <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: cam }}>{content}</div>
            </div>
            {E.focus.visible && dim > 0.001 && (
              <div
                style={{
                  position: 'absolute',
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  borderRadius: radius,
                  boxShadow: `0 0 0 ${round(4000 * u, 0)}px ${withAlpha('#000000', dim)}`,
                }}
              />
            )}
            {E.focus.visible && ring > 0 && (
              <svg data-lms-target={env.target('focus')} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} width={winW} height={contentH}>
                <rect x={rect.x} y={rect.y} width={Math.max(1, rect.w)} height={Math.max(1, rect.h)} rx={radius} fill="none" stroke={focusColor} strokeWidth={Math.max(2, 3 * u)} pathLength={1} strokeDasharray={`${round(ring, 4)} 1`} style={{ filter: `drop-shadow(0 0 ${round(10 * u, 2)}px ${focusColor})` }} />
              </svg>
            )}
          </div>
        </div>
      )}

      {E.callouts.visible && E.window.visible && (
        <div data-lms-target={env.target('callouts')} style={{ position: 'absolute', left: wx, top: wy + barH, width: winW, height: contentH, opacity: 1 - out }}>
          {callouts}
        </div>
      )}

      {P ? (
        <>
          <Anchor x={alignX(L, align) + o.offsetX * L.safe.width} y={L.safe.top + 20 * u} align={align} width={L.safe.width}>
            <MaskedLines text={title} env={env} color={env.color(scene.texts.title.color)} align={align} start={at(C.title.in, anim, scene.texts.title.delay)} each={0.1} out={textOut} targetId={env.target('title')} />
          </Anchor>
          <Anchor x={alignX(L, align) + o.offsetX * L.safe.width} y={wy + winH + 70 * u} align={align} width={L.safe.width}>
            <MaskedLines text={benefit} env={env} color={withAlpha(env.color(scene.texts.benefit.color), 0.8)} align={align} start={at(C.benefit.in, anim, scene.texts.benefit.delay)} out={textOut} targetId={env.target('benefit')} />
          </Anchor>
        </>
      ) : (
        <Anchor x={columnX(L.safe.left, colW, align)} y={L.cy - (title.layout.height + 30 * u + benefit.layout.height) / 2} align={align} width={colW}>
          <MaskedLines text={title} env={env} color={env.color(scene.texts.title.color)} align={align} start={at(C.title.in, anim, scene.texts.title.delay)} each={0.1} out={textOut} targetId={env.target('title')} />
          <div style={{ height: 30 * u }} />
          <MaskedLines text={benefit} env={env} color={withAlpha(env.color(scene.texts.benefit.color), 0.8)} align={align} start={at(C.benefit.in, anim, scene.texts.benefit.delay)} out={textOut} targetId={env.target('benefit')} />
        </Anchor>
      )}
    </div>
  );
};
