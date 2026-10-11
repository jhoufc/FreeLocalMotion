import { memo, useMemo, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import type { MotionProject } from '@lms/shared';
import { TemplateStage, templateModules, type StageProps } from '@lms/catalog';
import { heroFrameOf, type SceneDefinition } from '@lms/template-sdk';

type Scene = MotionProject['scenes'][number];

/**
 * Still of one scene instance, rendered alone (its own one-scene composition) so the
 * thumbnail does not depend on neighbours, transitions or whether the scene is enabled.
 */
export const SceneStill = memo(({ project, scene, def, portrait }: { project: MotionProject; scene: Scene; def: SceneDefinition; portrait: boolean }) => {
  const template = templateModules.get(project.templateId);
  const solo = useMemo<MotionProject>(() => ({ ...project, scenes: [{ ...scene, enabled: true }] }), [project, scene]);
  const meta = template.getMetadata(solo);
  const inputProps = useMemo<StageProps>(() => ({ project: solo, assetBaseUrl: '' }), [solo]);
  return (
    <div className={`thumb ${portrait ? 'portrait' : ''}`}>
      <Thumbnail
        component={TemplateStage}
        inputProps={inputProps}
        compositionWidth={meta.width}
        compositionHeight={meta.height}
        durationInFrames={meta.durationInFrames}
        fps={meta.fps}
        frameToDisplay={heroFrameOf(def, scene.duration, meta.fps, scene)}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});


/** Still that turns into a looping live preview while hovered (scene library). */
export const ScenePreview = memo(({ project, scene, def, portrait }: { project: MotionProject; scene: Scene; def: SceneDefinition; portrait: boolean }) => {
  const [hover, setHover] = useState(false);
  const template = templateModules.get(project.templateId);
  const solo = useMemo<MotionProject>(() => ({ ...project, scenes: [{ ...scene, enabled: true }] }), [project, scene]);
  const meta = template.getMetadata(solo);
  const inputProps = useMemo<StageProps>(() => ({ project: solo, assetBaseUrl: '' }), [solo]);
  const common = {
    component: TemplateStage,
    inputProps,
    compositionWidth: meta.width,
    compositionHeight: meta.height,
    durationInFrames: meta.durationInFrames,
    fps: meta.fps,
    style: { width: '100%', height: '100%' },
  };
  return (
    <div className={`thumb ${portrait ? 'portrait' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {hover ? (
        <Player {...common} autoPlay loop controls={false} acknowledgeRemotionLicense />
      ) : (
        <Thumbnail {...common} frameToDisplay={heroFrameOf(def, scene.duration, meta.fps, scene)} />
      )}
    </div>
  );
});
