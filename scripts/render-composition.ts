/**
 * End-to-end check of dynamic scene composition (CARTA 002). Builds a project the way a
 * user would in the Studio — duplicated scenes with different content, an added scene, a
 * move, a renamed scene, a custom duration and a disabled scene — and renders it in both
 * formats through the production pipeline (ProjectStore -> RenderQueue -> RemotionEngine).
 *
 * Each MP4 gets a `<file>.project.json` sidecar with the exact snapshot, which
 * `pnpm verify:videos` uses to check frame count, duration and per-scene frames.
 *
 *   pnpm render:composition                 # both formats
 *   pnpm render:composition --portrait      # one format
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FORMATS, setAtPath, type Format, type MotionProject } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';
import { computeSceneRanges, duplicateScene, insertScene, moveScene, renameScene, setSceneEnabled } from '@lms/template-sdk';
import { createApp } from '@lms/server/src/api/app';
import { loadConfig } from '@lms/server/src/config';
import { ProjectStore } from '@lms/server/src/projects/store';
import { RenderQueue } from '@lms/server/src/rendering/queue';
import { RemotionEngine } from '@lms/server/src/rendering/remotion-engine';

const args = process.argv.slice(2);
const only = FORMATS.filter((f) => args.includes(`--${f}`));
const formats: readonly Format[] = only.length ? only : FORMATS;

const base = loadConfig();
const outDir = path.join(base.exportsDir, 'composition');
const projectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-composition-'));
const store = new ProjectStore(projectsDir, templateDefinitions);
const engine = new RemotionEngine({ entry: base.remotionEntry, watchDirs: base.watchDirs, templates: templateDefinitions, log: console.log });
let port = 0;
const queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: outDir, assetBaseUrl: () => `http://127.0.0.1:${port}` });
const server = createApp({ store, queue, templates: templateDefinitions, maxUploadBytes: base.maxUploadBytes }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
port = (server.address() as { port: number }).port;

/* ---------------- compose ---------------- */
const template = templateDefinitions.get('signature-001');
const created = await store.create('signature-001', { name: 'Composition test' });
const at = (p: MotionProject, id: string) => p.scenes.findIndex((s) => s.id === id);
let p: MotionProject = created;

// Impact #1: custom copy.
p = setAtPath(p, ['scenes', 0, 'texts', 'lineA', 'content'], 'Motion');
p = setAtPath(p, ['scenes', 0, 'texts', 'lineB', 'content'], 'Graphics');
p = renameScene(p, 'impact', 'Abertura');

// Impact #2: duplicate with its own text, background and accent.
const d1 = duplicateScene(p, 'impact', 'impact-two');
p = d1.project;
p = setAtPath(p, ['scenes', at(p, 'impact-two'), 'texts', 'lineA', 'content'], '100% Local');
p = setAtPath(p, ['scenes', at(p, 'impact-two'), 'texts', 'lineB', 'content'], 'No cloud');
p = setAtPath(p, ['scenes', at(p, 'impact-two'), 'background', 'mode'], 'solid');
p = setAtPath(p, ['scenes', at(p, 'impact-two'), 'background', 'solid', 'color'], '#0B1A3A');
p = setAtPath(p, ['scenes', at(p, 'impact-two'), 'palette', 'accent'], '#FFFFFF');
p = renameScene(p, 'impact-two', 'Benefício principal');

// Impact #3: another duplicate, moved later in the film.
p = duplicateScene(p, 'impact-two', 'impact-three').project;
p = setAtPath(p, ['scenes', at(p, 'impact-three'), 'texts', 'lineA', 'content'], 'Made');
p = setAtPath(p, ['scenes', at(p, 'impact-three'), 'texts', 'lineB', 'content'], 'To move');
p = setAtPath(p, ['scenes', at(p, 'impact-three'), 'palette', 'accent'], '#FF5C8A');

// A new Energy instance with a longer duration, inserted after Transformation.
p = insertScene(p, template.createScene('energy', { id: 'energy-two', name: 'Demonstração' }), at(p, 'transformation') + 1);
p = setAtPath(p, ['scenes', at(p, 'energy-two'), 'texts', 'headline', 'content'], 'Reimagined.');
p = setAtPath(p, ['scenes', at(p, 'energy-two'), 'duration'], 4.5);

// Impact #3 right before the Signature; the original Energy stays but is disabled.
p = moveScene(p, 'impact-three', at(p, 'signature') - 1);
p = setSceneEnabled(p, 'energy', false);

await store.save(p.id, p);
const project = await store.get(p.id);
const order = computeSceneRanges(project.scenes, project.fps).map((r) => project.scenes[r.index]!);
console.log('Sequence:', order.map((s) => `${s.name} [${s.type}] ${s.duration}s`).join(' → '));
console.log('Disabled:', project.scenes.filter((s) => !s.enabled).map((s) => s.name).join(', ') || '—');

/* ---------------- render ---------------- */
await fs.mkdir(outDir, { recursive: true });
for (const format of formats) {
  const job = await queue.submit({ projectId: project.id, format });
  let last = '';
  while (['queued', 'running'].includes(queue.get(job.id).status)) {
    const j = queue.get(job.id);
    const line = `${format}: ${j.stage} ${(j.progress * 100).toFixed(0)}% (${j.renderedFrames}/${j.durationInFrames})`;
    if (line !== last) process.stdout.write(`\r${line.padEnd(80)}`);
    last = line;
    await new Promise((r) => setTimeout(r, 500));
  }
  const done = queue.get(job.id);
  process.stdout.write('\n');
  if (done.status !== 'succeeded' || !done.outputPath) {
    console.error(`FAILED: ${done.error}`);
    process.exitCode = 1;
    continue;
  }
  await fs.writeFile(`${done.outputPath}.project.json`, JSON.stringify({ ...project, format }, null, 2));
  console.log(`  -> ${done.outputPath} (${((done.outputSize ?? 0) / 1e6).toFixed(1)} MB, ${done.durationInFrames} frames)`);
}
await queue.idle();
server.close();
await fs.rm(projectsDir, { recursive: true, force: true });
