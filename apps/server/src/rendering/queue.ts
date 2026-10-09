import fs from 'node:fs/promises';
import path from 'node:path';
import { createId, FORMAT_SPECS, slugify, type Format, type MotionProject, type RenderJob } from '@lms/shared';
import type { AnyTemplateDefinition, TemplateRegistry } from '@lms/template-sdk';
import { HttpError, type ProjectStore } from '../projects/store';
import { readJson, writeJsonAtomic } from '../storage/files';
import { RenderCancelledError, type RenderEngine } from './engine';

interface Pending {
  job: RenderJob;
  snapshot: MotionProject;
  frameRange?: [number, number];
  cancel: () => void;
  cancelled: Promise<void>;
}

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/**
 * Render job queue. Jobs run one at a time (rendering already uses all cores),
 * asynchronously from the HTTP request that created them. State is persisted to
 * `exports/jobs.json` so the export history survives server restarts.
 */
export class RenderQueue {
  private readonly jobs = new Map<string, RenderJob>();
  private readonly pending: Pending[] = [];
  private active: Pending | null = null;
  private persistTimer: NodeJS.Timeout | null = null;
  private persisting: Promise<void> = Promise.resolve();

  constructor(
    private readonly opts: {
      engine: RenderEngine;
      store: ProjectStore;
      templates: TemplateRegistry<AnyTemplateDefinition>;
      exportsDir: string;
      assetBaseUrl: () => string;
    },
  ) {}

  private get jobsFile() {
    return path.join(this.opts.exportsDir, 'jobs.json');
  }

  async load(): Promise<void> {
    try {
      const saved = (await readJson(this.jobsFile)) as RenderJob[];
      for (const job of saved) {
        // Anything that was in flight when the server stopped did not finish.
        if (job.status === 'queued' || job.status === 'running') {
          job.status = 'failed';
          job.error = 'Server stopped before the render finished.';
          job.finishedAt = job.finishedAt ?? new Date().toISOString();
        }
        this.jobs.set(job.id, job);
      }
    } catch {
      // No history yet.
    }
  }

  private persist() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      const list = [...this.jobs.values()].slice(-200);
      this.persisting = this.persisting.then(() => writeJsonAtomic(this.jobsFile, list)).catch(() => undefined);
    }, 250);
  }

  list(): RenderJob[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): RenderJob {
    const job = this.jobs.get(id);
    if (!job) throw new HttpError(404, 'Render job not found');
    return job;
  }

  /** Step 1-2 of the pipeline happen synchronously so the client gets validation errors immediately. */
  async submit(input: { projectId: string; format?: Format; project?: unknown; frameRange?: [number, number] }): Promise<RenderJob> {
    const saved = await this.opts.store.get(input.projectId);
    const raw = input.project ?? saved;
    const { project } = this.opts.store.validate(raw);
    if (project.id !== saved.id) throw new HttpError(400, 'Project id mismatch');
    const format = input.format ?? project.format;
    const template = this.opts.templates.get(project.templateId);
    if (!template.formats.includes(format)) throw new HttpError(400, `Template does not support ${format}`);
    // Freeze the snapshot: later edits in the Studio do not affect this job.
    const snapshot = structuredClone({ ...project, format }) as MotionProject;
    const meta = template.getMetadata(snapshot);
    const spec = FORMAT_SPECS[format];

    const now = new Date().toISOString();
    const job: RenderJob = {
      id: createId('r-'),
      projectId: project.id,
      projectName: project.name,
      templateId: project.templateId,
      format,
      width: spec.width,
      height: spec.height,
      fps: meta.fps,
      durationInFrames: input.frameRange ? input.frameRange[1] - input.frameRange[0] + 1 : meta.durationInFrames,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      renderedFrames: 0,
      encodedFrames: 0,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      outputPath: null,
      outputFileName: null,
      outputSize: null,
      error: null,
      log: [`${now} queued (${spec.width}x${spec.height} @ ${meta.fps}fps, ${meta.durationInFrames} frames)`],
    };
    if (input.frameRange) {
      const [a, b] = input.frameRange;
      if (a > b || b >= meta.durationInFrames) throw new HttpError(400, 'Invalid frame range');
    }
    let cancel!: () => void;
    const cancelled = new Promise<void>((resolve) => (cancel = resolve));
    this.jobs.set(job.id, job);
    this.pending.push({ job, snapshot, cancel, cancelled, ...(input.frameRange ? { frameRange: input.frameRange } : {}) });
    this.persist();
    // Return a copy: the live object keeps changing as the job runs.
    const accepted = { ...job, log: [...job.log] };
    void this.pump();
    return accepted;
  }

  cancel(id: string): RenderJob {
    const job = this.get(id);
    if (job.status === 'queued') {
      const idx = this.pending.findIndex((p) => p.job.id === id);
      if (idx >= 0) this.pending.splice(idx, 1);
      this.finish(job, 'cancelled', null);
    } else if (job.status === 'running' && this.active?.job.id === id) {
      this.note(job, 'cancellation requested');
      this.active.cancel();
    }
    return job;
  }

  /** Resolves when the queue is idle and history is flushed (used by tests and scripts). */
  async idle(): Promise<void> {
    while (this.active || this.pending.length || this.persistTimer) await new Promise((r) => setTimeout(r, 50));
    await this.persisting;
  }

  private note(job: RenderJob, message: string) {
    job.log.push(`${new Date().toISOString()} ${message}`);
    if (job.log.length > 60) job.log.splice(0, job.log.length - 60);
    this.persist();
  }

  private finish(job: RenderJob, status: RenderJob['status'], error: string | null) {
    job.status = status;
    job.error = error;
    job.finishedAt = new Date().toISOString();
    if (status === 'succeeded') {
      job.stage = 'done';
      job.progress = 1;
    }
    this.note(job, status + (error ? `: ${error}` : ''));
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    const next = this.pending.shift();
    if (!next) return;
    this.active = next;
    try {
      await this.run(next);
    } finally {
      this.active = null;
      void this.pump();
    }
  }

  private async run({ job, snapshot, cancelled, frameRange }: Pending): Promise<void> {
    const { exportsDir } = this.opts;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    const set = (stage: RenderJob['stage'], msg?: string) => {
      if (job.stage !== stage) this.note(job, msg ?? stage);
      job.stage = stage;
    };
    const tmpDir = path.join(exportsDir, '.tmp');
    const tmpFile = path.join(tmpDir, `${job.id}.mp4`);
    try {
      set('validating');
      this.opts.store.validate(snapshot);

      set('snapshot');
      await writeJsonAtomic(path.join(tmpDir, `${job.id}.snapshot.json`), snapshot);

      set('assets');
      const missing = await this.opts.store.verifyAssetFiles(snapshot);
      if (missing.length) throw new Error(`Missing asset files: ${missing.join(', ')}`);

      await fs.mkdir(tmpDir, { recursive: true });
      const result = await this.opts.engine.render({
        jobId: job.id,
        project: snapshot,
        format: job.format,
        outputPath: tmpFile,
        assetBaseUrl: this.opts.assetBaseUrl(),
        cancelled,
        ...(frameRange ? { frameRange } : {}),
        onProgress: (e) => {
          set(e.stage, e.message);
          job.progress = Math.min(0.99, e.progress);
          job.renderedFrames = e.renderedFrames;
          job.encodedFrames = e.encodedFrames;
          this.persist();
        },
      });

      set('saving');
      const fileName = `${slugify(job.projectName)}-${job.format}-${stamp()}.mp4`;
      const finalPath = path.join(exportsDir, fileName);
      await fs.rename(tmpFile, finalPath);
      const st = await fs.stat(finalPath);
      job.outputPath = finalPath;
      job.outputFileName = fileName;
      job.outputSize = st.size;
      job.durationInFrames = result.durationInFrames;
      this.finish(job, 'succeeded', null);
    } catch (err) {
      await fs.rm(tmpFile, { force: true }).catch(() => undefined);
      if (err instanceof RenderCancelledError) this.finish(job, 'cancelled', null);
      else this.finish(job, 'failed', humanizeError(err));
    } finally {
      await fs.rm(path.join(tmpDir, `${job.id}.snapshot.json`), { force: true }).catch(() => undefined);
    }
  }
}

const humanizeError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ENOSPC/.test(msg)) return 'Sem espaço em disco para gravar o vídeo.';
  if (/Timeout|timed out/i.test(msg)) return `O renderizador excedeu o tempo limite. Detalhes: ${msg.split('\n')[0]}`;
  return msg.split('\n').slice(0, 6).join('\n');
};
