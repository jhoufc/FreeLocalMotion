import fs from 'node:fs/promises';
import path from 'node:path';
import {
  collectAssetIds,
  createId,
  type Format,
  type MotionProject,
  type ProjectOrigin,
  type SaveTemplateRequest,
  type SceneCategory,
  type UpdateTemplateRequest,
  type UserTemplateRevision,
  type UserTemplateSummary,
} from '@lms/shared';
import { computeSceneRanges, heroFrameOf, projectDurationInFrames, type AnyTemplateDefinition, type TemplateRegistry } from '@lms/template-sdk';
import { sceneDefinitions, toComposition } from '@lms/catalog/definitions';
import { HttpError, type ProjectStore } from '../projects/store';
import { exists, readJson, safeJoin, writeJsonAtomic } from '../storage/files';

/** Renders one frame of a project to an image file (Remotion in production, a stub in tests). */
export type Thumbnailer = (project: MotionProject, frame: number, outputPath: string) => Promise<void>;

interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  revision: number;
  revisions: (UserTemplateRevision & { format: Format })[];
  createdAt: string;
  updatedAt: string;
}

const META = 'template.json';
const ASSETS = 'assets';
const REVISIONS = 'revisions';

/**
 * User templates: compositions saved as reusable starting points.
 *
 *   templates/<id>/template.json        name, description, category, revision history
 *   templates/<id>/revisions/r<n>.json  immutable composition snapshot of each revision
 *   templates/<id>/assets/<file>        copies of every asset any revision references
 *   templates/<id>/thumb-r<n>.jpg       representative frame of each revision
 *
 * A template never references project files: assets are copied in when a revision is
 * saved and copied out when a project is created, so deleting either side is safe.
 * Revisions are immutable — editing a template publishes a new revision; projects created
 * from older revisions are untouched.
 */
export class TemplateLibrary {
  constructor(
    private readonly root: string,
    private readonly opts: {
      projects: ProjectStore;
      templates: TemplateRegistry<AnyTemplateDefinition>;
      thumbnailer?: Thumbnailer;
      log?: (msg: string) => void;
    },
  ) {}

  private dir(id: string): string {
    if (!/^t-[a-z0-9]{6,32}$/.test(id)) throw new HttpError(400, 'Invalid template id');
    return safeJoin(this.root, id);
  }

  assetPath(id: string, fileName: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) throw new HttpError(400, 'Invalid file name');
    return safeJoin(this.dir(id), ASSETS, fileName);
  }

  thumbnailPath(id: string, fileName: string): string {
    if (!/^thumb-r\d+\.jpg$/.test(fileName)) throw new HttpError(400, 'Invalid thumbnail name');
    return safeJoin(this.dir(id), fileName);
  }

  private async readMeta(id: string): Promise<TemplateMeta> {
    const file = path.join(this.dir(id), META);
    if (!(await exists(file))) throw new HttpError(404, `Template "${id}" not found`);
    return (await readJson(file)) as TemplateMeta;
  }

  private summary(meta: TemplateMeta): UserTemplateSummary {
    const current = meta.revisions.find((r) => r.revision === meta.revision) ?? meta.revisions[meta.revisions.length - 1]!;
    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      revision: meta.revision,
      revisions: meta.revisions.map(({ format: _f, ...r }) => r),
      format: current.format,
      sceneCount: current.sceneCount,
      durationSeconds: current.durationSeconds,
      thumbnail: current.thumbnail,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
    };
  }

  /** Validates a revision document with the composition template (migrating old ones). */
  private parseDocument(raw: unknown): MotionProject {
    return this.opts.projects.validate(raw).project;
  }

  async list(): Promise<UserTemplateSummary[]> {
    await fs.mkdir(this.root, { recursive: true });
    const out: UserTemplateSummary[] = [];
    for (const e of await fs.readdir(this.root, { withFileTypes: true })) {
      if (!e.isDirectory() || !/^t-[a-z0-9]{6,32}$/.test(e.name)) continue;
      try {
        out.push(this.summary(await this.readMeta(e.name)));
      } catch {
        // An unreadable template folder is skipped, never deleted.
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Summary + the document of a revision (current by default). */
  async get(id: string, revision?: number): Promise<{ template: UserTemplateSummary; document: MotionProject }> {
    const meta = await this.readMeta(id);
    const rev = revision ?? meta.revision;
    if (!meta.revisions.some((r) => r.revision === rev)) throw new HttpError(404, `Revision ${rev} not found`);
    const document = this.parseDocument(await readJson(path.join(this.dir(id), REVISIONS, `r${rev}.json`)));
    return { template: this.summary(meta), document };
  }

  /**
   * Writes revision `revision` of template `id` from a project: converts it to a free
   * composition, copies every referenced asset and (best effort) renders a thumbnail.
   */
  private async writeRevision(id: string, revision: number, source: MotionProject): Promise<TemplateMeta['revisions'][number]> {
    let doc: MotionProject;
    try {
      doc = toComposition(source) as MotionProject;
    } catch (err) {
      throw new HttpError(422, err instanceof Error ? err.message : String(err));
    }
    if (!doc.scenes.some((s) => s.enabled)) throw new HttpError(422, 'Adicione ao menos uma cena ativa antes de salvar como template.');
    // Keep only assets the document actually uses (integrity + no orphan copies).
    const used = collectAssetIds({ ...doc, assets: [] });
    const assets = doc.assets.filter((a) => used.has(a.id));
    for (const asset of assets) {
      const src = this.opts.projects.assetPath(source.id, asset.fileName);
      if (!(await exists(src))) throw new HttpError(422, `Arquivo de asset ausente no projeto: ${asset.originalName}`);
      const dest = this.assetPath(id, asset.fileName);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      if (!(await exists(dest))) await fs.copyFile(src, dest);
    }
    const now = new Date().toISOString();
    const snapshot: MotionProject = { ...doc, id, assets, origin: { kind: 'blank' }, createdAt: now, updatedAt: now };
    const valid = this.parseDocument(snapshot);
    await writeJsonAtomic(path.join(this.dir(id), REVISIONS, `r${revision}.json`), valid);

    const thumbName = `thumb-r${revision}.jpg`;
    const thumbnail = await this.renderThumbnail(source, path.join(this.dir(id), thumbName)).then((ok) => (ok ? thumbName : null));
    return {
      revision,
      createdAt: now,
      sceneCount: valid.scenes.length,
      durationSeconds: projectDurationInFrames(valid.scenes, valid.fps) / valid.fps,
      thumbnail,
      format: valid.format,
    };
  }

  /** Representative frame: the settled moment of the first enabled scene. */
  private async renderThumbnail(project: MotionProject, outputPath: string): Promise<boolean> {
    if (!this.opts.thumbnailer) return false;
    const range = computeSceneRanges(project.scenes, project.fps)[0];
    if (!range) return false;
    const scene = project.scenes[range.index]!;
    const def = sceneDefinitions.find(scene.type);
    const frame = range.from + (def ? heroFrameOf(def, scene.duration, project.fps, scene) : Math.round(range.durationInFrames * 0.6));
    try {
      await this.opts.thumbnailer(project, frame, outputPath);
      return true;
    } catch (err) {
      this.opts.log?.(`thumbnail failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async createFromProject(req: SaveTemplateRequest & { description: string }): Promise<UserTemplateSummary> {
    const project = await this.opts.projects.get(req.projectId);
    const id = createId('t-');
    const now = new Date().toISOString();
    try {
      const rev = await this.writeRevision(id, 1, project);
      const meta: TemplateMeta = { id, name: req.name, description: req.description, category: req.category, revision: 1, revisions: [rev], createdAt: now, updatedAt: now };
      await writeJsonAtomic(path.join(this.dir(id), META), meta);
      return this.summary(meta);
    } catch (err) {
      await fs.rm(this.dir(id), { recursive: true, force: true });
      throw err;
    }
  }

  async update(id: string, patch: UpdateTemplateRequest): Promise<UserTemplateSummary> {
    const meta = await this.readMeta(id);
    const next: TemplateMeta = {
      ...meta,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      updatedAt: new Date().toISOString(),
    };
    await writeJsonAtomic(path.join(this.dir(id), META), next);
    return this.summary(next);
  }

  /** Independent copy (all revisions, assets and thumbnails) under a new id. */
  async duplicate(id: string): Promise<UserTemplateSummary> {
    const meta = await this.readMeta(id);
    const copyId = createId('t-');
    await fs.cp(this.dir(id), this.dir(copyId), { recursive: true });
    for (const r of meta.revisions) {
      const file = path.join(this.dir(copyId), REVISIONS, `r${r.revision}.json`);
      const doc = (await readJson(file)) as MotionProject;
      await writeJsonAtomic(file, { ...doc, id: copyId });
    }
    const now = new Date().toISOString();
    const next: TemplateMeta = { ...meta, id: copyId, name: `${meta.name} (cópia)`.slice(0, 80), createdAt: now, updatedAt: now };
    await writeJsonAtomic(path.join(this.dir(copyId), META), next);
    return this.summary(next);
  }

  /** Deletes the template only. Projects created from it own copies of everything. */
  async remove(id: string): Promise<void> {
    await this.readMeta(id);
    await fs.rm(this.dir(id), { recursive: true, force: true });
  }

  private async instantiate(id: string, opts: { name?: string; format?: Format; draft: boolean }): Promise<MotionProject> {
    const { template, document } = await this.get(id);
    const origin: ProjectOrigin = opts.draft
      ? { kind: 'template-draft', templateId: id, revision: template.revision, name: template.name }
      : { kind: 'user-template', templateId: id, revision: template.revision, name: template.name };
    const doc: MotionProject = {
      ...document,
      name: opts.name ?? (opts.draft ? `${template.name} — edição` : template.name),
      format: opts.format ?? document.format,
      origin,
    };
    return this.opts.projects.createFromDocument(doc, path.join(this.dir(id), ASSETS));
  }

  /** New, independent project from the current revision. */
  createProject(id: string, opts: { name?: string; format?: Format } = {}): Promise<MotionProject> {
    return this.instantiate(id, { ...opts, draft: false });
  }

  /** Working copy to edit the template; `publish` turns it into the next revision. */
  async startDraft(id: string): Promise<MotionProject> {
    return this.instantiate(id, { draft: true });
  }

  /** Publishes a draft (or any composition) as the template's next revision. */
  async publish(id: string, projectId: string): Promise<UserTemplateSummary> {
    const meta = await this.readMeta(id);
    const project = await this.opts.projects.get(projectId);
    if (project.origin.kind === 'template-draft' && project.origin.templateId !== id) {
      throw new HttpError(409, 'Este rascunho pertence a outro template.');
    }
    const revision = Math.max(...meta.revisions.map((r) => r.revision)) + 1;
    const rev = await this.writeRevision(id, revision, project);
    const next: TemplateMeta = { ...meta, revision, revisions: [...meta.revisions, rev], updatedAt: rev.createdAt };
    await writeJsonAtomic(path.join(this.dir(id), META), next);
    // The draft now tracks the revision it produced.
    if (project.origin.kind === 'template-draft') {
      await this.opts.projects.save(project.id, { ...project, origin: { ...project.origin, revision, name: meta.name } });
    }
    return this.summary(next);
  }
}
