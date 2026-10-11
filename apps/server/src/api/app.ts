import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  createFromTemplateRequestSchema,
  createProjectRequestSchema,
  createRenderRequestSchema,
  publishRevisionRequestSchema,
  saveTemplateRequestSchema,
  slugify,
  updateTemplateRequestSchema,
} from '@lms/shared';
import type { AnyTemplateDefinition, TemplateRegistry } from '@lms/template-sdk';
import { starterSummaries } from '@lms/catalog/definitions';
import { HttpError, type ProjectStore } from '../projects/store';
import type { RenderQueue } from '../rendering/queue';
import type { TemplateLibrary } from '../templates/library';

export interface AppDeps {
  store: ProjectStore;
  queue: RenderQueue;
  templates: TemplateRegistry<AnyTemplateDefinition>;
  /** User templates. Optional so tools that only render can omit it. */
  library?: TemplateLibrary;
  maxUploadBytes: number;
  studioDist?: string;
}

const param = (req: Request, key: string): string => {
  const v = req.params[key];
  if (typeof v !== 'string') throw new HttpError(400, `Missing parameter ${key}`);
  return v;
};

export const createApp = ({ store, queue, templates, library, maxUploadBytes, studioDist }: AppDeps) => {
  const app = express();
  app.disable('x-powered-by');
  const api = express.Router();
  api.use(express.json({ limit: '5mb' }));

  api.get('/health', (_req, res) => {
    res.json({ ok: true, templates: templates.list().length });
  });

  /* ---------------- templates ---------------- */
  api.get('/templates', (_req, res) => {
    res.json(templates.summaries());
  });

  /** Ready-made compositions (native, read-only) built from library scenes. */
  api.get('/starters', (_req, res) => {
    res.json(starterSummaries());
  });

  /* ---------------- user templates ---------------- */
  const lib = (): TemplateLibrary => {
    if (!library) throw new HttpError(501, 'Template library not available');
    return library;
  };

  api.get('/user-templates', async (_req, res) => {
    res.json(await lib().list());
  });

  /** "Salvar como template": snapshot of a project (converted to a free composition). */
  api.post('/user-templates', async (req, res) => {
    const body = saveTemplateRequestSchema.parse(req.body);
    res.status(201).json(await lib().createFromProject(body));
  });

  api.get('/user-templates/:id', async (req, res) => {
    const rev = typeof req.query.revision === 'string' ? Number(req.query.revision) : undefined;
    res.json(await lib().get(param(req, 'id'), Number.isInteger(rev) ? rev : undefined));
  });

  api.patch('/user-templates/:id', async (req, res) => {
    res.json(await lib().update(param(req, 'id'), updateTemplateRequestSchema.parse(req.body)));
  });

  api.delete('/user-templates/:id', async (req, res) => {
    await lib().remove(param(req, 'id'));
    res.status(204).end();
  });

  api.post('/user-templates/:id/duplicate', async (req, res) => {
    res.status(201).json(await lib().duplicate(param(req, 'id')));
  });

  /** New independent project from the template's current revision. */
  api.post('/user-templates/:id/projects', async (req, res) => {
    const body = createFromTemplateRequestSchema.parse(req.body ?? {});
    res.status(201).json(await lib().createProject(param(req, 'id'), { ...(body.name ? { name: body.name } : {}), ...(body.format ? { format: body.format } : {}) }));
  });

  /** Working copy for editing; publishing it creates the next revision. */
  api.post('/user-templates/:id/drafts', async (req, res) => {
    res.status(201).json(await lib().startDraft(param(req, 'id')));
  });

  api.post('/user-templates/:id/revisions', async (req, res) => {
    const body = publishRevisionRequestSchema.parse(req.body);
    res.status(201).json(await lib().publish(param(req, 'id'), body.projectId));
  });

  api.get('/user-templates/:id/thumbnails/:file', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(lib().thumbnailPath(param(req, 'id'), param(req, 'file')), (err) => {
      if (err) next(new HttpError(404, 'Thumbnail not found'));
    });
  });

  /* ---------------- projects ---------------- */
  api.get('/projects', async (_req, res) => {
    res.json(await store.list());
  });

  api.post('/projects', async (req, res) => {
    const body = createProjectRequestSchema.parse(req.body);
    res.status(201).json(
      await store.create(body.templateId, { ...(body.name ? { name: body.name } : {}), ...(body.format ? { format: body.format } : {}), ...(body.starterId ? { starterId: body.starterId } : {}) }),
    );
  });

  api.post('/projects/import', async (req, res) => {
    res.status(201).json(await store.import(req.body));
  });

  api.get('/projects/:id', async (req, res) => {
    res.json(await store.get(param(req, 'id')));
  });

  api.put('/projects/:id', async (req, res) => {
    res.json(await store.save(param(req, 'id'), req.body, { force: req.query.force === '1' }));
  });

  api.delete('/projects/:id', async (req, res) => {
    await store.remove(param(req, 'id'));
    res.status(204).end();
  });

  api.post('/projects/:id/duplicate', async (req, res) => {
    const name = z.object({ name: z.string().min(1).max(80).optional() }).parse(req.body ?? {}).name;
    res.status(201).json(await store.duplicate(param(req, 'id'), name));
  });

  api.get('/projects/:id/export', async (req, res) => {
    const project = await store.get(param(req, 'id'));
    res.setHeader('Content-Disposition', `attachment; filename="${slugify(project.name)}.lms.json"`);
    res.json(project);
  });

  /* ---------------- assets ---------------- */
  api.post('/projects/:id/assets', express.raw({ type: () => true, limit: maxUploadBytes }), async (req, res) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.byteLength === 0) throw new HttpError(400, 'Empty upload');
    const name = typeof req.query.name === 'string' ? req.query.name : 'upload';
    const { project, asset } = await store.addAsset(param(req, 'id'), body, name);
    res.status(201).json({ project, asset });
  });

  api.delete('/projects/:id/assets/:assetId', async (req, res) => {
    res.json(await store.removeAsset(param(req, 'id'), param(req, 'assetId')));
  });

  api.get('/projects/:id/assets/:file', (req, res, next) => {
    const file = store.assetPath(param(req, 'id'), param(req, 'file'));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(file, (err) => {
      if (err) next(new HttpError(404, 'Asset file not found'));
    });
  });

  /* ---------------- renders ---------------- */
  api.get('/renders', (_req, res) => {
    res.json(queue.list());
  });

  api.post('/renders', async (req, res) => {
    const body = createRenderRequestSchema.parse(req.body);
    const job = await queue.submit({
      projectId: body.projectId,
      ...(body.format ? { format: body.format } : {}),
      ...(body.project !== undefined ? { project: body.project } : {}),
      ...(body.frameRange ? { frameRange: body.frameRange } : {}),
    });
    res.status(202).json(job);
  });

  api.get('/renders/:id', (req, res) => {
    res.json(queue.get(param(req, 'id')));
  });

  api.post('/renders/:id/cancel', (req, res) => {
    res.json(queue.cancel(param(req, 'id')));
  });

  api.get('/renders/:id/file', (req, res, next) => {
    const job = queue.get(param(req, 'id'));
    if (job.status !== 'succeeded' || !job.outputPath) throw new HttpError(409, 'Render has no output yet');
    const download = req.query.download !== '0';
    if (download) res.setHeader('Content-Disposition', `attachment; filename="${job.outputFileName}"`);
    res.sendFile(job.outputPath, (err) => {
      if (err && !res.headersSent) next(new HttpError(404, 'Output file no longer exists'));
    });
  });

  /** Opens the system file manager at the exported file (local desktop convenience). */
  api.post('/renders/:id/reveal', (req, res) => {
    const job = queue.get(param(req, 'id'));
    if (!job.outputPath || !fs.existsSync(job.outputPath)) throw new HttpError(404, 'Output file no longer exists');
    const p = job.outputPath;
    const [cmd, args] =
      process.platform === 'win32'
        ? ['explorer.exe', [`/select,${p}`]]
        : process.platform === 'darwin'
          ? ['open', ['-R', p]]
          : ['xdg-open', [path.dirname(p)]];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    res.json({ ok: true });
  });

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found')));

  app.use('/api', api);

  if (studioDist && fs.existsSync(path.join(studioDist, 'index.html'))) {
    app.use(express.static(studioDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(studioDist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
      return;
    }
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.issues });
      return;
    }
    const e = err as { type?: string; status?: number; message?: string };
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ error: 'File too large' });
      return;
    }
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Malformed JSON' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: e?.message ?? 'Internal error' });
  });

  return app;
};
