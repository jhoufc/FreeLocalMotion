import { z } from 'zod';
import {
  createBackground,
  emptyPaletteOverride,
  type FieldPath,
  type GraphicElement,
  type LineBreakMode,
  type MotionSceneBase,
  type SceneCategory,
  type SceneLayout,
  type TextElement,
  type Theme,
} from '@lms/shared';
import { defineSceneType, type FieldDescriptor, type SceneFamily, type SceneTypeDefinition } from '@lms/template-sdk';
import { choreoLayers, instanceTargets, sceneSections, standardAnimationFields, type ChoreoEntry, type GraphicMeta, type TextMeta } from './fields';

/**
 * Shared data helpers for scene families (Node-safe). Each scene declares its
 * choreography once — entrance times per element — and both the view and the timeline
 * read it, so the timeline always shows what the video does.
 */

export const animationSchema = z.object({
  /** Overshoot / amplitude. 0 = restrained, 1 = designed, 1.5 = punchy. */
  intensity: z.number().min(0).max(1.5),
  /** Entrance speed multiplier. Exits stay anchored to the scene end. */
  pace: z.number().min(0.75).max(1.35),
});
export type SceneAnimation = z.infer<typeof animationSchema>;

/** Entrance start (scene seconds) with pace and the user's delay applied. */
export const at = (base: number, animation: SceneAnimation, delay = 0): number => base / animation.pace + delay;

export const text = (
  content: string,
  opts: Partial<Omit<TextElement, 'breaks'>> & { breaks?: [LineBreakMode, LineBreakMode] } = {},
): TextElement => {
  const { breaks = ['manual', 'manual'], ...rest } = opts;
  return {
    visible: true,
    content,
    color: '$foreground',
    weight: 900,
    italic: false,
    uppercase: true,
    stretch: 'normal',
    sizeScale: 1,
    tracking: -0.02,
    delay: 0,
    ...rest,
    breaks: { portrait: breaks[0], landscape: breaks[1] },
  };
};

export const graphic = (color: string, opacity = 1, intensity = 1): GraphicElement => ({ visible: true, color, opacity, intensity });

export const layout = (portrait: SceneLayout['portrait']['align'], landscape: SceneLayout['landscape']['align']): SceneLayout => ({
  portrait: { align: portrait, scale: 1, offsetX: 0, offsetY: 0 },
  landscape: { align: landscape, scale: 1, offsetX: 0, offsetY: 0 },
});

/** Common instance fields of a premium scene (background, palette, layout, animation). */
export const baseInstance = (variant: string, align: [SceneLayout['portrait']['align'], SceneLayout['landscape']['align']], background?: Partial<{ base: string; intensity: number }>) => ({
  enabled: true,
  background: createBackground({ variant, ...(background ?? {}) }),
  palette: emptyPaletteOverride(),
  layout: layout(align[0], align[1]),
  animation: { intensity: 1, pace: 1 },
});

export interface ChoreoMeta {
  /** Entrance start, scene seconds before pace. */
  in: number;
  /** Entrance duration (seconds) until the element has settled. */
  dur: number;
}

export type FamilyScene = MotionSceneBase & {
  texts: Record<string, TextElement>;
  elements: Record<string, GraphicElement>;
  animation: SceneAnimation;
};

export interface FamilySceneConfig<S> {
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  heroTime: number;
  /** Per-instance representative moment (see `SceneDefinition.heroTimeOf`). */
  heroTimeOf?: (scene: S) => number;
  duration: { default: number; min: number; max: number };
  schema: z.ZodType<S>;
  create: (init: { id: string; name: string }) => S;
  texts: Record<string, TextMeta & ChoreoMeta>;
  graphics: Record<string, GraphicMeta & ChoreoMeta>;
  /** Seconds before the scene end at which the exit starts. */
  exit: number;
  contentFields?: (base: FieldPath, scene: S) => FieldDescriptor[];
  animationFields?: (base: FieldPath, scene: S) => FieldDescriptor[];
  palette: Partial<Theme>;
}

/**
 * Returns a scene-type builder bound to a family: schema + defaults + inspector targets
 * (shared kit sections) + timeline layers from the scene's choreography table.
 */
export const familySceneType = (family: SceneFamily, version: string) => <S extends FamilyScene>(cfg: FamilySceneConfig<S>): SceneTypeDefinition<S> => {
  const def = {
    id: cfg.id,
    name: cfg.name,
    description: cfg.description,
    category: cfg.category,
    family,
    version,
    heroTime: cfg.heroTime,
    ...(cfg.heroTimeOf ? { heroTimeOf: cfg.heroTimeOf as (scene: unknown) => number } : {}),
    duration: {
      ...cfg.duration,
      strategy: 'hold' as const,
      note: 'Entradas mantêm o timing desenhado e a saída fica ancorada ao fim: a duração extra estende a sustentação.',
    },
  };
  return defineSceneType<S>({
    ...def,
    schema: cfg.schema,
    palette: cfg.palette,
    create: cfg.create,
    targets: (scene, ctx) => {
      const base = ['scenes', ctx.index] as const;
      return instanceTargets({
        scene,
        index: ctx.index,
        description: cfg.description,
        sections: sceneSections({
          base,
          def,
          format: ctx.format,
          inheritBackground: ctx.inheritBackground,
          contentFields: cfg.contentFields?.(base, scene) ?? [],
          animationFields: [...standardAnimationFields(base, def), ...(cfg.animationFields?.(base, scene) ?? [])],
        }),
        texts: cfg.texts,
        graphics: cfg.graphics,
        textDelayMax: 1,
      });
    },
    layers: (scene, ctx) => {
      const entries: ChoreoEntry[] = [];
      for (const [key, meta] of Object.entries(cfg.texts)) {
        const el = scene.texts[key];
        if (!el) continue;
        const start = at(meta.in, scene.animation, el.delay);
        entries.push({
          key,
          label: meta.label,
          kind: 'text',
          start,
          settle: start + meta.dur / scene.animation.pace,
          visible: el.visible,
          delay: { path: ['scenes', ctx.index, 'texts', key, 'delay'], max: 1 },
        });
      }
      for (const [key, meta] of Object.entries(cfg.graphics)) {
        const el = scene.elements[key];
        if (!el) continue;
        const start = at(meta.in, scene.animation);
        entries.push({ key, label: meta.label, kind: 'graphic', start, settle: start + meta.dur / scene.animation.pace, visible: el.visible });
      }
      return choreoLayers(scene, ctx, entries, cfg.exit);
    },
  });
};
