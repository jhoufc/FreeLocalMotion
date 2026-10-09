/**
 * End-to-end check of local media through the production pipeline:
 *  - uploads a generated PNG and WAV through the HTTP API (same calls as the Studio)
 *  - uses the image as a scene background and the WAV as soundtrack, at 60 fps
 *  - renders a frame range and verifies 60 fps video + AAC audio with ffprobe
 *  - extracts a frame where the image background is visible
 *
 *   pnpm verify:media
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setAtPath, type MotionProject } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';
import { createApp } from '@lms/server/src/api/app';
import { loadConfig } from '@lms/server/src/config';
import { ProjectStore } from '@lms/server/src/projects/store';
import { RenderQueue } from '@lms/server/src/rendering/queue';
import { RemotionEngine } from '@lms/server/src/rendering/remotion-engine';

const base = loadConfig();
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-media-'));
const outDir = path.join(base.exportsDir, 'samples');
const store = new ProjectStore(path.join(tmp, 'projects'), templateDefinitions);
const engine = new RemotionEngine({ entry: base.remotionEntry, watchDirs: base.watchDirs, templates: templateDefinitions });
let port = 0;
const queue = new RenderQueue({ engine, store, templates: templateDefinitions, exportsDir: outDir, assetBaseUrl: () => `http://127.0.0.1:${port}` });
const server = createApp({ store, queue, templates: templateDefinitions, maxUploadBytes: base.maxUploadBytes }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
port = (server.address() as { port: number }).port;
const api = `http://127.0.0.1:${port}/api`;

// Generated media (no external downloads).
const png = path.join(tmp, 'photo.png');
const wav = path.join(tmp, 'tone.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'gradients=s=1920x1080:c0=0xff3d7f:c1=0x1b1464:x0=0:y0=0:x1=1920:y1=1080:n=2', '-frames:v', '1', png]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=16', '-ac', '2', wav]);

const post = async (url: string, body: BodyInit, json = false) => {
  const res = await fetch(url, { method: 'POST', body, headers: json ? { 'content-type': 'application/json' } : {} });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<unknown>;
};

const project = (await post(`${api}/projects`, JSON.stringify({ templateId: 'signature-001', name: 'Media check', format: 'landscape' }), true)) as MotionProject;
const img = (await post(`${api}/projects/${project.id}/assets?name=photo.png`, await fs.readFile(png))) as { project: MotionProject; asset: { id: string } };
const snd = (await post(`${api}/projects/${project.id}/assets?name=tone.wav`, await fs.readFile(wav))) as { project: MotionProject; asset: { id: string } };

let edited: MotionProject = snd.project;
edited = setAtPath(edited, ['fps'], 60);
edited = setAtPath(edited, ['scenes', 0, 'background', 'mode'], 'image');
edited = setAtPath(edited, ['scenes', 0, 'background', 'image', 'assetId'], img.asset.id);
edited = setAtPath(edited, ['scenes', 0, 'background', 'image', 'overlayOpacity'], 0.35);
edited = setAtPath(edited, ['audio', 'assetId'], snd.asset.id);
const put = await fetch(`${api}/projects/${project.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(edited) });
if (!put.ok) throw new Error(`save failed: ${await put.text()}`);

const job = (await post(`${api}/renders`, JSON.stringify({ projectId: project.id, frameRange: [0, 179] }), true)) as { id: string };
await queue.idle();
const done = queue.get(job.id);
server.close();
if (done.status !== 'succeeded') throw new Error(`render failed: ${done.error}`);

const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', done.outputPath!], { encoding: 'utf8' }),
) as { streams: { codec_type: string; codec_name: string; r_frame_rate?: string; nb_frames?: string; sample_rate?: string }[] };
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const frame = done.outputPath!.replace(/\.mp4$/, '.frame.jpg');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', done.outputPath!, '-vf', 'select=eq(n\\,150),scale=960:-2', '-vsync', '0', '-frames:v', '1', frame]);

const checks: [boolean, string][] = [
  [v?.codec_name === 'h264' && v?.r_frame_rate === '60/1', `video ${v?.codec_name} @ ${v?.r_frame_rate}`],
  [Number(v?.nb_frames) === 180, `frames ${v?.nb_frames}`],
  [a?.codec_name === 'aac', `audio ${a?.codec_name ?? 'none'} ${a?.sample_rate ?? ''}`],
];
for (const [ok, label] of checks) console.log(`${ok ? '✔' : '✘'} ${label}`);
console.log(`output: ${done.outputPath}\nframe with image background: ${frame}`);
await fs.rm(tmp, { recursive: true, force: true });
process.exit(checks.every(([ok]) => ok) ? 0 : 1);
