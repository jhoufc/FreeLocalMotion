import type { ComponentType } from 'react';
import type { z } from 'zod';
import {
  mergePalette,
  resolveColor,
  withAlpha,
  type Background,
  type ColorRef,
  type Format,
  type FrameLayout,
  type LayoutOverride,
  type MotionProject,
  type MotionSceneBase,
  type SceneCategory,
  type Theme,
} from '@lms/shared';
import type { EditableTarget } from './fields';
import { computeSceneRanges, isDurationEditable, totalFrames, type SceneDefinition, type SceneRange } from './scenes';
import type { TimelineLayer, TimelineModel } from './timeline';

/**
 * Global scene types.
 *
 * A *scene type* is a reusable animation with everything needed to use it anywhere:
 * schema, defaults, editable fields, timeline layers and (in the module) its React view.
 * Templates (Signature / 001) and free compositions resolve scene types by their global id
 * (`scene.type`) through a registry; the same view renders every instance.
 *
 * Scene types are code shipped with the Studio. Projects only store data — there is no
 * way for a project to bring its own code.
 */

export interface SceneTargetContext {
  /** Index of the instance in `project.scenes` (field paths use it). */
  index: number;
  format: Format;
  /** Whether the background field may offer "inherit" (free compositions only). */
  inheritBackground: boolean;
}

export interface SceneLayerContext {
  index: number;
  range: SceneRange;
  fps: number;
}

export interface SceneTypeDefinition<S extends MotionSceneBase = MotionSceneBase> extends SceneDefinition {
  /** Full instance schema (base shape + `type` literal + scene specifics). */
  readonly schema: z.ZodType<S>;
  /** Fresh instance with default values. Must return new objects on every call. */
  create(init: { id: string; name: string }): S;
  /** Inspector targets of one instance (ids `<instance id>[.<element>]`). */
  targets(scene: S, ctx: SceneTargetContext): EditableTarget[];
  /** Timeline layers of one instance, positioned with its range. */
  layers(scene: S, ctx: SceneLayerContext): TimelineLayer[];
  /**
   * Palette the scene was art-directed with. Applied as a per-scene override when the
   * user chooses to keep a scene's original look inside a composition.
   */
  readonly palette?: Partial<Theme>;
}

/** Composition-wide style a scene may inherit (free compositions); templates pass their own. */
export interface CompositionStyle {
  typography: { display: string; text: string; mono: string };
  /** Default background for scenes whose background mode is `inherit`. */
  background: Background | null;
}

/** Everything a scene view needs to draw a frame. Pure data — no hooks hidden inside. */
export interface SceneRuntime<S extends MotionSceneBase = MotionSceneBase> {
  scene: S;
  index: number;
  palette: Theme;
  layout: FrameLayout;
  override: LayoutOverride;
  /** Scene-local seconds (may exceed `duration` during an outgoing transition tail). */
  t: number;
  duration: number;
  fps: number;
  /** The background to paint: `inherit` already resolved against the composition style. */
  background: Background;
  style: CompositionStyle;
  /** False for the first scene of the video (nothing underneath to transition from). */
  hasPrevious: boolean;
  color: (ref: ColorRef) => string;
  alpha: (ref: ColorRef, a: number) => string;
  /** Editable target id of an element of this instance (`data-lms-target`). */
  target: (key: string) => string;
}

export const resolveBackground = (own: Background, style: Pick<CompositionStyle, 'background'>): Background =>
  own.mode !== 'inherit' ? own : (style.background ?? { ...own, mode: 'procedural' });

export const createSceneRuntime = <S extends MotionSceneBase>(args: {
  scene: S;
  index: number;
  theme: Theme;
  layout: FrameLayout;
  t: number;
  fps: number;
  style: CompositionStyle;
  hasPrevious: boolean;
}): SceneRuntime<S> => {
  const { scene, layout } = args;
  const palette = mergePalette(args.theme, scene.palette);
  const color = (ref: ColorRef) => resolveColor(ref, palette);
  return {
    scene,
    index: args.index,
    palette,
    layout,
    override: scene.layout[layout.format],
    t: args.t,
    duration: scene.duration,
    fps: args.fps,
    background: resolveBackground(scene.background, args.style),
    style: args.style,
    hasPrevious: args.hasPrevious,
    color,
    alpha: (ref, a) => withAlpha(color(ref), a),
    target: (key) => `${scene.id}.${key}`,
  };
};

export interface SceneTypeModule<S extends MotionSceneBase = MotionSceneBase> extends SceneTypeDefinition<S> {
  readonly Component: ComponentType<{ env: SceneRuntime<S> }>;
}

export type AnySceneTypeDefinition = SceneTypeDefinition<MotionSceneBase>;
export type AnySceneTypeModule = SceneTypeModule<MotionSceneBase>;

const SCENE_TYPE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Identity helper with definition-time checks (id shape, duration spec). */
export const defineSceneType = <S extends MotionSceneBase>(def: SceneTypeDefinition<S>): SceneTypeDefinition<S> => {
  if (!SCENE_TYPE_ID.test(def.id)) throw new Error(`Invalid scene type id "${def.id}"`);
  const d = def.duration;
  if (!(d.min <= d.default && d.default <= d.max)) throw new Error(`Scene type "${def.id}": default duration outside its limits`);
  if (d.strategy === 'fixed' && d.min !== d.max) throw new Error(`Scene type "${def.id}": fixed duration needs min === max`);
  return def;
};

/** Pairs a scene type with its view. Registries only hand a view instances its schema parsed. */
export const defineSceneModule = <S extends MotionSceneBase>(def: SceneTypeDefinition<S>, Component: ComponentType<{ env: SceneRuntime<S> }>): AnySceneTypeModule =>
  ({ ...def, Component }) as unknown as AnySceneTypeModule;

/** Widens a typed scene definition for registries (sound for the same reason as modules). */
export const asAnySceneType = <S extends MotionSceneBase>(def: SceneTypeDefinition<S>): AnySceneTypeDefinition => def as unknown as AnySceneTypeDefinition;

export class SceneRegistryError extends Error {}

export interface SceneRegistry<T extends AnySceneTypeDefinition> {
  get(id: string): T;
  find(id: string): T | undefined;
  has(id: string): boolean;
  list(): T[];
  /** Categories that have at least one scene type, in the canonical order. */
  categories(): SceneCategory[];
}

const CATEGORY_ORDER: readonly SceneCategory[] = ['typography', 'technology', 'product', 'data', 'abstract', 'editorial', 'signature'];

/**
 * The global scene library. Registration fails early when an id is reused, or when a
 * type's defaults do not pass its own schema (or carry the wrong `type`).
 */
export const createSceneRegistry = <T extends AnySceneTypeDefinition>(types: readonly T[]): SceneRegistry<T> => {
  const byId = new Map<string, T>();
  for (const t of types) {
    if (byId.has(t.id)) throw new SceneRegistryError(`Scene type "${t.id}" is registered twice`);
    const sample = t.create({ id: `registry-${t.id}`, name: t.name });
    const parsed = t.schema.safeParse(sample);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new SceneRegistryError(`Scene type "${t.id}" defaults are invalid: ${i?.path.join('.')}: ${i?.message}`);
    }
    if (sample.type !== t.id) throw new SceneRegistryError(`Scene type "${t.id}" creates instances of type "${sample.type}"`);
    byId.set(t.id, t);
  }
  return {
    get(id) {
      const t = byId.get(id);
      if (!t) throw new SceneRegistryError(`Unknown scene type "${id}"`);
      return t;
    },
    find: (id) => byId.get(id),
    has: (id) => byId.has(id),
    list: () => [...byId.values()],
    categories: () => CATEGORY_ORDER.filter((c) => [...byId.values()].some((t) => t.category === c)),
  };
};

/**
 * Scene blocks + per-scene layers for any project whose scenes are resolved through scene
 * types. Templates append their own global layers (HUD, audio…).
 */
export const sceneSequenceTimeline = (
  project: Pick<MotionProject, 'scenes' | 'fps'>,
  typeOf: (type: string) => AnySceneTypeDefinition,
): Omit<TimelineModel, 'fps'> => {
  const ranges = computeSceneRanges(project.scenes, project.fps);
  const layers: TimelineLayer[] = [];
  for (const range of ranges) {
    const scene = project.scenes[range.index]!;
    layers.push(...typeOf(scene.type).layers(scene, { index: range.index, range, fps: project.fps }));
  }
  return {
    durationInFrames: totalFrames(ranges),
    layers,
    scenes: ranges.map((range) => {
      const scene = project.scenes[range.index]!;
      const def = typeOf(scene.type);
      return {
        id: scene.id,
        label: scene.name,
        index: range.order,
        typeId: scene.type,
        typeLabel: def.name,
        from: range.from,
        durationInFrames: range.durationInFrames,
        targetId: scene.id,
        ...(isDurationEditable(def) ? { duration: { path: ['scenes', range.index, 'duration'], min: def.duration.min, max: def.duration.max } } : {}),
      };
    }),
  };
};
