import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAtPath } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';
import { createApp } from '../src/api/app';
import { ProjectStore } from '../src/projects/store';
import { RenderCancelledError, type RenderEngine, type RenderRequest } from '../src/rendering/engine';
import { RenderQueue } from '../src/rendering/queue';

/** Fake engine: writes a file and reports progress, so the queue logic is tested without Chrome. */
class FakeEngine implements RenderEngine {
  calls: RenderRequest[] = [];
  delayMs = 30;
  fail: string | null = null;
  async render(req: RenderRequest) {
    this.calls.push(req);
    let cancelled = false;
    void req.cancelled.then(() => (cancelled = true));
    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, this.delayMs));
      if (cancelled) throw new RenderCancelledError();
      req.onProgress({ stage: i < 5 ? 'rendering' : 'encoding', progress: i / 5, renderedFrames: i * 90, encodedFrames: i * 90 });
    }
    if (this.fail) throw new Error(this.fail);
    await fs.writeFile(req.outputPath, 'fake mp4');
    return { width: 1920, height: 1080, fps: 30, durationInFrames: 450 };
  }
}

let root: string;
let store: ProjectStore;
let engine: FakeEngine;
let queue: RenderQueue;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-pipe-'));
  store = new ProjectStore(path.join(root, 'projects'), templateDefinitions);
  engine = new FakeEngine();
  queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: path.join(root, 'exports'), assetBaseUrl: () => 'http://127.0.0.1:1' });
});
afterEach(async () => {
  await queue.idle();
  await fs.rm(root, { recursive: true, force: true });
});

describe('render pipeline', () => {
  it('runs a job to completion and saves the MP4 under exports/', async () => {
    const p = await store.create('signature-001', { name: 'Launch Film', format: 'portrait' });
    const job = await queue.submit({ projectId: p.id, format: 'landscape' });
    expect(job.status).toBe('queued');
    expect(job).toMatchObject({ width: 1920, height: 1080, fps: 30, durationInFrames: 450 });
    await queue.idle();
    const done = queue.get(job.id);
    expect(done.status).toBe('succeeded');
    expect(done.progress).toBe(1);
    expect(done.outputFileName).toMatch(/^launch-film-landscape-\d{8}-\d{6}\.mp4$/);
    expect(await fs.readFile(done.outputPath!, 'utf8')).toBe('fake mp4');
    expect(done.log.join('\n')).toMatch(/validating[\s\S]*snapshot[\s\S]*assets[\s\S]*rendering[\s\S]*encoding[\s\S]*saving[\s\S]*succeeded/);
    expect(engine.calls[0]!.format).toBe('landscape');
  });

  it('freezes a snapshot: later edits do not leak into a queued job', async () => {
    const p = await store.create('signature-001');
    const edited = setAtPath(p, ['scenes', 0, 'texts', 'lineA', 'content'], 'Snapshot');
    const job = await queue.submit({ projectId: p.id, project: edited });
    (edited.scenes[0] as unknown as { texts: { lineA: { content: string } } }).texts.lineA.content = 'mutated';
    await queue.idle();
    expect(queue.get(job.id).status).toBe('succeeded');
    const rendered = engine.calls[0]!.project.scenes[0] as unknown as { texts: { lineA: { content: string } } };
    expect(rendered.texts.lineA.content).toBe('Snapshot');
  });

  it('rejects invalid projects before queueing', async () => {
    const p = await store.create('signature-001');
    await expect(queue.submit({ projectId: p.id, project: setAtPath(p, ['fps'], 24) })).rejects.toThrow(/Invalid project/);
    await expect(queue.submit({ projectId: 'p-missing00' })).rejects.toThrow(/not found/);
  });

  it('processes jobs one at a time and supports cancellation', async () => {
    engine.delayMs = 60;
    const p = await store.create('signature-001');
    const a = await queue.submit({ projectId: p.id });
    const b = await queue.submit({ projectId: p.id });
    await new Promise((r) => setTimeout(r, 90));
    expect(queue.get(a.id).status).toBe('running');
    expect(queue.get(b.id).status).toBe('queued');
    queue.cancel(b.id);
    expect(queue.get(b.id).status).toBe('cancelled');
    queue.cancel(a.id);
    await queue.idle();
    expect(queue.get(a.id).status).toBe('cancelled');
    expect(engine.calls).toHaveLength(1);
    const leftovers = await fs.readdir(path.join(root, 'exports', '.tmp')).catch(() => []);
    expect(leftovers.filter((f) => f.endsWith('.mp4'))).toEqual([]);
  });

  it('reports readable errors', async () => {
    engine.fail = 'Chrome crashed\nstack line 1\nstack line 2';
    const p = await store.create('signature-001');
    const job = await queue.submit({ projectId: p.id });
    await queue.idle();
    expect(queue.get(job.id)).toMatchObject({ status: 'failed', error: expect.stringContaining('Chrome crashed') });
  });

  it('fails a job whose asset file disappeared', async () => {
    const p = await store.create('signature-001');
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(32)]);
    const { project, asset } = await store.addAsset(p.id, png, 'bg.png');
    await store.save(p.id, setAtPath(setAtPath(project, ['scenes', 0, 'background', 'mode'], 'image'), ['scenes', 0, 'background', 'image', 'assetId'], asset.id));
    await fs.rm(store.assetPath(p.id, asset.fileName));
    const job = await queue.submit({ projectId: p.id });
    await queue.idle();
    expect(queue.get(job.id)).toMatchObject({ status: 'failed', error: expect.stringContaining('bg.png') });
  });
});

describe('HTTP API', () => {
  it('serves the project + render workflow end to end', async () => {
    const app = createApp({ store, queue, templates: templateDefinitions, maxUploadBytes: 1024 * 1024 });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    try {
      const templates = (await (await fetch(`${base}/templates`)).json()) as { id: string }[];
      expect(templates.map((t) => t.id)).toEqual(['signature-001']);

      const created = await fetch(`${base}/projects`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ templateId: 'signature-001', name: 'API' }) });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };

      const bad = await fetch(`${base}/projects/${project.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...project, fps: 12 }) });
      expect(bad.status).toBe(422);

      const upload = await fetch(`${base}/projects/${project.id}/assets?name=x.png`, { method: 'POST', body: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]) });
      expect(upload.status).toBe(201);
      const { asset } = (await upload.json()) as { asset: { fileName: string } };
      const served = await fetch(`${base}/projects/${project.id}/assets/${asset.fileName}`);
      expect(served.status).toBe(200);

      const exp = await fetch(`${base}/projects/${project.id}/export`);
      expect(exp.headers.get('content-disposition')).toMatch(/attachment/);

      const render = await fetch(`${base}/renders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: project.id, format: 'portrait' }) });
      expect(render.status).toBe(202);
      const job = (await render.json()) as { id: string };
      await queue.idle();
      const status = (await (await fetch(`${base}/renders/${job.id}`)).json()) as { status: string };
      expect(status.status).toBe('succeeded');
      const file = await fetch(`${base}/renders/${job.id}/file`);
      expect(file.status).toBe(200);
      expect(await file.text()).toBe('fake mp4');

      expect((await fetch(`${base}/nope`)).status).toBe(404);
    } finally {
      server.close();
    }
  });
});
