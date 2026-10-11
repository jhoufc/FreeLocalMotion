import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAtPath, type MotionProject } from '@lms/shared';
import { duplicateScene, insertScene, moveScene } from '@lms/template-sdk';
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

  it('8: saves and reopens a project with duplicated, reordered scenes', async () => {
    const p = await store.create('signature-001', { format: 'portrait' });
    const template = templateDefinitions.get('signature-001');
    let edited = duplicateScene(p, 'impact').project;
    const copyId = edited.scenes[1]!.id;
    edited = setAtPath(edited, ['scenes', 1, 'texts', 'lineA', 'content'], '100% LOCAL');
    edited = moveScene(edited, 'signature', 0);
    edited = insertScene(edited, template.createScene('energy', { id: 'energy-extra', name: 'Energy #2' }));
    await store.save(p.id, edited);
    const reopened = await store.get(p.id);
    expect(reopened.scenes.map((s) => s.id)).toEqual(['signature', 'impact', copyId, 'energy', 'transformation', 'energy-extra']);
    const text = (id: string) => (reopened.scenes.find((s) => s.id === id) as unknown as { texts: { lineA: { content: string } } }).texts.lineA.content;
    expect(text(copyId)).toBe('100% LOCAL');
    expect(text('impact')).toBe('The Future');
    expect(template.getMetadata(reopened).durationInFrames).toBe(450 + 90 + 90);
  });

  it('9: migrates a 1.0.0 project on open, keeps a backup and preserves its content', async () => {
    const id = 'p-legacy0001';
    const current = templateDefinitions.get('signature-001').createDefaults({ id, name: 'Legacy', format: 'landscape', now: '2026-01-01T00:00:00.000Z' });
    const legacy = {
      ...structuredClone(current),
      schemaVersion: 1,
      templateVersion: '1.0.0',
      origin: undefined,
      scenes: current.scenes.map(({ type: _t, enabled: _e, ...rest }) => ({ ...rest, name: rest.id === 'energy' ? 'Benefício' : rest.name })),
    };
    await fs.mkdir(path.join(dir, id), { recursive: true });
    await fs.writeFile(path.join(dir, id, 'project.json'), JSON.stringify(legacy));
    const opened = await store.get(id);
    expect(opened.schemaVersion).toBe(3);
    expect(opened.origin).toEqual({ kind: 'template', templateId: 'signature-001', version: '1.0.0' });
    expect(opened.scenes.map((s) => [s.id, s.type, s.name])).toEqual([
      ['impact', 'impact', 'Impact'],
      ['energy', 'energy', 'Benefício'],
      ['transformation', 'transformation', 'Transformation'],
      ['signature', 'signature', 'Signature'],
    ]);
    const files = await fs.readdir(path.join(dir, id));
    expect(files).toContain('project.backup-v1-1.0.0.json');
    expect(JSON.parse(await fs.readFile(path.join(dir, id, 'project.backup-v1-1.0.0.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(legacy)));
    expect(JSON.parse(await fs.readFile(path.join(dir, id, 'project.json'), 'utf8')).schemaVersion).toBe(3);
    expect((await store.list()).map((p) => p.id)).toContain(id);
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
