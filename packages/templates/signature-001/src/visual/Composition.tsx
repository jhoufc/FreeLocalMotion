import type { ComponentType, ReactNode } from 'react';
import { AbsoluteFill, Html5Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeFrameLayout, ease, progress, round, type FrameLayout } from '@lms/motion-core';
import { withAlpha } from '@lms/shared';
import { computeSceneRanges, useAssets, type TemplateComponentProps } from '@lms/template-sdk';
import type { AnyScene, SceneType, SignatureProject } from '../schema';
import { TRANSITION_IN, nextSceneTransition } from '../timing';
import { energyCore } from './art';
import { createSceneEnv, type SceneEnv } from './context';
import { signatureFonts } from './fonts';
import { Finish, Hud } from './Overlays';
import { EnergySceneView } from './scenes/Energy';
import { ImpactSceneView } from './scenes/Impact';
import { SignatureSceneView } from './scenes/Signature';
import { TransformationSceneView } from './scenes/Transformation';

/**
 * Scene type -> view. A view is the reusable animation; every instance of the type mounts
 * it with its own data. Adding a scene type means adding one entry here.
 */
const VIEWS: { [K in SceneType]: ComponentType<{ env: SceneEnv<Extract<AnyScene, { type: K }>> }> } = {
  impact: ImpactSceneView,
  energy: EnergySceneView,
  transformation: TransformationSceneView,
  signature: SignatureSceneView,
};

/** Transition-in treatments, composited over the previous scene's tail. */
const transitionIn = (id: SceneType, t: number, L: FrameLayout, accent: string): { clip?: string; edge?: ReactNode } => {
  const dur = TRANSITION_IN[id];
  if (dur <= 0 || t >= dur) return {};
  if (id === 'transformation') {
    // Iris that opens from the energy core: we fly *through* the core.
    const c = energyCore(L);
    const maxR = Math.hypot(Math.max(c.x, L.width - c.x), Math.max(c.y, L.height - c.y));
    const r = progress(t, 0, dur, ease.inOutQuart) * maxR * 1.02;
    return {
      clip: `circle(${round(r, 2)}px at ${round(c.x, 2)}px ${round(c.y, 2)}px)`,
      edge: (
        <div
          style={{
            position: 'absolute',
            left: c.x - r,
            top: c.y - r,
            width: r * 2,
            height: r * 2,
            borderRadius: '50%',
            border: `${round(3 * L.u, 2)}px solid ${accent}`,
            boxShadow: `0 0 ${round(40 * L.u)}px ${withAlpha(accent, 0.6)}, inset 0 0 ${round(40 * L.u)}px ${withAlpha(accent, 0.35)}`,
            pointerEvents: 'none',
          }}
        />
      ),
    };
  }
  if (id === 'signature') {
    // The light line returns as a wipe: the film's motif closes the story.
    const p = progress(t, 0, dur, ease.inOutQuart);
    const vertical = !L.isPortrait;
    const pos = p * (vertical ? L.width : L.height);
    const th = 3 * L.u;
    return {
      clip: vertical ? `inset(0 ${round(L.width - pos, 2)}px 0 0)` : `inset(0 0 ${round(L.height - pos, 2)}px 0)`,
      edge: (
        <div
          style={{
            position: 'absolute',
            ...(vertical ? { left: pos - th / 2, top: 0, width: th, height: L.height } : { top: pos - th / 2, left: 0, height: th, width: L.width }),
            background: '#FFFFFF',
            boxShadow: `0 0 ${round(20 * L.u)}px ${round(4 * L.u)}px ${withAlpha(accent, 0.9)}, 0 0 ${round(90 * L.u)}px ${round(16 * L.u)}px ${withAlpha(accent, 0.45)}`,
            pointerEvents: 'none',
          }}
        />
      ),
    };
  }
  return {};
};

/**
 * Hosts one scene instance. Inside its <Sequence>, `useCurrentFrame()` is local to the
 * instance, so a scene animates identically wherever it sits on the timeline.
 */
const SceneHost = ({ project, index, hasPrevious, L }: { project: SignatureProject; index: number; hasPrevious: boolean; L: FrameLayout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = project.scenes[index]!;
  const t = frame / fps;
  const env = createSceneEnv(project, scene, index, L, t, fps);
  const View = VIEWS[scene.type] as ComponentType<{ env: SceneEnv }>;
  // The opening scene has nothing underneath to transition from.
  const tr = hasPrevious ? transitionIn(scene.type, t, L, env.palette.accent) : {};
  return (
    <AbsoluteFill style={{ clipPath: tr.clip, overflow: 'hidden' }}>
      <View env={env} />
      {tr.edge}
    </AbsoluteFill>
  );
};

const Soundtrack = ({ project, durationInFrames }: { project: SignatureProject; durationInFrames: number }) => {
  const assets = useAssets();
  const { fps } = useVideoConfig();
  const src = assets.url(project.audio.assetId);
  if (!src) return null;
  const { volume, fadeIn, fadeOut } = project.audio;
  const fi = Math.max(1, Math.round(fadeIn * fps));
  const fo = Math.max(1, Math.round(fadeOut * fps));
  return (
    <Html5Audio
      src={src}
      volume={(f) =>
        volume *
        Math.min(
          interpolate(f, [0, fi], [fadeIn > 0 ? 0 : 1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          interpolate(f, [durationInFrames - fo, durationInFrames], [1, fadeOut > 0 ? 0 : 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        )
      }
    />
  );
};

export const SignatureComposition = ({ project }: TemplateComponentProps<SignatureProject>) => {
  signatureFonts.useReady();
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const L = computeFrameLayout(width, height);
  const ranges = computeSceneRanges(project.scenes, fps);
  const sequence = ranges.map((r) => project.scenes[r.index]!);

  return (
    <AbsoluteFill style={{ background: project.theme.background, overflow: 'hidden' }}>
      {ranges.map((r) => {
        const scene = project.scenes[r.index]!;
        const tail = Math.round(nextSceneTransition(sequence, r.order) * fps);
        return (
          <Sequence key={scene.id} from={r.from} durationInFrames={r.durationInFrames + tail} name={scene.name} layout="none">
            <SceneHost project={project} index={r.index} hasPrevious={r.order > 0} L={L} />
          </Sequence>
        );
      })}
      <Finish project={project} t={frame / fps} />
      <Hud project={project} L={L} frame={frame} fps={fps} durationInFrames={durationInFrames} ranges={ranges} />
      <Soundtrack project={project} durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};
