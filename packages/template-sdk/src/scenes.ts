import { MAX_SCENES, createId, secondsToFrames, type MotionProject, type MotionSceneBase, type SceneCategory } from '@lms/shared';

/* ------------------------------------------------------------------ */
/* Scene definitions: the reusable animations a template offers.       */
/* ------------------------------------------------------------------ */

/**
 * How a scene adapts its choreography when its duration changes.
 *
 * - `hold`: entrances keep their absolute timing, exits stay anchored to the scene end;
 *   extra time lengthens the sustain between them. The motion itself never changes speed.
 * - `proportional`: the whole choreography runs on a normalized clock scaled to the
 *   duration. Only used inside narrow bounds where the result was art-directed.
 * - `fixed`: the scene has one designed duration (`min === max`).
 */
export type SceneTimingStrategy = 'hold' | 'proportional' | 'fixed';

export interface SceneDurationSpec {
  /** Seconds. */
  default: number;
  min: number;
  max: number;
  strategy: SceneTimingStrategy;
  /** One sentence the editor shows next to the duration control. */
  note: string;
}

/**
 * Data side of a scene type (no React). The template's composition maps `id` to a view;
 * the editor uses this to list, create and constrain instances.
 */
/** Visual family a scene type belongs to (its origin), e.g. "Signature / 001". */
export interface SceneFamily {
  id: string;
  name: string;
}

export interface SceneDefinition {
  /** Stable, global id stored in `scene.type`. */
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  family: SceneFamily;
  /** Semver of the scene type (its data shape and choreography). */
  version: string;
  duration: SceneDurationSpec;
  /** Scene-local seconds where the scene reads best as a still (thumbnails). */
  heroTime: number;
  /**
   * Optional per-instance override of `heroTime`, for scenes whose readable moment depends
   * on their data (e.g. word slots that shrink with the word count). Receives the instance.
   */
  heroTimeOf?: (scene: unknown) => number;
}

export const isDurationEditable = (def: Pick<SceneDefinition, 'duration'>): boolean =>
  def.duration.strategy !== 'fixed' && def.duration.max > def.duration.min;

/**
 * Scene-local frame for a representative still of an instance with the given duration.
 * Pass the instance when available so data-dependent scenes (`heroTimeOf`) pick a readable frame.
 */
export const heroFrameOf = (def: Pick<SceneDefinition, 'duration' | 'heroTime' | 'heroTimeOf'>, duration: number, fps: number, scene?: unknown): number => {
  const t =
    scene !== undefined && def.heroTimeOf
      ? def.heroTimeOf(scene)
      : def.duration.strategy === 'proportional'
        ? (def.heroTime * duration) / def.duration.default
        : def.heroTime;
  return Math.max(0, Math.min(secondsToFrames(duration, fps) - 1, Math.round(Math.min(t, duration * 0.9) * fps)));
};

/* ------------------------------------------------------------------ */
/* Timing: one set of pure functions for editor, preview and render.   */
/* ------------------------------------------------------------------ */

type TimedScene = Pick<MotionSceneBase, 'id' | 'duration'> & { enabled?: boolean };

export interface SceneRange {
  id: string;
  /** Index in `project.scenes` (field paths use it). */
  index: number;
  /** Position among enabled scenes (what the viewer sees: 0 = first scene of the video). */
  order: number;
  from: number;
  durationInFrames: number;
}

/**
 * Sequential frame ranges of the enabled scenes:
 * `from(scene[0]) = 0`, `from(scene[n]) = Σ durationInFrames(enabled scenes before n)`.
 */
export const computeSceneRanges = (scenes: readonly TimedScene[], fps: number): SceneRange[] => {
  let from = 0;
  const out: SceneRange[] = [];
  scenes.forEach((scene, index) => {
    if (scene.enabled === false) return;
    const durationInFrames = secondsToFrames(scene.duration, fps);
    out.push({ id: scene.id, index, order: out.length, from, durationInFrames });
    from += durationInFrames;
  });
  return out;
};

export const totalFrames = (ranges: readonly SceneRange[]): number => ranges.reduce((acc, r) => acc + r.durationInFrames, 0);

/** Total exported frames of a scene list (never below 1). */
export const projectDurationInFrames = (scenes: readonly TimedScene[], fps: number): number =>
  Math.max(1, totalFrames(computeSceneRanges(scenes, fps)));

/** Scene playing at a global frame. Frames past the end resolve to the last scene. */
export const sceneAtFrame = (ranges: readonly SceneRange[], frame: number): SceneRange | undefined =>
  ranges.find((r) => frame >= r.from && frame < r.from + r.durationInFrames) ?? (frame < 0 ? ranges[0] : ranges[ranges.length - 1]);

/** Global frame -> (scene, scene-local frame). */
export const toLocalFrame = (ranges: readonly SceneRange[], frame: number): { range: SceneRange; localFrame: number } | undefined => {
  const range = sceneAtFrame(ranges, frame);
  if (!range) return undefined;
  return { range, localFrame: Math.min(range.durationInFrames - 1, Math.max(0, frame - range.from)) };
};

export const findSceneIndex = (scenes: readonly { id: string }[], id: string): number => scenes.findIndex((s) => s.id === id);

export const findScene = <S extends { id: string }>(scenes: readonly S[], id: string): S | undefined => scenes.find((s) => s.id === id);

/* ------------------------------------------------------------------ */
/* Structural operations. Pure and immutable: they return a new        */
/* project (or throw SceneOperationError) and never share editable     */
/* state between instances.                                            */
/* ------------------------------------------------------------------ */

export class SceneOperationError extends Error {}

type Scenes<P extends MotionProject> = P['scenes'];
type SceneOf<P extends MotionProject> = Scenes<P>[number];

const withScenes = <P extends MotionProject>(project: P, scenes: SceneOf<P>[]): P => ({ ...project, scenes }) as P;

const indexOrThrow = (project: MotionProject, id: string): number => {
  const i = findSceneIndex(project.scenes, id);
  if (i < 0) throw new SceneOperationError(`Scene "${id}" not found`);
  return i;
};

/** New instance id that does not collide with the project's scenes. */
export const createSceneId = (project: Pick<MotionProject, 'scenes'>, type: string): string => {
  const taken = new Set(project.scenes.map((s) => s.id));
  for (;;) {
    const id = `${type}-${createId().slice(0, 6)}`;
    if (!taken.has(id)) return id;
  }
};

const NUMBERED = /^(.*?)(?:\s+#(\d+))?$/;

/** "Impact" -> "Impact #2" (next free number among scenes sharing the base name). */
export const nextSceneName = (project: Pick<MotionProject, 'scenes'>, base: string): string => {
  const root = (NUMBERED.exec(base.trim())?.[1] ?? base).trim() || 'Cena';
  let max = 0;
  for (const s of project.scenes) {
    const m = NUMBERED.exec(s.name.trim());
    if (!m || m[1]!.trim() !== root) continue;
    max = Math.max(max, m[2] ? Number(m[2]) : 1);
  }
  return `${root} #${max + 1}`.slice(0, 60);
};

const assertCapacity = (project: MotionProject) => {
  if (project.scenes.length >= MAX_SCENES) throw new SceneOperationError(`Limite de ${MAX_SCENES} cenas por projeto atingido`);
};

/** Inserts an instance at `index` (default: end). */
export const insertScene = <P extends MotionProject>(project: P, scene: SceneOf<P>, index = project.scenes.length): P => {
  assertCapacity(project);
  if (findSceneIndex(project.scenes, scene.id) >= 0) throw new SceneOperationError(`Scene id "${scene.id}" already exists`);
  const at = Math.max(0, Math.min(project.scenes.length, index));
  const scenes = [...project.scenes] as SceneOf<P>[];
  scenes.splice(at, 0, scene);
  return withScenes(project, scenes);
};

/**
 * Duplicates an instance right after the original: deep copy of every editable value,
 * same `type`, same duration, new id and a numbered name.
 */
export const duplicateScene = <P extends MotionProject>(project: P, id: string, newId?: string): { project: P; scene: SceneOf<P> } => {
  const i = indexOrThrow(project, id);
  const original = project.scenes[i]!;
  const copy = {
    ...structuredClone(original),
    id: newId ?? createSceneId(project, original.type),
    name: nextSceneName(project, original.name),
  } as SceneOf<P>;
  return { project: insertScene(project, copy, i + 1), scene: copy };
};

/** Rules of the scene list. Free compositions may become empty; template projects may not. */
export interface SceneListPolicy {
  allowEmpty?: boolean;
}

export const removeScene = <P extends MotionProject>(project: P, id: string, policy: SceneListPolicy = {}): P => {
  const i = indexOrThrow(project, id);
  const scenes = project.scenes.filter((_, j) => j !== i) as SceneOf<P>[];
  if (!policy.allowEmpty) {
    if (scenes.length === 0) throw new SceneOperationError('O projeto precisa de pelo menos uma cena');
    if (!scenes.some((s) => s.enabled)) throw new SceneOperationError('O vídeo precisa de pelo menos uma cena ativa');
  }
  return withScenes(project, scenes);
};

/** Moves an instance to `toIndex` (index in the resulting list). */
export const moveScene = <P extends MotionProject>(project: P, id: string, toIndex: number): P => {
  const from = indexOrThrow(project, id);
  const to = Math.max(0, Math.min(project.scenes.length - 1, toIndex));
  if (from === to) return project;
  const scenes = [...project.scenes] as SceneOf<P>[];
  const [scene] = scenes.splice(from, 1);
  scenes.splice(to, 0, scene!);
  return withScenes(project, scenes);
};

const patchScene = <P extends MotionProject>(project: P, id: string, patch: Partial<MotionSceneBase>): P => {
  const i = indexOrThrow(project, id);
  const scenes = [...project.scenes] as SceneOf<P>[];
  scenes[i] = { ...scenes[i]!, ...patch } as SceneOf<P>;
  return withScenes(project, scenes);
};

export const renameScene = <P extends MotionProject>(project: P, id: string, name: string): P => {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!clean) throw new SceneOperationError('O nome da cena não pode ficar vazio');
  return patchScene(project, id, { name: clean });
};

/** Sets a duration clamped to the scene definition's limits (rounded to 0.1 s). */
export const setSceneDuration = <P extends MotionProject>(project: P, id: string, seconds: number, def: Pick<SceneDefinition, 'duration'>): P => {
  if (!isDurationEditable(def)) throw new SceneOperationError('Esta cena tem duração fixa');
  const clamped = Math.min(def.duration.max, Math.max(def.duration.min, Math.round(seconds * 10) / 10));
  return patchScene(project, id, { duration: clamped });
};

export const setSceneEnabled = <P extends MotionProject>(project: P, id: string, enabled: boolean, policy: SceneListPolicy = {}): P => {
  const next = patchScene(project, id, { enabled });
  if (!policy.allowEmpty && !next.scenes.some((s) => s.enabled)) throw new SceneOperationError('O vídeo precisa de pelo menos uma cena ativa');
  return next;
};
