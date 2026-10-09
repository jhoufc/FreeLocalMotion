import { z } from 'zod';
import type { Format } from './formats';
import { formatSchema } from './schema/project';

/** Contracts shared by the local server and the studio client. */

export interface TemplateSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  tags: string[];
  durationSeconds: number;
  formats: Format[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  templateId: string;
  format: Format;
  updatedAt: string;
  createdAt: string;
}

export const createProjectRequestSchema = z.object({
  templateId: z.string().min(1),
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
