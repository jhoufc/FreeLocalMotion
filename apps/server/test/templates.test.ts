import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAtPath, type MotionProject } from '@lms/shared';
import { duplicateScene, insertScene, moveScene } from '@lms/template-sdk';
import { COMPOSITION_TEMPLATE_ID, sceneDefinitions, templateDefinitions } from '@lms/catalog/definitions';
import { HttpError, ProjectStore } from '../src/projects/store';
import { TemplateLibrary } from '../src/templates/library';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

let root: string;
let store: ProjectStore;
let library: TemplateLibrary;
const thumbs: number[] = [];

const makeLibrary = () =>
  new TemplateLibrary(path.join(root, 'templates'), {
    projects: store,
    templates: templateDefinitions,
    thumbnailer: async (_p, frame, out) => {
      thumbs.push(frame);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, 'jpg');
    },
  });

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'lms-tpl-'));
  store = new ProjectStore(path.join(root, 'projects'), templateDefinitions);
  library = makeLibrary();
  thumbs.length = 0;
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const scene = (type: string, id: string) => sceneDefinitions.get(type).create({ id, name: sceneDefinitions.get(type).name });
const textOf = (p: MotionProject, id: string, key: string) => (p.scenes.find((s) => s.id === id) as unknown as { texts: Record<string, { content: string }> }).texts[key]!.content;

/** A free composition with mixed families, an image background and custom copy. */
const composeFree = async () => {
  const blank = await store.create(COMPOSITION_TEMPLATE_ID, { format: 'portrait' });
  const { asset } = await store.addAsset(blank.id, PNG, 'cover.png');
  let p = await store.get(blank.id);
  p = insertScene(p, scene('impact', 'impact-a'));
  p = insertScene(p, scene('energy', 'energy-a'));
  p = duplicateScene(p, 'impact-a', 'impact-b').project;
  p = setAtPath(p, ['scenes', 1, 'texts', 'lineA', 'content'], 'Second');
  p = setAtPath(p, ['scenes', 2, 'background', 'mode'], 'image');
  p = setAtPath(p, ['scenes', 2, 'background', 'image', 'assetId'], asset.id);
  p = moveScene(p, 'energy-a', 0);
  return store.save(p.id, p);
};

describe('free composition projects', () => {
  it('1: starts empty, portrait, 30 fps, named "Nova composição"', async () => {
    const p = await store.create(COMPOSITION_TEMPLATE_ID, { format: 'portrait' });
    expect(p).toMatchObject({ name: 'Nova composição', fps: 30, format: 'portrait', scenes: [], origin: { kind: 'blank' } });
    expect(templateDefinitions.get(COMPOSITION_TEMPLATE_ID).getTimeline(p).durationInFrames).toBe(0);
    expect((await store.list())[0]).toMatchObject({ id: p.id, sceneCount: 0, origin: { kind: 'blank' } });
  });

  it('9: saves and reopens a mixed composition', async () => {
    const saved = await composeFree();
    const reopened = await new ProjectStore(path.join(root, 'projects'), templateDefinitions).get(saved.id);
    expect(reopened.scenes.map((s) => s.id)).toEqual(['energy-a', 'impact-a', 'impact-b']);
    expect(textOf(reopened, 'impact-b', 'lineA')).toBe('Second');
    expect(textOf(reopened, 'impact-a', 'lineA')).toBe('The Future');
  });
});

describe('starter compositions', () => {
  it('creates an independent free composition from a starter and can save it as a template', async () => {
    const p = await store.create(COMPOSITION_TEMPLATE_ID, { starterId: 'creator-intro', format: 'portrait', name: 'Minha intro' });
    expect(p).toMatchObject({ name: 'Minha intro', format: 'portrait', origin: { kind: 'template', templateId: 'starter:creator-intro' } });
    expect(p.scenes.map((s) => s.type)).toEqual(['morph-line', 'semantic-words', 'brand-reveal', 'number-impact', 'cinematic-outro']);
    const edited = await store.save(p.id, setAtPath(p, ['scenes', 2, 'texts', 'name', 'content'], 'Ana Lima'));
    expect(textOf(edited, 'creator-brand', 'name')).toBe('Ana Lima');
    const t = await library.createFromProject({ projectId: p.id, name: 'Intro da Ana', description: '', category: 'signature' });
    expect(t.sceneCount).toBe(5);
    await expect(store.create('signature-001', { starterId: 'creator-intro' })).rejects.toMatchObject({ status: 400 });
    await expect(store.create(COMPOSITION_TEMPLATE_ID, { starterId: 'nope' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('user templates', () => {
  it('11 + 16: saving copies the composition, its assets and a thumbnail', async () => {
    const project = await composeFree();
    const t = await library.createFromProject({ projectId: project.id, name: 'Lançamento', description: 'Teaser', category: 'signature' });
    expect(t).toMatchObject({ name: 'Lançamento', revision: 1, sceneCount: 3, format: 'portrait', thumbnail: 'thumb-r1.jpg' });
    const { document } = await library.get(t.id);
    expect(document.templateId).toBe(COMPOSITION_TEMPLATE_ID);
    expect(document.scenes.map((s) => s.type)).toEqual(['energy', 'impact', 'impact']);
    expect(document.assets).toHaveLength(1);
    expect(await fs.readFile(library.assetPath(t.id, document.assets[0]!.fileName))).toEqual(PNG);
    // The source project can go away: the template keeps its own asset copies.
    await store.remove(project.id);
    const fromTemplate = await library.createProject(t.id, { name: 'Novo' });
    expect(await fs.readFile(store.assetPath(fromTemplate.id, fromTemplate.assets[0]!.fileName))).toEqual(PNG);
  });

  it('12 + 13: projects from a template are independent copies', async () => {
    const t = await library.createFromProject({ projectId: (await composeFree()).id, name: 'Base', description: '', category: 'typography' });
    const a = await library.createProject(t.id, { format: 'landscape' });
    expect(a.origin).toEqual({ kind: 'user-template', templateId: t.id, revision: 1, name: 'Base' });
    expect(a.format).toBe('landscape');
    const edited = await store.save(a.id, setAtPath(a, ['scenes', 1, 'texts', 'lineA', 'content'], 'Changed'));
    expect(textOf(edited, 'impact-a', 'lineA')).toBe('Changed');
    const { document } = await library.get(t.id);
    expect(textOf(document, 'impact-a', 'lineA')).toBe('The Future');
    const b = await library.createProject(t.id);
    expect(textOf(b, 'impact-a', 'lineA')).toBe('The Future');
    expect(b.id).not.toBe(a.id);
  });

  it('14: templates survive a server restart', async () => {
    const t = await library.createFromProject({ projectId: (await composeFree()).id, name: 'Persistente', description: 'x', category: 'data' });
    const fresh = makeLibrary();
    expect((await fresh.list()).map((x) => x.id)).toEqual([t.id]);
    expect((await fresh.get(t.id)).document.scenes).toHaveLength(3);
  });

  it('editing works on a draft and publishing creates a new revision without touching older projects', async () => {
    const t = await library.createFromProject({ projectId: (await composeFree()).id, name: 'Rev', description: '', category: 'editorial' });
    const fromR1 = await library.createProject(t.id);
    const draft = await library.startDraft(t.id);
    expect(draft.origin).toMatchObject({ kind: 'template-draft', templateId: t.id, revision: 1 });
    const changed = await store.save(draft.id, setAtPath(draft, ['scenes', 1, 'texts', 'lineA', 'content'], 'Revisão 2'));
    // Not published yet: the template is unchanged.
    expect(textOf((await library.get(t.id)).document, 'impact-a', 'lineA')).toBe('The Future');
    const published = await library.publish(t.id, changed.id);
    expect(published.revision).toBe(2);
    expect(published.revisions.map((r) => r.revision)).toEqual([1, 2]);
    expect(textOf((await library.get(t.id)).document, 'impact-a', 'lineA')).toBe('Revisão 2');
    expect(textOf((await library.get(t.id, 1)).document, 'impact-a', 'lineA')).toBe('The Future');
    expect(textOf(await store.get(fromR1.id), 'impact-a', 'lineA')).toBe('The Future');
    expect((await store.get(changed.id)).origin).toMatchObject({ kind: 'template-draft', revision: 2 });
  });

  it('rename, duplicate and 19: delete never removes projects', async () => {
    const t = await library.createFromProject({ projectId: (await composeFree()).id, name: 'Original', description: '', category: 'product' });
    const renamed = await library.update(t.id, { name: 'Renomeado', category: 'technology' });
    expect(renamed).toMatchObject({ name: 'Renomeado', category: 'technology' });
    const copy = await library.duplicate(t.id);
    expect(copy.name).toBe('Renomeado (cópia)');
    expect((await library.get(copy.id)).document.id).toBe(copy.id);
    const project = await library.createProject(t.id);
    await library.remove(t.id);
    await expect(library.get(t.id)).rejects.toBeInstanceOf(HttpError);
    expect((await store.get(project.id)).scenes).toHaveLength(3);
    expect((await library.list()).map((x) => x.id)).toEqual([copy.id]);
  });

  it('converts a Signature / 001 project into a template', async () => {
    const sig = await store.create('signature-001', { format: 'landscape' });
    const t = await library.createFromProject({ projectId: sig.id, name: 'Do Signature', description: '', category: 'signature' });
    const { document } = await library.get(t.id);
    expect(document.templateId).toBe(COMPOSITION_TEMPLATE_ID);
    expect(document.scenes.map((s) => s.type)).toEqual(['impact', 'energy', 'transformation', 'signature']);
  });

  it('refuses to save an empty composition', async () => {
    const blank = await store.create(COMPOSITION_TEMPLATE_ID);
    await expect(library.createFromProject({ projectId: blank.id, name: 'Vazio', description: '', category: 'data' })).rejects.toMatchObject({ status: 422 });
    expect(await library.list()).toEqual([]);
  });
});
