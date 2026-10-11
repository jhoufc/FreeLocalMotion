/**
 * Renders the ready-made compositions (CARTA 004) through the production pipeline:
 * ProjectStore (create from starter) -> RenderQueue -> RemotionEngine. Each MP4 gets a
 * `<file>.project.json` sidecar for `pnpm verify:videos`. The App Launch render also
 * duplicates its smartphone scene with a different screen, to exercise duplicates.
 *
 *   pnpm render:starters                              # all five, both formats
 *   pnpm render:starters app-launch --portrait        # subset
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FORMATS, setAtPath, type Format } from '@lms/shared';
import { COMPOSITION_TEMPLATE_ID, STARTERS, templateDefinitions } from '@lms/catalog/definitions';
import { duplicateScene } from '@lms/template-sdk';
import { createApp } from '@lms/server/src/api/app';
import { loadConfig } from '@lms/server/src/config';
import { ProjectStore } from '@lms/server/src/projects/store';
import { RenderQueue } from '@lms/server/src/rendering/queue';
import { RemotionEngine } from '@lms/server/src/rendering/remotion-engine';

const args = process.argv.slice(2);
const only = FORMATS.filter((f) => args.includes(`--${f}`));
const formats: readonly Format[] = only.length ? only : FORMATS;
const ids = args.filter((a) => !a.startsWith('--'));
const starters = STARTERS.filter((s) => (ids.length ? ids.includes(s.id) : true));

const base = loadConfig();
const outDir = path.join(base.exportsDir, 'starters');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-starters-'));
const store = new ProjectStore(path.join(tmp, 'projects'), templateDefinitions);
const engine = new RemotionEngine({ entry: base.remotionEntry, watchDirs: base.watchDirs, templates: templateDefinitions, log: console.log });
let port = 0;
const queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: outDir, assetBaseUrl: () => `http://127.0.0.1:${port}` });
const server = createApp({ store, queue, templates: templateDefinitions, maxUploadBytes: base.maxUploadBytes }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
port = (server.address() as { port: number }).port;
await fs.mkdir(outDir, { recursive: true });

const started = Date.now();
for (const starter of starters) {
  let project = await store.create(COMPOSITION_TEMPLATE_ID, { starterId: starter.id, name: starter.name, format: 'portrait' });
  if (starter.id === 'app-launch') {
    let p = duplicateScene(project, 'launch-phone', 'launch-phone-2').project;
    const i = p.scenes.findIndex((s) => s.id === 'launch-phone-2');
    p = setAtPath(p, ['scenes', i, 'props', 'screenVariant'], 'chat');
    p = setAtPath(p, ['scenes', i, 'texts', 'headline', 'content'], 'Talk money\nwith friends');
    p = setAtPath(p, ['scenes', i, 'props', 'model'], 'gold');
    project = await store.save(p.id, p);
  }
  for (const format of formats) {
    const job = await queue.submit({ projectId: project.id, format });
    let last = '';
    while (['queued', 'running'].includes(queue.get(job.id).status)) {
      const j = queue.get(job.id);
      const line = `${starter.id} ${format}: ${j.stage} ${(j.progress * 100).toFixed(0)}% (${j.renderedFrames}/${j.durationInFrames})`;
      if (line !== last) process.stdout.write(`\r${line.padEnd(90)}`);
      last = line;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const done = queue.get(job.id);
    process.stdout.write('\n');
    if (done.status !== 'succeeded' || !done.outputPath) {
      console.error(`FAILED ${starter.id} ${format}: ${done.error}`);
      process.exitCode = 1;
      continue;
    }
    await fs.writeFile(`${done.outputPath}.project.json`, JSON.stringify({ ...project, format }, null, 2));
    console.log(`  -> ${done.outputPath} (${((done.outputSize ?? 0) / 1e6).toFixed(1)} MB, ${done.durationInFrames} frames)`);
  }
}
await queue.idle();
server.close();
await fs.rm(tmp, { recursive: true, force: true });
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
