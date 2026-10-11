import { z } from 'zod';
import type { Format } from './formats';
import { formatSchema, type ProjectOrigin } from './schema/project';

/** Contracts shared by the local server and the studio client. */

/** Scene library categories (also used to classify user templates). */
export const SCENE_CATEGORIES = ['typography', 'technology', 'product', 'data', 'abstract', 'editorial', 'signature'] as const;
export type SceneCategory = (typeof SCENE_CATEGORIES)[number];
export const SCENE_CATEGORY_LABELS: Record<SceneCategory, string> = {
  typography: 'Typography',
  technology: 'Technology',
  product: 'Product',
  data: 'Data',
  abstract: 'Abstract',
  editorial: 'Editorial',
  signature: 'Signature',
};

export interface TemplateSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  tags: string[];
  durationSeconds: number;
  formats: Format[];
  /** `free`: the blank free-composition engine (not a fixed storyboard). */
  mode: 'template' | 'free';
}

export interface ProjectSummary {
  id: string;
  name: string;
  templateId: string;
  format: Format;
  origin: ProjectOrigin | null;
  sceneCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface StarterSummary {
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  sceneCount: number;
  durationSeconds: number;
}

/* ---------------- user templates ---------------- */

export const userTemplateIdSchema = z.string().regex(/^t-[a-z0-9]{6,32}$/);

export interface UserTemplateRevision {
  revision: number;
  createdAt: string;
  sceneCount: number;
  durationSeconds: number;
  /** Thumbnail file name (inside the template folder) once generated. */
  thumbnail: string | null;
}

export interface UserTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  /** Current (latest published) revision. */
  revision: number;
  revisions: UserTemplateRevision[];
  format: Format;
  sceneCount: number;
  durationSeconds: number;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

export const saveTemplateRequestSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(280).default(''),
  category: z.enum(SCENE_CATEGORIES),
});
export type SaveTemplateRequest = z.input<typeof saveTemplateRequestSchema>;

export const updateTemplateRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(280).optional(),
  category: z.enum(SCENE_CATEGORIES).optional(),
});
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>;

export const createFromTemplateRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  format: formatSchema.optional(),
});
export type CreateFromTemplateRequest = z.infer<typeof createFromTemplateRequestSchema>;

export const publishRevisionRequestSchema = z.object({ projectId: z.string().min(1) });

export const createProjectRequestSchema = z.object({
  templateId: z.string().min(1),
  /** Start from a ready-made composition (free-composition template only). */
  starterId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(80).optional(),
  format: formatSchema.optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const RENDER_STAGES = [
  'queued',
  'validating',
  'snapshot',
  'assets',
  'bundling',
  'composition',
  'rendering',
  'encoding',
  'saving',
  'done',
] as const;
export type RenderStage = (typeof RENDER_STAGES)[number];

export const RENDER_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

export const createRenderRequestSchema = z.object({
  projectId: z.string().min(1),
  /** Defaults to the project's current format. */
  format: formatSchema.optional(),
  /** Optional in-memory edits to render instead of the saved file (snapshotted on submit). */
  project: z.unknown().optional(),
  /** Debug aid: render a sub-range of frames, inclusive. */
  frameRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
});
export type CreateRenderRequest = z.infer<typeof createRenderRequestSchema>;

export interface RenderJob {
  id: string;
  projectId: string;
  projectName: string;
  templateId: string;
  format: Format;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  status: RenderStatus;
  stage: RenderStage;
  /** 0..1, real progress reported by the renderer (frames rendered + encoded). */
  progress: number;
  renderedFrames: number;
  encodedFrames: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Absolute path on disk of the exported file once finished. */
  outputPath: string | null;
  outputFileName: string | null;
  outputSize: number | null;
  error: string | null;
  log: string[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}
