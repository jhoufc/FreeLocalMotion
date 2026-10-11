import fs from 'node:fs/promises';
import path from 'node:path';
import {
  collectAssetIds,
  createId,
  FORMATS,
  type AssetRef,
  type Format,
  type MotionProject,
  type ProjectOrigin,
  type ProjectSummary,
} from '@lms/shared';
import { formatIssues, parseProjectForTemplate, type AnyTemplateDefinition, type TemplateRegistry, type ValidationIssue } from '@lms/template-sdk';
import { buildStarter, findStarter } from '@lms/catalog/definitions';
import { exists, readJson, safeJoin, sniffMedia, writeJsonAtomic } from '../storage/files';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const PROJECT_FILE = 'project.json';

/** Strictly increasing ISO timestamps: `updatedAt` doubles as the document's version token. */
const nextStamp = (previous: string): string => {
  const now = Date.now();
  const prev = Date.parse(previous);
  return new Date(Number.isFinite(prev) && now <= prev ? prev + 1 : now).toISOString();
};
const ASSETS_DIR = 'assets';

/**
 * File-based project storage:
 *
 *   projects/<projectId>/project.json   – validated, versioned document
 *   projects/<projectId>/assets/<file>  – uploads copied under stable names
 *
 * Every write goes through the template schema, so nothing invalid reaches disk.
 */
export class ProjectStore {
  constructor(
    private readonly root: string,
    private readonly templates: TemplateRegistry<AnyTemplateDefinition>,
  ) {}

  private dir(id: string) {
    if (!/^[a-z0-9-]{6,64}$/.test(id)) throw new HttpError(400, 'Invalid project id');
    return safeJoin(this.root, id);
  }

  assetPath(projectId: string, fileName: string): string {
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) throw new HttpError(400, 'Invalid asset file name');
    return safeJoin(this.dir(projectId), ASSETS_DIR, fileName);
  }

  /** Full validation for any template (migrations, schema, asset references). */
  validate(raw: unknown): { project: MotionProject; migrated: boolean } {
    const templateId = (raw as { templateId?: unknown } | null)?.templateId;
    if (typeof templateId !== 'string') throw new HttpError(422, 'Project has no templateId');
    const template = this.templates.find(templateId);
    if (!template) throw new HttpError(422, `Unknown template "${templateId}"`);
    const result = parseProjectForTemplate(template, raw);
    if (!result.ok) throw new HttpError(422, `Invalid project:\n${formatIssues(result.issues)}`, result.issues satisfies ValidationIssue[]);
    return { project: result.project, migrated: result.migrated };
  }

  async list(): Promise<ProjectSummary[]> {
    await fs.mkdir(this.root, { recursive: true });
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const out: ProjectSummary[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const file = path.join(this.root, e.name, PROJECT_FILE);
      if (!(await exists(file))) continue;
      try {
        const p = (await readJson(file)) as MotionProject;
        out.push({
          id: p.id,
          name: p.name,
          templateId: p.templateId,
          format: p.format,
          origin: (p as Partial<MotionProject>).origin ?? null,
          sceneCount: Array.isArray(p.scenes) ? p.scenes.length : 0,
          updatedAt: p.updatedAt,
          createdAt: p.createdAt,
        });
      } catch {
        // Unreadable project folders are skipped from the listing, never deleted.
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<MotionProject> {
    const file = path.join(this.dir(id), PROJECT_FILE);
    if (!(await exists(file))) throw new HttpError(404, `Project "${id}" not found`);
    const raw = await readJson(file);
    const { project, migrated } = this.validate(raw);
    if (migrated) {
      // Keep the pre-migration document next to the upgraded one: migrations must never
      // be the reason a project is lost.
      const from = (raw as { schemaVersion?: unknown; templateVersion?: unknown }) ?? {};
      const backup = path.join(this.dir(id), `project.backup-v${String(from.schemaVersion ?? 0)}-${String(from.templateVersion ?? 'unknown').replace(/[^a-zA-Z0-9.-]/g, '_')}.json`);
      if (!(await exists(backup))) await writeJsonAtomic(backup, raw);
      await writeJsonAtomic(file, project);
    }
    return project;
  }

  async create(templateId: string, opts: { name?: string; format?: Format; starterId?: string } = {}): Promise<MotionProject> {
    const template = this.templates.find(templateId);
    if (!template) throw new HttpError(404, `Unknown template "${templateId}"`);
    const format = opts.format && template.formats.includes(opts.format) ? opts.format : (template.formats[0] ?? FORMATS[0]);
    const now = new Date().toISOString();
    if (opts.starterId) {
      if (template.mode !== 'free') throw new HttpError(400, 'Starter compositions belong to the free-composition template');
      if (!findStarter(opts.starterId)) throw new HttpError(404, `Unknown starter composition "${opts.starterId}"`);
      const doc = buildStarter(opts.starterId, { id: createId('p-'), ...(opts.name ? { name: opts.name } : {}), format, now }) as MotionProject;
      await writeJsonAtomic(path.join(this.dir(doc.id), PROJECT_FILE), this.validate(doc).project);
      return doc;
    }
    const fallbackName = template.mode === 'free' ? 'Nova composição' : `${template.name} — ${now.slice(0, 10)}`;
    const project = template.createDefaults({ id: createId('p-'), name: opts.name ?? fallbackName, format, now });
    await writeJsonAtomic(path.join(this.dir(project.id), PROJECT_FILE), this.validate(project).project);
    return project;
  }

  /** Folder holding a project's asset files. */
  assetsDir(projectId: string): string {
    return path.join(this.dir(projectId), ASSETS_DIR);
  }

  /**
   * Creates a project from a complete document (e.g. a user template revision): fresh id
   * and timestamps, and its asset files copied from `assetSourceDir` so the new project
   * never depends on the source.
   */
  async createFromDocument(doc: MotionProject, assetSourceDir: string | null): Promise<MotionProject> {
    const now = new Date().toISOString();
    const project: MotionProject = { ...structuredClone(doc), id: createId('p-'), createdAt: now, updatedAt: now };
    const { project: valid } = this.validate(project);
    if (assetSourceDir) {
      for (const asset of valid.assets) {
        const src = safeJoin(assetSourceDir, asset.fileName);
        if (!(await exists(src))) throw new HttpError(422, `Asset file missing: ${asset.originalName}`);
        const dest = this.assetPath(valid.id, asset.fileName);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
      }
    }
    await writeJsonAtomic(path.join(this.dir(valid.id), PROJECT_FILE), valid);
    return valid;
  }

  /**
   * Saves a full document. Optimistic concurrency: the document's `updatedAt` must match
   * the version on disk, otherwise another window saved in between and we refuse to
   * silently overwrite it (409). `force` skips the check.
   */
  async save(id: string, raw: unknown, opts: { force?: boolean } = {}): Promise<MotionProject> {
    const existing = await this.get(id);
    const { project } = this.validate(raw);
    if (project.id !== id) throw new HttpError(400, 'Project id mismatch');
    if (project.templateId !== existing.templateId) throw new HttpError(400, 'Template of a project cannot change');
    if (!opts.force && project.updatedAt !== existing.updatedAt) {
      throw new HttpError(409, 'O projeto foi alterado em outra janela desde que foi aberto.', { updatedAt: existing.updatedAt });
    }
    const saved: MotionProject = { ...project, createdAt: existing.createdAt, updatedAt: nextStamp(existing.updatedAt) };
    await writeJsonAtomic(path.join(this.dir(id), PROJECT_FILE), saved);
    return saved;
  }

  async duplicate(id: string, name?: string): Promise<MotionProject> {
    const source = await this.get(id);
    const now = new Date().toISOString();
    const copy: MotionProject = { ...source, origin: detachDraft(source.origin), id: createId('p-'), name: name ?? `${source.name} (cópia)`, createdAt: now, updatedAt: now };
    const srcAssets = path.join(this.dir(id), ASSETS_DIR);
    if (await exists(srcAssets)) await fs.cp(srcAssets, path.join(this.dir(copy.id), ASSETS_DIR), { recursive: true });
    await writeJsonAtomic(path.join(this.dir(copy.id), PROJECT_FILE), this.validate(copy).project);
    return copy;
  }

  /**
   * Imports a project JSON. It always gets a fresh id; asset entries whose files are not
   * present are dropped together with references to them (JSON export does not embed binaries).
   */
  async import(raw: unknown): Promise<MotionProject> {
    if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Expected a JSON object');
    const now = new Date().toISOString();
    const doc: Record<string, unknown> = { ...(raw as Record<string, unknown>), id: createId('p-'), createdAt: now, updatedAt: now };
    const assetIds = new Set(((doc.assets as AssetRef[] | undefined) ?? []).map((a) => a.id));
    const stripped = stripAssetRefs({ ...doc, assets: [] }, assetIds) as Record<string, unknown>;
    const { project: parsed } = this.validate(stripped);
    const project = { ...parsed, origin: detachDraft(parsed.origin) };
    await writeJsonAtomic(path.join(this.dir(project.id), PROJECT_FILE), project);
    return project;
  }

  async remove(id: string): Promise<void> {
    const dir = this.dir(id);
    if (!(await exists(dir))) throw new HttpError(404, `Project "${id}" not found`);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async addAsset(projectId: string, data: Buffer, originalName: string): Promise<{ project: MotionProject; asset: AssetRef }> {
    const project = await this.get(projectId);
    const sniffed = sniffMedia(data);
    if (!sniffed) throw new HttpError(415, 'Unsupported file. Use PNG, JPG, WEBP, GIF (images) or MP3, WAV, M4A, OGG (audio).');
    const asset: AssetRef = {
      id: createId('a-'),
      kind: sniffed.kind,
      fileName: '',
      originalName: originalName.slice(0, 255),
      mimeType: sniffed.mime,
      size: data.byteLength,
      createdAt: new Date().toISOString(),
    };
    asset.fileName = `${asset.id}.${sniffed.ext}`;
    const file = this.assetPath(projectId, asset.fileName);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    const next = { ...project, assets: [...project.assets, asset], updatedAt: nextStamp(project.updatedAt) };
    await writeJsonAtomic(path.join(this.dir(projectId), PROJECT_FILE), this.validate(next).project);
    return { project: next, asset };
  }

  async removeAsset(projectId: string, assetId: string): Promise<MotionProject> {
    const project = await this.get(projectId);
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) throw new HttpError(404, 'Asset not found');
    const used = collectAssetIds({ ...project, assets: [] });
    if (used.has(assetId)) throw new HttpError(409, 'Asset is still used by the project');
    const next = { ...project, assets: project.assets.filter((a) => a.id !== assetId), updatedAt: nextStamp(project.updatedAt) };
    await writeJsonAtomic(path.join(this.dir(projectId), PROJECT_FILE), this.validate(next).project);
    await fs.rm(this.assetPath(projectId, asset.fileName), { force: true });
    return next;
  }

  /** Verifies every referenced asset exists on disk. Used before rendering. */
  async verifyAssetFiles(project: MotionProject): Promise<string[]> {
    const missing: string[] = [];
    const used = collectAssetIds({ ...project, assets: [] });
    for (const asset of project.assets) {
      if (!used.has(asset.id)) continue;
      if (!(await exists(this.assetPath(project.id, asset.fileName)))) missing.push(asset.originalName);
    }
    return missing;
  }
}

/** A copy of a template draft is an ordinary project derived from that template revision. */
const detachDraft = (origin: ProjectOrigin): ProjectOrigin =>
  origin.kind === 'template-draft' ? { kind: 'user-template', templateId: origin.templateId, revision: origin.revision, name: origin.name } : origin;

const stripAssetRefs = (value: unknown, ids: Set<string>): unknown => {
  if (Array.isArray(value)) return value.map((v) => stripAssetRefs(v, ids));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'assetId' && typeof v === 'string') out[k] = null;
      else out[k] = stripAssetRefs(v, ids);
    }
    // An image background without an image falls back to the template's procedural look.
    if (out.mode === 'image' && out.image && (out.image as { assetId: unknown }).assetId === null) out.mode = 'procedural';
    return out;
  }
  return value;
};
