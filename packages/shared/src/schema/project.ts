import { z } from 'zod';
import { FORMATS } from '../formats';
import { paletteOverrideSchema, themeSchema } from './color';
import { backgroundSchema, sceneLayoutSchema } from './elements';

/**
 * v1: fixed scene list (one scene per template slot, `id` doubled as the scene type).
 * v2: dynamic scene instances — `type` references a scene definition, `id` is a unique
 *     instance id, `enabled` excludes a scene from the exported duration.
 * v3: `origin` records where a project came from (native template, blank free
 *     composition, user template revision or a template draft).
 */
export const CURRENT_SCHEMA_VERSION = 3 as const;

/** Upper bound on scene instances per project: a technical guard, not a creative one. */
export const MAX_SCENES = 48;

export const sceneIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

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
  /** Unique instance id inside the project. Also the prefix of the scene's target ids. */
  id: sceneIdSchema,
  /** Scene definition (animation) this instance uses. Templates narrow it to literals. */
  type: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  /** Disabled scenes stay in the project but add no frames to the video. */
  enabled: z.boolean(),
  /** Seconds. Frame-rate independent: frames = round(duration * fps). */
  duration: z.number().positive(),
  background: backgroundSchema,
  palette: paletteOverrideSchema,
  layout: sceneLayoutSchema,
};
export const sceneBaseSchema = z.object(sceneBaseShape);
export type MotionSceneBase = z.infer<typeof sceneBaseSchema>;

/**
 * Scene list rules shared by every template: up to MAX_SCENES instances with unique ids.
 * Template projects need at least one enabled scene (a video cannot be empty); free
 * compositions (`allowEmpty`) may start empty — the renderer refuses an empty video.
 */
export const scenesArray = <T extends z.ZodType<{ id: string; enabled: boolean }>>(scene: T, opts: { allowEmpty?: boolean } = {}) =>
  z
    .array(scene)
    .min(opts.allowEmpty ? 0 : 1)
    .max(MAX_SCENES)
    .superRefine((scenes, ctx) => {
      const seen = new Set<string>();
      scenes.forEach((s, i) => {
        if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `Duplicate scene id "${s.id}"` });
        seen.add(s.id);
      });
      if (!opts.allowEmpty && !scenes.some((s) => s.enabled)) ctx.addIssue({ code: 'custom', path: [], message: 'At least one scene must be enabled' });
    });

/** Where a project came from. Informational: projects never stay linked to their source. */
export const projectOriginSchema = z.discriminatedUnion('kind', [
  /** Created from a native (code) template. */
  z.object({ kind: z.literal('template'), templateId: z.string().min(1), version: z.string().min(1) }),
  /** Blank free composition. */
  z.object({ kind: z.literal('blank') }),
  /** Created from a user template; `revision` is the snapshot it was copied from. */
  z.object({ kind: z.literal('user-template'), templateId: z.string().min(1), revision: z.number().int().positive(), name: z.string().max(80) }),
  /** Working copy used to edit a user template; publishing it creates a new revision. */
  z.object({ kind: z.literal('template-draft'), templateId: z.string().min(1), revision: z.number().int().positive(), name: z.string().max(80) }),
]);
export type ProjectOrigin = z.infer<typeof projectOriginSchema>;

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
  origin: projectOriginSchema,
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
  scenes: scenesArray(sceneBaseSchema.loose(), { allowEmpty: true }),
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
