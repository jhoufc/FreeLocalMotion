import type { MotionProject } from '@lms/shared';
import { templateModules } from '@lms/catalog';
import { computeSceneRanges, findSceneIndex } from '@lms/template-sdk';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';

/**
 * Scene composition commands used by the scene list, the timeline and the keyboard.
 * The store owns the document and its history; these only add the editor-side effects
 * (playhead follows the affected scene, confirmation for customized scenes).
 */

/**
 * Moves the playhead to a scene's first frame. Deferred two frames so the Player has
 * already received the new `durationInFrames` (seeking into a scene that was just
 * appended would otherwise be clamped to the old end).
 */
const seekToScene = (sceneId: string) => {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const project = useEditor.getState().project;
      if (!project) return;
      const range = computeSceneRanges(project.scenes, project.fps).find((r) => r.id === sceneId);
      if (range) usePlayback.getState().seek(range.from);
    }),
  );
};

/** Deterministic JSON (sorted keys) so key order never makes two equal scenes differ. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : v,
  );

/** True when an instance differs from its type's defaults (besides id, name and enabled). */
export const isSceneCustomized = (project: MotionProject, sceneId: string): boolean => {
  const scene = project.scenes.find((s) => s.id === sceneId);
  if (!scene) return false;
  const template = templateModules.get(project.templateId);
  const strip = ({ id: _id, name: _name, enabled: _enabled, ...rest }: MotionProject['scenes'][number]) => rest;
  try {
    return stable(strip(scene)) !== stable(strip(template.createScene(scene.type, { id: scene.id, name: scene.name })));
  } catch {
    return true;
  }
};

export const sceneCommands = {
  add(type: string, atIndex?: number, opts: { keepPalette?: boolean } = {}) {
    const id = useEditor.getState().addScene(type, atIndex, opts);
    if (id) seekToScene(id);
    return id;
  },

  duplicate(sceneId: string) {
    const id = useEditor.getState().duplicateScene(sceneId);
    if (id) {
      seekToScene(id);
      useEditor.getState().toast('info', 'Cena duplicada — a cópia é independente da original');
    }
    return id;
  },

  move(sceneId: string, toIndex: number) {
    const id = useEditor.getState().moveScene(sceneId, toIndex);
    if (id) seekToScene(id);
    return id;
  },

  moveBy(sceneId: string, delta: number) {
    const project = useEditor.getState().project;
    if (!project) return null;
    const from = findSceneIndex(project.scenes, sceneId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= project.scenes.length) return null;
    return sceneCommands.move(sceneId, to);
  },

  /**
   * Deletes an instance. Untouched scenes go immediately (Ctrl+Z restores them);
   * scenes with custom content ask first, since that is work the user would lose.
   */
  remove(sceneId: string) {
    const ed = useEditor.getState();
    const project = ed.project;
    const scene = project?.scenes.find((s) => s.id === sceneId);
    if (!project || !scene) return null;
    if (project.scenes.length <= 1 && !templateModules.get(project.templateId).allowEmpty) {
      ed.toast('error', 'O projeto precisa de pelo menos uma cena');
      return null;
    }
    if (isSceneCustomized(project, sceneId) && !confirm(`Excluir a cena “${scene.name}”? Ela tem conteúdo personalizado.\n\nVocê pode desfazer com Ctrl+Z.`)) return null;
    const id = ed.removeScene(sceneId);
    if (id) ed.toast('info', `Cena “${scene.name}” excluída · Ctrl+Z desfaz`);
    return id;
  },

  rename(sceneId: string, name: string) {
    return useEditor.getState().renameScene(sceneId, name);
  },

  toggleEnabled(sceneId: string) {
    const scene = useEditor.getState().project?.scenes.find((s) => s.id === sceneId);
    if (!scene) return null;
    return useEditor.getState().setSceneEnabled(sceneId, !scene.enabled);
  },

  /** Scene of the current selection (a scene or one of its elements). */
  selectedSceneId(): string | null {
    const { project, selectedTargetId } = useEditor.getState();
    if (!project) return null;
    const sceneId = selectedTargetId.split('.')[0]!;
    return project.scenes.some((s) => s.id === sceneId) ? sceneId : null;
  },
};
