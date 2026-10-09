import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAtPath, type MotionProject } from '@lms/shared';
import { templateDefinitions } from '@lms/catalog/definitions';
import { HttpError, ProjectStore } from '../src/projects/store';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64)]);

let dir: string;
let store: ProjectStore;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-store-'));
  store = new ProjectStore(dir, templateDefinitions);
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const expectHttp = async (p: Promise<unknown>, status: number) => {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((e: HttpError) => expect(e.status).toBe(status));
};

describe('ProjectStore', () => {
  it('creates, persists and reopens a project', async () => {
    const created = await store.create('signature-001', { name: 'Launch film', format: 'landscape' });
    const file = path.join(dir, created.id, 'project.json');
    expect(JSON.parse(await fs.readFile(file, 'utf8')).name).toBe('Launch film');
    const reopened = await store.get(created.id);
    expect(reopened).toEqual(created);
    expect((await store.list()).map((p) => p.id)).toEqual([created.id]);
  });

  it('saves validated edits and rejects invalid documents without touching disk', async () => {
    const p = await store.create('signature-001');
    const edited = setAtPath(p, ['scenes', 0, 'texts', 'lineA', 'content'], 'O futuro');
    const saved = await store.save(p.id, edited);
    expect((saved.scenes[0] as unknown as { texts: { lineA: { content: string } } }).texts.lineA.content).toBe('O futuro');
    expect(saved.createdAt).toBe(p.createdAt);

    const before = await fs.readFile(path.join(dir, p.id, 'project.json'), 'utf8');
    await expectHttp(store.save(p.id, setAtPath(p, ['scenes', 0, 'duration'], 99)), 422);
    await expectHttp(store.save(p.id, { ...p, templateId: 'other' }), 422);
    expect(await fs.readFile(path.join(dir, p.id, 'project.json'), 'utf8')).toBe(before);
  });

  it('refuses to overwrite a newer version saved elsewhere (optimistic concurrency)', async () => {
    const p = await store.create('signature-001');
    const windowA = setAtPath(p, ['name'], 'Edited in window A');
    const windowB = setAtPath(p, ['name'], 'Edited in window B');
    const savedA = await store.save(p.id, windowA);
    await expectHttp(store.save(p.id, windowB), 409);
    expect((await store.get(p.id)).name).toBe('Edited in window A');
    // Continuing from the saved version works; an explicit overwrite also works.
    await store.save(p.id, setAtPath(savedA, ['name'], 'A again'));
    expect((await store.save(p.id, windowB, { force: true })).name).toBe('Edited in window B');
  });

  it('stores uploads under stable names and references them', async () => {
    const p = await store.create('signature-001');
    const { asset, project } = await store.addAsset(p.id, PNG, 'photo.png');
    expect(asset.fileName).toMatch(/^a-[a-z0-9]+\.png$/);
    expect(asset.kind).toBe('image');
    expect(project.assets).toHaveLength(1);
    expect(await fs.readFile(store.assetPath(p.id, asset.fileName))).toEqual(PNG);

    const withBg = setAtPath(setAtPath(project, ['scenes', 1, 'background', 'mode'], 'image'), ['scenes', 1, 'background', 'image', 'assetId'], asset.id);
    await store.save(p.id, withBg);
    expect(await store.verifyAssetFiles(withBg)).toEqual([]);
    await expectHttp(store.removeAsset(p.id, asset.id), 409);

    const audio = await store.addAsset(p.id, MP3, 'track.mp3');
    expect(audio.asset.kind).toBe('audio');
    await expectHttp(store.addAsset(p.id, Buffer.from('not media at all'), 'x.png'), 415);
  });

  it('duplicates projects including their assets', async () => {
    const p = await store.create('signature-001');
    const { asset } = await store.addAsset(p.id, PNG, 'photo.png');
    const copy = await store.duplicate(p.id);
    expect(copy.id).not.toBe(p.id);
    expect(copy.name).toMatch(/cópia/);
    expect(await fs.readFile(store.assetPath(copy.id, asset.fileName))).toEqual(PNG);
  });

  it('imports JSON with a fresh id and drops binary references it cannot carry', async () => {
    const p = await store.create('signature-001');
    const { project } = await store.addAsset(p.id, PNG, 'photo.png');
    const exported = setAtPath(setAtPath(project, ['scenes', 1, 'background', 'mode'], 'image'), ['scenes', 1, 'background', 'image', 'assetId'], project.assets[0]!.id);
    const imported = await store.import(JSON.parse(JSON.stringify(exported)));
    expect(imported.id).not.toBe(p.id);
    expect(imported.assets).toEqual([]);
    expect(imported.scenes[1]!.background.mode).toBe('procedural');
    await expectHttp(store.import({ hello: 'world' }), 422);
  });

  it('migrates nothing silently and rejects future schema versions', async () => {
    const p = await store.create('signature-001');
    await fs.writeFile(path.join(dir, p.id, 'project.json'), JSON.stringify({ ...p, schemaVersion: 99 }));
    await expectHttp(store.get(p.id), 422);
  });

  it('guards ids and file names against traversal', async () => {
    await expectHttp(store.get('../../etc'), 400);
    expect(() => store.assetPath('p-abcdef12', '../secret.txt')).toThrow();
  });

  it('deletes projects', async () => {
    const p: MotionProject = await store.create('signature-001');
    await store.remove(p.id);
    await expectHttp(store.get(p.id), 404);
  });
});
