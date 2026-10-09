import { mergePalette, resolveColor, withAlpha, type ColorRef, type LayoutOverride, type Theme } from '@lms/shared';
import type { FrameLayout } from '@lms/motion-core';
import type { AnyScene, SignatureProject } from '../schema';

/** Everything a scene needs to draw a frame. Pure data — no hooks hidden inside. */
export interface SceneEnv<S extends AnyScene = AnyScene> {
  project: SignatureProject;
  scene: S;
  index: number;
  palette: Theme;
  layout: FrameLayout;
  override: LayoutOverride;
  /** Scene-local seconds (may exceed `duration` during the outgoing transition tail). */
  t: number;
  duration: number;
  fps: number;
  color: (ref: ColorRef) => string;
  alpha: (ref: ColorRef, a: number) => string;
  /** Editable target id of an element of this instance (`data-lms-target`). */
  target: (key: string) => string;
}

export const createSceneEnv = <S extends AnyScene>(
  project: SignatureProject,
  scene: S,
  index: number,
  layout: FrameLayout,
  t: number,
  fps: number,
): SceneEnv<S> => {
  const palette = mergePalette(project.theme, scene.palette);
  const color = (ref: ColorRef) => resolveColor(ref, palette);
  return {
    project,
    scene,
    index,
    palette,
    layout,
    override: scene.layout[layout.format],
    t,
    duration: scene.duration,
    fps,
    color,
    alpha: (ref, a) => withAlpha(color(ref), a),
    target: (key) => `${scene.id}.${key}`,
  };
};
