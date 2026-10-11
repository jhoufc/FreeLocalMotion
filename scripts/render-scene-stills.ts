/**
 * Visual QA for scene types: renders each scene type alone (one-scene free composition)
 * at its start, entrance, middle, hero moment, exit and last frame, in both formats,
 * through the same bundle + composition as the MP4 pipeline, and tiles them into one
 * contact sheet per scene (needs ffmpeg for the sheet).
 *
 *   pnpm render:scene-stills                       # every scene type in the library
 *   pnpm render:scene-stills kinetic-type glass-panels
 *   pnpm render:scene-stills --premium             # only the Studio Premium family
 *   pnpm render:scene-stills --family studio-motion
 *   pnpm render:scene-stills semantic-words --samples 10   # N evenly spaced frames
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { FORMATS, type MotionProject } from '@lms/shared';
import { COMPOSITION_TEMPLATE_ID, sceneDefinitions, templateDefinitions } from '@lms/catalog/definitions';
import { heroFrameOf } from '@lms/template-sdk';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'packages/catalog/src/remotion/index.ts');
const outDir = path.join(root, 'exports/scene-stills', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

const args = process.argv.slice(2);
const samplesArg = args.includes('--samples') ? Number(args[args.indexOf('--samples') + 1]) : 0;
const familyArg = args.includes('--family') ? args[args.indexOf('--family') + 1] : undefined;
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--samples' && args[i - 1] !== '--family');
const types = sceneDefinitions
  .list()
  .filter((t) => (ids.length ? ids.includes(t.id) : true))
  .filter((t) => (args.includes('--premium') ? t.family.id === 'studio-premium' : true))
  .filter((t) => (familyArg ? t.family.id === familyArg : true));
if (types.length === 0) throw new Error(`No scene types match ${ids.join(', ')}`);

await fs.mkdir(outDir, { recursive: true });
await ensureBrowser();
console.log('Bundling…');
const serveUrl = await bundle({ entryPoint: entry, publicDir: path.join(root, 'assets') });
const template = templateDefinitions.get(COMPOSITION_TEMPLATE_ID);

for (const type of types) {
  const files: string[] = [];
  for (const format of FORMATS) {
    const base = template.createDefaults({ id: 'scene-stills', name: 'Scene stills', format, now: new Date().toISOString() });
    const project: MotionProject = { ...base, scenes: [template.createScene(type.id, { id: `${type.id}-qa`, name: type.name })] };
    const inputProps = { project, assetBaseUrl: 'http://127.0.0.1:4327' };
    const composition = await selectComposition({ serveUrl, id: template.id, inputProps });
    const last = composition.durationInFrames - 1;
    const fps = composition.fps;
    const frames = samplesArg > 0 ? Array.from({ length: samplesArg }, (_, i) => Math.round((last * (i + 0.5)) / samplesArg)) : [
      Math.round(0.25 * fps),
      Math.round(0.7 * fps),
      Math.round(1.25 * fps),
      heroFrameOf(type, project.scenes[0]!.duration, fps, project.scenes[0]),
      Math.round(last * 0.82),
      last - 3,
    ];
    for (const frame of frames) {
      const output = path.join(outDir, `${type.id}-${format}-${String(frame).padStart(4, '0')}.png`);
      await renderStill({ serveUrl, composition, inputProps, frame: Math.min(last, Math.max(0, frame)), output, scale: format === 'portrait' ? 0.25 : 0.25 });
      files.push(output);
    }
  }
  // One strip per format (6 frames each, aspect preserved).
  for (const [i, format] of FORMATS.entries()) {
    const per = files.length / FORMATS.length;
    const strip = files.slice(i * per, i * per + per);
    const sheet = path.join(outDir, `${type.id}.${format}.png`);
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-y', ...strip.flatMap((f) => ['-i', f]), '-filter_complex', `${strip.map((_, j) => `[${j}:v]`).join('')}hstack=inputs=${strip.length}`, sheet]);
      console.log(`${type.id} ${format}: ${sheet}`);
    } catch (err) {
      console.log(`${type.id}: stills in ${outDir} (sheet failed: ${err instanceof Error ? err.message.split(String.fromCharCode(10))[0] : err})`);
    }
  }
}
console.log(`SCENE_STILLS_DIR=${outDir}`);
