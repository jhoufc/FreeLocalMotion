import { progress, round, type FrameLayout } from '@lms/motion-core';
import { mergePalette, resolveColor, withAlpha } from '@lms/shared';
import { sceneAtFrame, type SceneRange } from '@lms/template-sdk';
import type { SignatureProject } from '../schema';
import { FinishOverlays, MONO } from '@lms/scene-kit';

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
  const range = sceneAtFrame(ranges, frame);
  const idx = range?.order ?? 0;
  const scene = project.scenes[range?.index ?? 0] ?? project.scenes[0]!;
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
  // Scene names are user-defined (up to 60 chars): fit the bottom-left label to the room
  // left by the bottom-right label. Mono font → each glyph advances 0.6em + 0.24em tracking.
  const charW = fs * 0.84;
  const labelX = arm + 18 * u;
  const rightChars = hud.timecode ? hud.labelRight.length + 3 : 0;
  // 6 = "●  " prefix + a 3-glyph gap before the right label.
  const maxChars = Math.max(8, Math.floor((L.width - inset.left - inset.right - labelX * 2) / charW) - rightChars - 6);
  const fullLabel = `${pad2(idx + 1)} / ${pad2(ranges.length)}  ${scene.name}`;
  const sceneLabel = fullLabel.length > maxChars ? `${fullLabel.slice(0, maxChars - 1).trimEnd()}…` : fullLabel;
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

export const Finish = ({ project, t }: { project: SignatureProject; t: number }) => (
  <FinishOverlays grain={project.globals.grain} vignette={project.globals.vignette} theme={project.theme} t={t} seed="signature-grain" />
);
