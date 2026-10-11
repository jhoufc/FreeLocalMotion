/**
 * End-to-end check of free composition (CARTA 003): builds a blank composition the way a
 * user would — scenes from both families (Studio Premium + Signature / 001), a duplicate
 * with different copy, a moved scene, an uploaded image used by a scene, an "inherit"
 * background and a disabled scene — renders it in both formats through the production
 * pipeline, then saves it as a user template and checks the template's asset copies.
 *
 * Each MP4 gets a `<file>.project.json` sidecar for `pnpm verify:videos`.
 *
 *   pnpm render:free [--portrait|--landscape] [--image path/to/image.png]
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FORMATS, setAtPath, type Format, type MotionProject } from '@lms/shared';
import { COMPOSITION_TEMPLATE_ID, templateDefinitions } from '@lms/catalog/definitions';
import { computeSceneRanges, duplicateScene, insertScene, moveScene, setSceneEnabled } from '@lms/template-sdk';
import { createApp } from '@lms/server/src/api/app';
import { loadConfig } from '@lms/server/src/config';
import { ProjectStore } from '@lms/server/src/projects/store';
import { RenderQueue } from '@lms/server/src/rendering/queue';
import { RemotionEngine } from '@lms/server/src/rendering/remotion-engine';
import { TemplateLibrary } from '@lms/server/src/templates/library';

const args = process.argv.slice(2);
const only = FORMATS.filter((f) => args.includes(`--${f}`));
const formats: readonly Format[] = only.length ? only : FORMATS;
const imageArg = args.includes('--image') ? args[args.indexOf('--image') + 1] : undefined;

const base = loadConfig();
const outDir = path.join(base.exportsDir, 'free');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-free-'));
const store = new ProjectStore(path.join(tmp, 'projects'), templateDefinitions);
const engine = new RemotionEngine({ entry: base.remotionEntry, watchDirs: base.watchDirs, templates: templateDefinitions, log: console.log });
let port = 0;
const queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: outDir, assetBaseUrl: () => `http://127.0.0.1:${port}` });
const library = new TemplateLibrary(path.join(tmp, 'templates'), { projects: store, templates: templateDefinitions });
const server = createApp({ store, queue, templates: templateDefinitions, library, maxUploadBytes: base.maxUploadBytes }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
port = (server.address() as { port: number }).port;

/* ---------------- compose ---------------- */
const template = templateDefinitions.get(COMPOSITION_TEMPLATE_ID);
const blank = await store.create(COMPOSITION_TEMPLATE_ID, { name: 'Free composition test', format: 'portrait' });
let image: { id: string } | null = null;
if (imageArg) image = (await store.addAsset(blank.id, await fs.readFile(imageArg), path.basename(imageArg))).asset;
let p: MotionProject = await store.get(blank.id);
const add = (type: string, id: string) => {
  p = insertScene(p, template.createScene(type, { id, name: template.sceneTypes.find((t) => t.id === type)!.name }));
};
const at = (id: string) => p.scenes.findIndex((s) => s.id === id);

add('kinetic-type', 'kt-a');
add('impact', 'sig-impact');
add('glass-panels', 'glass');
add('number-impact', 'number');
add('orbital-data', 'orbital');
add('energy', 'sig-energy');
add('product-reveal', 'product');
add('grid-breakdown', 'grid');
add('editorial-split', 'editorial');
add('cinematic-outro', 'outro');

// Independent edits on several types.
p = setAtPath(p, ['scenes', at('kt-a'), 'texts', 'headline', 'content'], 'Build\nfreely');
p = duplicateScene(p, 'kt-a', 'kt-b').project;
p = setAtPath(p, ['scenes', at('kt-b'), 'texts', 'headline', 'content'], 'Mix\nevery scene');
p = setAtPath(p, ['scenes', at('kt-b'), 'props', 'direction'], 'up');
p = setAtPath(p, ['scenes', at('kt-b'), 'background', 'mode'], 'inherit');
p = moveScene(p, 'kt-b', at('outro'));
p = setAtPath(p, ['scenes', at('number'), 'props', 'to'], 98.6);
p = setAtPath(p, ['scenes', at('number'), 'props', 'decimals'], 1);
p = setAtPath(p, ['scenes', at('number'), 'props', 'suffix'], '%');
p = setAtPath(p, ['scenes', at('number'), 'texts', 'kicker', 'content'], 'Uptime this quarter');
p = setAtPath(p, ['scenes', at('orbital'), 'props', 'nodes'], [
  { label: 'Edge', value: '42' },
  { label: 'Cache', value: '97%' },
  { label: 'Queue', value: '0' },
  { label: 'Latency', value: '9ms' },
]);
if (image) p = setAtPath(p, ['scenes', at('glass'), 'props', 'panels', 0, 'assetId'], image.id);
p = setAtPath(p, ['scenes', at('editorial'), 'texts', 'blockA', 'content'], 'Free\nform');
p = setAtPath(p, ['globals', 'style', 'background', 'mode'], 'gradient');
p = setSceneEnabled(p, 'sig-energy', false, { allowEmpty: true });

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
    await new Promise((r) => setTimeout(r, 1000));
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

/* ---------------- save as template, check asset integrity ---------------- */
const saved = await library.createFromProject({ projectId: project.id, name: 'Free test template', description: 'render:free', category: 'typography' });
const { document } = await library.get(saved.id);
await store.remove(project.id);
const fromTemplate = await library.createProject(saved.id, { format: 'landscape' });
for (const a of fromTemplate.assets) await fs.access(store.assetPath(fromTemplate.id, a.fileName));
console.log(`Template ${saved.id}: ${document.scenes.length} scenes, ${document.assets.length} asset(s) copied; project from template has ${fromTemplate.assets.length} asset file(s) after the source project was deleted.`);

await queue.idle();
server.close();
await fs.rm(tmp, { recursive: true, force: true });
