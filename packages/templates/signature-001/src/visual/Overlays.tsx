import { Grain, progress, round, type FrameLayout } from '@lms/motion-core';
import { mergePalette, resolveColor, withAlpha } from '@lms/shared';
import type { SceneRange } from '@lms/template-sdk';
import type { SignatureProject } from '../schema';
import { MONO } from './fonts';

const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');

export const timecode = (frame: number, fps: number) => {
  const totalSeconds = Math.floor(frame / fps);
  return `${pad2(totalSeconds / 3600)}:${pad2((totalSeconds / 60) % 60)}:${pad2(totalSeconds % 60)}:${pad2(frame % fps)}`;
};

/**
 * Editorial HUD: corner brackets, labels, timecode, scene index and progress.
 * It sits above every scene and gives the film its "studio slate" identity.
 */
export const Hud = ({
  project,
  L,
  frame,
  fps,
  durationInFrames,
  ranges,
}: {
  project: SignatureProject;
  L: FrameLayout;
  frame: number;
  fps: number;
  durationInFrames: number;
  ranges: readonly SceneRange[];
}) => {
  const hud = project.globals.hud;
  if (!hud.visible) return null;
  const t = frame / fps;
  const end = durationInFrames / fps;
  const on = progress(t, 0.25, 0.6) * (1 - progress(t, end - 0.5, 0.45));
  const idx = Math.max(0, ranges.findIndex((r) => frame >= r.from && frame < r.from + r.durationInFrames));
  const scene = project.scenes[idx] ?? project.scenes[0];
  const palette = mergePalette(project.theme, scene.palette);
  const color = resolveColor(hud.color, palette);
  const accent = palette.accent;
  const u = L.u * (0.7 + hud.intensity * 0.3);
  const fs = (L.isPortrait ? 19 : 16) * u;
  const inset = { top: L.safe.top * (L.isPortrait ? 0.62 : 0.55), left: L.safe.left * 0.62, right: L.safe.right * 0.62, bottom: L.safe.bottom * (L.isPortrait ? 0.5 : 0.55) };
  const arm = 30 * u;
  const bw = Math.max(1, 2 * L.u);
  const text = {
    position: 'absolute',
    fontFamily: `"${MONO}"`,
    fontSize: fs,
    fontWeight: 500,
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    color,
    whiteSpace: 'pre',
    lineHeight: 1,
  } as const;
  const bracket = (pos: Record<string, number>, sides: [string, string]) => (
    <div style={{ position: 'absolute', width: arm, height: arm, ...pos, [`border${sides[0]}`]: `${bw}px solid ${color}`, [`border${sides[1]}`]: `${bw}px solid ${color}` }} />
  );
  const sceneLabel = `${pad2(idx + 1)} / ${pad2(project.scenes.length)}  ${scene.name}`;
  const prog = frame / Math.max(1, durationInFrames - 1);
  const barW = L.width - inset.left - inset.right - arm * 2 - 40 * u;

  return (
    <div data-lms-target="global.hud" style={{ position: 'absolute', inset: 0, opacity: on * hud.opacity, pointerEvents: 'none' }}>
      {bracket({ left: inset.left, top: inset.top }, ['Left', 'Top'])}
      {bracket({ right: inset.right, top: inset.top }, ['Right', 'Top'])}
      {bracket({ left: inset.left, bottom: inset.bottom }, ['Left', 'Bottom'])}
      {bracket({ right: inset.right, bottom: inset.bottom }, ['Right', 'Bottom'])}
      <div style={{ ...text, left: inset.left + arm + 18 * u, top: inset.top + 4 * u }}>{hud.labelLeft}</div>
      <div style={{ ...text, right: inset.right + arm + 18 * u, top: inset.top + 4 * u, textAlign: 'right' }}>
        {hud.timecode ? timecode(frame, fps) : hud.labelRight}
      </div>
      <div style={{ ...text, left: inset.left + arm + 18 * u, bottom: inset.bottom + 4 * u }}>
        <span style={{ color: accent }}>●</span>
        {`  ${sceneLabel}`}
      </div>
      {hud.timecode ? (
        <div style={{ ...text, right: inset.right + arm + 18 * u, bottom: inset.bottom + 4 * u, textAlign: 'right' }}>{hud.labelRight}</div>
      ) : null}
      {hud.progress ? (
        <div
          style={{
            position: 'absolute',
            left: inset.left + arm + 20 * u,
            width: barW,
            bottom: inset.bottom - 18 * u,
            height: Math.max(1, 1.5 * L.u),
            background: withAlpha(color, 0.18),
          }}
        >
          <div style={{ width: `${round(prog * 100, 3)}%`, height: '100%', background: accent }} />
          {ranges.slice(1).map((r) => (
            <div
              key={r.id}
              style={{ position: 'absolute', left: `${round((r.from / durationInFrames) * 100, 3)}%`, top: -3 * L.u, width: bw, height: 7 * L.u, background: withAlpha(color, 0.5) }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const Finish = ({ project, t }: { project: SignatureProject; t: number }) => {
  const { grain, vignette } = project.globals;
  return (
    <>
      {vignette.visible ? (
        <div
          data-lms-target="global.vignette"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse ${round(120 - vignette.intensity * 25, 2)}% ${round(110 - vignette.intensity * 25, 2)}% at 50% 50%, transparent 45%, ${withAlpha(
              resolveColor(vignette.color, project.theme),
              vignette.opacity,
            )} 100%)`,
          }}
        />
      ) : null}
      {grain.visible ? <Grain t={t} opacity={0.075 * grain.intensity * grain.opacity} seed="signature-grain" /> : null}
    </>
  );
};
