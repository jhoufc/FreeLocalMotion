/**
 * Speech → motion, end to end through the production pipeline:
 * SpeechService (ffmpeg + local faster-whisper) → planner → ProjectStore → RenderQueue.
 * Writes the MP4s, `<file>.project.json` sidecars for `pnpm verify:videos` and the plan.
 *
 *   pnpm render:speech fala.mp4                       # audio or video: transcribed locally
 *   pnpm render:speech fala.mp3 --transcript fala.srt # your own transcript, timed by the audio
 *   pnpm render:speech roteiro.txt --portrait          # text only (estimated timing, no audio)
 *   options: --portrait | --landscape (default both), --theme <starter id>, --language pt|en|auto
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FORMATS, type Format, type MotionProject } from '@lms/shared';
import { COMPOSITION_TEMPLATE_ID, sceneDefinitions, templateDefinitions } from '@lms/catalog/definitions';
import { createApp } from '@lms/server/src/api/app';
import { loadConfig } from '@lms/server/src/config';
import { ProjectStore } from '@lms/server/src/projects/store';
import { RenderQueue } from '@lms/server/src/rendering/queue';
import { RemotionEngine } from '@lms/server/src/rendering/remotion-engine';
import { SpeechService } from '@lms/server/src/speech/service';
import { createSpeechProject, type SpeechSidecar } from '@lms/server/src/speech/project';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const input = args.find((a, i) => !a.startsWith('--') && !['--transcript', '--theme', '--language'].includes(args[i - 1] ?? ''));
if (!input) {
  console.error('uso: pnpm render:speech <áudio|vídeo|transcrição> [--transcript arquivo] [--portrait|--landscape] [--theme id] [--language pt]');
  process.exit(1);
}
const only = FORMATS.filter((f) => args.includes(`--${f}`));
const formats: readonly Format[] = only.length ? only : FORMATS;
const isText = /\.(txt|srt|vtt|json)$/i.test(input);

const base = loadConfig();
const outDir = path.join(base.exportsDir, 'speech');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-speech-'));
const store = new ProjectStore(path.join(tmp, 'projects'), templateDefinitions);
const speech = new SpeechService({ ...base.speech, dir: path.join(tmp, 'speech') });
const engine = new RemotionEngine({ entry: base.remotionEntry, watchDirs: base.watchDirs, templates: templateDefinitions, log: () => {} });
let port = 0;
const queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: outDir, assetBaseUrl: () => `http://127.0.0.1:${port}` });
const server = createApp({ store, queue, templates: templateDefinitions, speech, maxUploadBytes: base.maxUploadBytes }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
port = (server.address() as { port: number }).port;
await fs.mkdir(outDir, { recursive: true });
const started = Date.now();

let uploadId: string | undefined;
let transcript = opt('transcript') ? await fs.readFile(opt('transcript')!, 'utf8') : undefined;
if (isText) transcript = await fs.readFile(input, 'utf8');
else {
  const up = await speech.upload(await fs.readFile(input), path.basename(input));
  uploadId = up.id;
  console.log(`áudio: ${up.duration.toFixed(1)} s`);
  if (!transcript) {
    await speech.transcribe(up.id, opt('language'));
    for (;;) {
      const s = await speech.get(up.id);
      process.stdout.write(`\rtranscrevendo… ${Math.round(s.progress * 100)}%   `);
      if (s.status === 'transcribed') break;
      if (s.status === 'error') throw new Error(s.error ?? 'transcription failed');
      await new Promise((r) => setTimeout(r, 1000));
    }
    const s = await speech.get(up.id);
    console.log(`\ntranscrição (${s.language}, ${((Date.now() - started) / 1000).toFixed(0)} s): ${s.text}`);
  }
}

const project = await createSpeechProject({ store, speech }, { speech: { ...(transcript ? { transcript } : {}), ...(uploadId ? { uploadId } : {}), ...(opt('theme') ? { themeId: opt('theme')! } : {}) }, format: formats[0]! });
const sidecar = (await store.readSpeech(project.id)) as SpeechSidecar;
console.log(`\nplano: ${sidecar.plan.scenes.length} cenas, ${sidecar.plan.duration.toFixed(1)} s · nota ${sidecar.score.total} ${JSON.stringify(sidecar.score.parts)}`);
sidecar.plan.scenes.forEach((s, i) => {
  const idea = sidecar.plan.ideas[s.idea]!;
  console.log(`${String(i + 1).padStart(2)} ${s.start.toFixed(1).padStart(5)}s +${s.duration.toFixed(1)}s ${sceneDefinitions.get(s.type).name.padEnd(26)} «${idea.text}»\n      ${s.reasons.slice(1, 3).join(' · ')}`);
});

const stem = path.basename(input).replace(/\.[^.]+$/, '');
await fs.writeFile(path.join(outDir, `${stem}.plan.json`), JSON.stringify(sidecar, null, 2));
for (const format of formats) {
  const p: MotionProject = format === project.format ? project : await store.save(project.id, { ...(await store.get(project.id)), format });
  const job = await queue.submit({ projectId: p.id, format });
  while (['queued', 'running'].includes(queue.get(job.id).status)) {
    const j = queue.get(job.id);
    process.stdout.write(`\r${format}: ${j.stage} ${(j.progress * 100).toFixed(0)}%   `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const done = queue.get(job.id);
  process.stdout.write('\n');
  if (done.status !== 'succeeded' || !done.outputPath) {
    console.error(`FALHOU ${format}: ${done.error}`);
    process.exitCode = 1;
    continue;
  }
  await fs.writeFile(`${done.outputPath}.project.json`, JSON.stringify({ ...(await store.get(project.id)), format }, null, 2));
  console.log(`  -> ${done.outputPath} (${((done.outputSize ?? 0) / 1e6).toFixed(1)} MB)`);
}
await queue.idle();
server.close();
await fs.rm(tmp, { recursive: true, force: true });
console.log(`Pronto em ${((Date.now() - started) / 1000).toFixed(0)} s`);
