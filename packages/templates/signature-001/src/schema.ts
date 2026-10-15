import { z } from 'zod';
import { graphicElementSchema, projectBaseShape, sceneBaseShape, scenesArray, textElementSchema } from '@lms/shared';

export const TEMPLATE_ID = 'signature-001';
/**
 * 1.0.0: fixed sequence of four scenes.
 * 1.1.0: scenes are instances of four scene types (any order, repeatable).
 */
export const TEMPLATE_VERSION = '1.1.0';

export const animationSchema = z.object({
  /** Overshoot / amplitude of the choreography. 0 = restrained, 1 = designed, 1.5 = punchy. */
  intensity: z.number().min(0).max(1.5),
  /** Entrance speed multiplier. Exits stay anchored to the scene end. */
  pace: z.number().min(0.75).max(1.35),
});
export type SceneAnimation = z.infer<typeof animationSchema>;

/** Duration bounds per scene type (seconds). Also used by the timeline drag handles. */
export const SCENE_DURATION_LIMITS = {
  impact: { min: 2.4, max: 7 },
  energy: { min: 2.4, max: 8 },
  transformation: { min: 3.2, max: 6 },
  signature: { min: 4, max: 10 },
} as const;

const durationFor = (id: keyof typeof SCENE_DURATION_LIMITS) =>
  z.number().min(SCENE_DURATION_LIMITS[id].min).max(SCENE_DURATION_LIMITS[id].max);

export const impactSceneSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('impact'),
  duration: durationFor('impact'),
  texts: z.object({ kicker: textElementSchema, lineA: textElementSchema, lineB: textElementSchema }),
  elements: z.object({ lightLine: graphicElementSchema, geometry: graphicElementSchema, particles: graphicElementSchema }),
  animation: animationSchema,
});

export const energySceneSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('energy'),
  duration: durationFor('energy'),
  texts: z.object({ lead: textElementSchema, headline: textElementSchema }),
  elements: z.object({
    core: graphicElementSchema,
    rings: graphicElementSchema,
    grid: graphicElementSchema,
    orbiters: graphicElementSchema,
  }),
  animation: animationSchema,
  props: z.object({
    /** Core pulses per second. */
    pulseRate: z.number().min(0.6).max(3),
  }),
});

export const transformationSceneSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('transformation'),
  duration: durationFor('transformation'),
  texts: z.object({ word1: textElementSchema, word2: textElementSchema, word3: textElementSchema }),
  elements: z.object({
    frames: graphicElementSchema,
    morph: graphicElementSchema,
    guides: graphicElementSchema,
  }),
  animation: animationSchema,
});

export const signatureSceneSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('signature'),
  duration: durationFor('signature'),
  texts: z.object({ headline: textElementSchema, subtitle: textElementSchema }),
  elements: z.object({
    markRing: graphicElementSchema,
    markDiamond: graphicElementSchema,
    markCore: graphicElementSchema,
    shards: graphicElementSchema,
  }),
  animation: animationSchema,
  props: z.object({
    /** Index of the headline word painted with the accent color (-1 = none). */
    highlightWord: z.number().int().min(-1).max(40),
  }),
});

export const globalsSchema = z.object({
  hud: graphicElementSchema.extend({
    labelLeft: z.string().max(40),
    labelRight: z.string().max(40),
    timecode: z.boolean(),
    progress: z.boolean(),
  }),
  grain: graphicElementSchema,
  vignette: graphicElementSchema,
});

export const signatureProjectSchema = z.object({
  ...projectBaseShape,
  templateId: z.literal(TEMPLATE_ID),
  /** Ordered scene instances. Any type, any order, any number of repetitions. */
  scenes: scenesArray(z.discriminatedUnion('type', [impactSceneSchema, energySceneSchema, transformationSceneSchema, signatureSceneSchema])),
  globals: globalsSchema,
});

export type SignatureProject = z.infer<typeof signatureProjectSchema>;
export type ImpactScene = z.infer<typeof impactSceneSchema>;
export type EnergyScene = z.infer<typeof energySceneSchema>;
export type TransformationScene = z.infer<typeof transformationSceneSchema>;
export type SignatureScene = z.infer<typeof signatureSceneSchema>;
export type SignatureGlobals = z.infer<typeof globalsSchema>;
export type AnyScene = SignatureProject['scenes'][number];
export type SceneType = AnyScene['type'];
export const SCENE_TYPES = ['impact', 'energy', 'transformation', 'signature'] as const satisfies readonly SceneType[];
