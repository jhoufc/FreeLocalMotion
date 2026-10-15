import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MotionProject, SpeechUpload } from '@lms/shared';
import { COMPOSITION_TEMPLATE_ID, templateDefinitions } from '@lms/catalog/definitions';
import { createApp } from '../src/api/app';
import { loadConfig } from '../src/config';
import { ProjectStore } from '../src/projects/store';
import { SpeechService } from '../src/speech/service';
import type { RenderQueue } from '../src/rendering/queue';

const TRANSCRIPT = [
  'Três erros que estão matando o alcance dos seus Reels.',
  'Erro número um: começar o vídeo com bom dia.',
  'Erro número dois: legenda pequena demais. Setenta por cento das pessoas assistem sem som.',
  'O terceiro erro é não ter uma chamada no final.',
  'Me segue para mais dicas.',
].join(' ');

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

let root: string;
let server: Server;
let base: string;
let store: ProjectStore;

const call = async <T>(method: string, url: string, body?: unknown, raw?: Buffer): Promise<{ status: number; data: T }> => {
  const res = await fetch(`${base}/api${url}`, {
    method,
    headers: raw ? { 'content-type': 'application/octet-stream' } : body ? { 'content-type': 'application/json' } : {},
    body: raw ? new Uint8Array(raw) : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as T };
};

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-speech-'));
  store = new ProjectStore(path.join(root, 'projects'), templateDefinitions);
  const speech = new SpeechService({ ...loadConfig().speech, dir: path.join(root, 'speech') });
  server = createApp({ store, queue: {} as RenderQueue, templates: templateDefinitions, speech, maxUploadBytes: 1e6 }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.close();
  await fs.rm(root, { recursive: true, force: true });
});

describe('speech API', () => {
  it('reports what this machine can do', async () => {
    const { data } = await call<{ media: boolean; transcription: boolean }>('GET', '/speech/capabilities');
    expect(typeof data.media).toBe('boolean');
    expect(typeof data.transcription).toBe('boolean');
  });

  it('previews a plan without saving anything', async () => {
    const { status, data } = await call<{ plan: { scenes: { type: string; reasons: string[] }[] }; score: { total: number } }>('POST', '/speech/plan', { speech: { transcript: TRANSCRIPT } });
    expect(status).toBe(200);
    expect(data.plan.scenes.length).toBeGreaterThanOrEqual(4);
    expect(data.plan.scenes.every((s) => s.reasons.length > 0)).toBe(true);
    expect((await store.list()).length).toBe(0);
  });

  it('creates an editable free composition and keeps the plan next to it', async () => {
    const { status, data: project } = await call<MotionProject>('POST', '/projects', { templateId: COMPOSITION_TEMPLATE_ID, format: 'landscape', speech: { transcript: TRANSCRIPT, themeId: 'creator-intro' } });
    expect(status).toBe(201);
    expect(project.format).toBe('landscape');
    expect(project.origin).toMatchObject({ kind: 'template', templateId: 'speech' });
    const { data: sidecar } = await call<{ plan: { scenes: unknown[] }; transcript: { words: unknown[] } }>('GET', `/projects/${project.id}/speech`);
    expect(sidecar.plan.scenes).toHaveLength(project.scenes.length);
    expect(sidecar.transcript.words.length).toBeGreaterThan(30);
    // An ordinary project: it opens, validates and can be edited like any other.
    expect((await store.get(project.id)).scenes).toHaveLength(project.scenes.length);
  });

  it('forces the scene the user picked for an idea', async () => {
    const { data } = await call<{ plan: { scenes: { origin: number; part: number; type: string }[] } }>('POST', '/speech/plan', { speech: { transcript: TRANSCRIPT, force: { '0': 'impact' } } });
    expect(data.plan.scenes.find((s) => s.origin === 0 && s.part === 0)!.type).toBe('impact');
  });

  it('rejects requests without speech and speech on a template project', async () => {
    expect((await call('POST', '/speech/plan', { speech: {} })).status).toBe(400);
    expect((await call('POST', '/projects', { templateId: 'signature-001', speech: { transcript: TRANSCRIPT } })).status).toBe(400);
  });

  it.runIf(hasFfmpeg)('extracts the audio of an upload and uses it as the soundtrack', async () => {
    const wav = path.join(root, 'tone.wav');
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=14', wav]);
    const { status, data: up } = await call<SpeechUpload>('POST', '/speech/uploads?name=voz.wav', undefined, await fs.readFile(wav));
    expect(status).toBe(201);
    expect(up.duration).toBeCloseTo(14, 0);
    // Pasted transcript + uploaded audio: the plan is stretched to the audio length.
    const { data: project } = await call<MotionProject>('POST', '/projects', { templateId: COMPOSITION_TEMPLATE_ID, speech: { transcript: TRANSCRIPT, uploadId: up.id } });
    expect(project.audio.assetId).toBeTruthy();
    const asset = project.assets.find((a) => a.id === project.audio.assetId)!;
    expect(asset.kind).toBe('audio');
    await expect(fs.stat(store.assetPath(project.id, asset.fileName))).resolves.toBeTruthy();
    const total = project.scenes.reduce((a, s) => a + s.duration, 0);
    expect(total).toBeGreaterThanOrEqual(14 - 0.05);
    expect(total).toBeLessThanOrEqual(14 + 1.6);
    // Garbage is refused with a clear message.
    expect((await call('POST', '/speech/uploads?name=x.mp3', undefined, Buffer.from('not audio at all'))).status).toBe(415);
  });
});
