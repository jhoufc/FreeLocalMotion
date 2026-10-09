/**
 * Renders representative still frames of a template in both formats, using exactly the
 * same bundle + composition as the MP4 pipeline. Used for visual QA (phase E).
 *
 *   pnpm render:stills                 # default frames
 *   pnpm render:stills 0.5 2.1 7.3     # specific times in seconds
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { FORMATS } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'packages/catalog/src/remotion/index.ts');
// Each run gets its own folder so runs never overwrite each other.
const outDir = path.join(root, 'exports/stills', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

const args = process.argv.slice(2);
const formatArg = args.find((a) => a === '--portrait' || a === '--landscape');
const times = args.filter((a) => !a.startsWith('--')).map(Number).filter((n) => Number.isFinite(n));
const defaultTimes = [0.3, 0.55, 1.0, 1.6, 2.4, 2.85, 3.2, 3.9, 4.8, 5.8, 6.2, 6.9, 7.8, 8.9, 9.6, 10.2, 10.9, 11.6, 12.6, 14.2, 14.95];

await fs.mkdir(outDir, { recursive: true });
await ensureBrowser();
console.log('Bundling…');
const serveUrl = await bundle({ entryPoint: entry, publicDir: path.join(root, 'assets') });

const template = templateDefinitions.list()[0]!;
for (const format of FORMATS) {
  if (formatArg && formatArg !== `--${format}`) continue;
  const project = template.createDefaults({ id: 'stills-check', name: 'Stills', format, now: new Date().toISOString() });
  const inputProps = { project, assetBaseUrl: 'http://127.0.0.1:4317' };
  const composition = await selectComposition({ serveUrl, id: template.id, inputProps });
  for (const s of times.length ? times : defaultTimes) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps));
    const output = path.join(outDir, `${format}-${String(frame).padStart(4, '0')}.png`);
    await renderStill({ serveUrl, composition, inputProps, frame, output, scale: 0.5 });
    console.log(output);
  }
}
console.log(`STILLS_DIR=${outDir}`);
