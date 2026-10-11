import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeFrameLayout, type FrameLayout } from '@lms/motion-core';
import { computeSceneRanges, createSceneRuntime, defineTemplateModule, type CompositionStyle, type TemplateComponentProps } from '@lms/template-sdk';
import { FinishOverlays, MONO, Soundtrack, TEXT, TYPEFACES, kitFonts } from '@lms/scene-kit';
import { sceneModules } from '../sceneModules';
import { compositionDefinition, type CompositionProject } from './definition';

const styleOf = (project: CompositionProject): CompositionStyle => ({
  typography: { display: TYPEFACES[project.globals.style.typeface].family, text: TEXT, mono: MONO },
  background: project.globals.style.background,
});

/**
 * One instance. Inside its <Sequence> the frame is local, so every scene animates from
 * its own start wherever it is placed — and the same view serves every instance.
 */
const SceneHost = ({ project, index, hasPrevious, L, style }: { project: CompositionProject; index: number; hasPrevious: boolean; L: FrameLayout; style: CompositionStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = project.scenes[index]!;
  const module = sceneModules.find(scene.type);
  if (!module) return null;
  const env = createSceneRuntime({ scene, index, theme: project.theme, layout: L, t: frame / fps, fps, style, hasPrevious });
  const View = module.Component;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <View env={env} />
    </AbsoluteFill>
  );
};

/**
 * Free compositions cut directly between scenes: no frame overlap, so the exported
 * duration is exactly the sum of the enabled scenes.
 */
export const FreeComposition = ({ project }: TemplateComponentProps<CompositionProject>) => {
  kitFonts.useReady();
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const L = computeFrameLayout(width, height);
  const ranges = computeSceneRanges(project.scenes, fps);
  const style = styleOf(project);
  return (
    <AbsoluteFill style={{ background: project.theme.background, overflow: 'hidden' }}>
      {ranges.map((r) => {
        const scene = project.scenes[r.index]!;
        return (
          <Sequence key={scene.id} from={r.from} durationInFrames={r.durationInFrames} name={scene.name} layout="none">
            <SceneHost project={project} index={r.index} hasPrevious={r.order > 0} L={L} style={style} />
          </Sequence>
        );
      })}
      {ranges.length > 0 && <FinishOverlays grain={project.globals.grain} vignette={project.globals.vignette} theme={project.theme} t={frame / fps} />}
      {ranges.length > 0 && <Soundtrack audio={project.audio} durationInFrames={durationInFrames} />}
    </AbsoluteFill>
  );
};

export const compositionTemplate = defineTemplateModule(compositionDefinition, FreeComposition);
