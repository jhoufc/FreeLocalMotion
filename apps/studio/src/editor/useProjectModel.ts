import { useMemo } from 'react';
import type { MotionProject } from '@lms/shared';
import { templateModules } from '@lms/catalog';
import { computeSceneRanges, type AnyTemplateModule, type EditableTarget, type SceneRange, type TimelineModel } from '@lms/template-sdk';

export interface ProjectModel {
  template: AnyTemplateModule;
  targets: EditableTarget[];
  targetsById: Map<string, EditableTarget>;
  timeline: TimelineModel;
  ranges: SceneRange[];
  durationInFrames: number;
  width: number;
  height: number;
  fps: number;
}

/**
 * Everything the editor derives from a project comes from the template contract —
 * the editor itself never knows which template it is editing.
 */
export const useProjectModel = (project: MotionProject): ProjectModel =>
  useMemo(() => {
    const template = templateModules.get(project.templateId);
    const targets = template.getEditableTargets(project);
    const meta = template.getMetadata(project);
    return {
      template,
      targets,
      targetsById: new Map(targets.map((t) => [t.id, t])),
      timeline: template.getTimeline(project),
      ranges: computeSceneRanges(project.scenes, project.fps),
      durationInFrames: meta.durationInFrames,
      width: meta.width,
      height: meta.height,
      fps: meta.fps,
    };
  }, [project]);

/** Same pure function the composition's HUD uses (re-exported for editor modules). */
export { sceneAtFrame } from '@lms/template-sdk';

export const formatTime = (frame: number, fps: number): string => {
  const total = frame / fps;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const f = frame % fps;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
};
