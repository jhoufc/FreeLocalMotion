/**
 * Renders sample MP4s of every registered template in both formats through the exact
 * production pipeline (ProjectStore -> RenderQueue -> RemotionEngine), into
 * exports/samples/. Then run `pnpm verify:videos`.
 *
 *   pnpm render:samples                  # full videos, both formats
 *   pnpm render:samples --frames 0-59    # quick partial render
 *   pnpm render:samples --landscape      # only one format
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FORMATS, type Format } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';
import { createApp } from '@lms/server/src/api/app';
import { loadConfig } from '@lms/server/src/config';
import { ProjectStore } from '@lms/server/src/projects/store';
import { RenderQueue } from '@lms/server/src/rendering/queue';
import { RemotionEngine } from '@lms/server/src/rendering/remotion-engine';

const args = process.argv.slice(2);
const framesArg = args[args.indexOf('--frames') + 1];
const frameRange = args.includes('--frames') && framesArg ? (framesArg.split('-').map(Number) as [number, number]) : undefined;
const only = FORMATS.filter((f) => args.includes(`--${f}`));
const formats: readonly Format[] = only.length ? only : FORMATS;

const base = loadConfig();
const outDir = path.join(base.exportsDir, 'samples');
const projectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-samples-'));
const store = new ProjectStore(projectsDir, templateDefinitions);
const engine = new RemotionEngine({ entry: base.remotionEntry, watchDirs: base.watchDirs, templates: templateDefinitions, log: console.log });

// Assets are served over HTTP exactly like in the Studio, on an ephemeral port.
let port = 0;
const queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: outDir, assetBaseUrl: () => `http://127.0.0.1:${port}` });
const server = createApp({ store, queue, templates: templateDefinitions, maxUploadBytes: base.maxUploadBytes }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
port = (server.address() as { port: number }).port;

const started = Date.now();
for (const template of templateDefinitions.list()) {
  const project = await store.create(template.id, { name: `${template.id} sample` });
  for (const format of formats) {
    const job = await queue.submit({ projectId: project.id, format, ...(frameRange ? { frameRange } : {}) });
    let last = '';
    while (['queued', 'running'].includes(queue.get(job.id).status)) {
      const j = queue.get(job.id);
      const line = `${template.id} ${format}: ${j.stage} ${(j.progress * 100).toFixed(0)}% (${j.renderedFrames}/${j.durationInFrames})`;
      if (line !== last) process.stdout.write(`\r${line.padEnd(80)}`);
      last = line;
      await new Promise((r) => setTimeout(r, 500));
    }
    const done = queue.get(job.id);
    process.stdout.write('\n');
    if (done.status !== 'succeeded') {
      console.error(`FAILED: ${done.error}`);
      process.exitCode = 1;
    } else {
      console.log(`  -> ${done.outputPath} (${((done.outputSize ?? 0) / 1e6).toFixed(1)} MB)`);
    }
  }
}
await queue.idle();
server.close();
await fs.rm(projectsDir, { recursive: true, force: true });
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
