import { z } from 'zod';
import { FORMATS } from '../formats';
import { paletteOverrideSchema, themeSchema } from './color';
import { backgroundSchema, sceneLayoutSchema } from './elements';

export const CURRENT_SCHEMA_VERSION = 1 as const;

export const formatSchema = z.enum(FORMATS);
export const fpsSchema = z.union([z.literal(30), z.literal(60)]);

export const ASSET_KINDS = ['image', 'audio'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const assetIdSchema = z.string().regex(/^[a-z0-9-]{6,64}$/);

export const assetRefSchema = z.object({
  id: assetIdSchema,
  kind: z.enum(ASSET_KINDS),
  /** File name inside `projects/<projectId>/assets/`. */
  fileName: z.string().regex(/^[a-zA-Z0-9._-]+$/),
  originalName: z.string().max(255),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type AssetRef = z.infer<typeof assetRefSchema>;

export const audioSettingsSchema = z.object({
  assetId: z.string().nullable(),
  volume: z.number().min(0).max(1),
  fadeIn: z.number().min(0).max(5),
  fadeOut: z.number().min(0).max(5),
});
export type AudioSettings = z.infer<typeof audioSettingsSchema>;

/**
 * Fields every scene has, regardless of template. Templates extend this with their own
 * `texts`, `elements`, `animation` and `props` shapes.
 */
export const sceneBaseShape = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  /** Seconds. Frame-rate independent: frames = round(duration * fps). */
  duration: z.number().positive(),
  background: backgroundSchema,
  palette: paletteOverrideSchema,
  layout: sceneLayoutSchema,
};
export const sceneBaseSchema = z.object(sceneBaseShape);
export type MotionSceneBase = z.infer<typeof sceneBaseSchema>;

export const projectBaseShape = {
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9-]{6,64}$/),
  name: z.string().min(1).max(80),
  templateId: z.string().min(1),
  templateVersion: z.string().min(1),
  format: formatSchema,
  fps: fpsSchema,
  theme: themeSchema,
  audio: audioSettingsSchema,
  assets: z.array(assetRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
};

/**
 * The template-agnostic envelope. The editor, server and renderer can rely on these
 * fields for any template; everything inside `scenes[*]` beyond the base shape, and
 * `globals`, belongs to the template's own schema.
 */
export const motionProjectSchema = z.object({
  ...projectBaseShape,
  scenes: z.array(sceneBaseSchema.loose()).min(1),
  globals: z.record(z.string(), z.unknown()),
});
export type MotionProject = z.infer<typeof motionProjectSchema>;

/** Collects every `assetId` referenced anywhere in a project (excluding the asset list itself). */
export const collectAssetIds = (value: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    for (const v of value) collectAssetIds(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'assetId' && typeof v === 'string') out.add(v);
      else if (k !== 'assets') collectAssetIds(v, out);
    }
  }
  return out;
};

/** Asset ids referenced by the project but missing from `project.assets`. */
export const findMissingAssets = (project: { assets: readonly AssetRef[] }): string[] => {
  const known = new Set(project.assets.map((a) => a.id));
  return [...collectAssetIds(project)].filter((id) => !known.has(id));
};
