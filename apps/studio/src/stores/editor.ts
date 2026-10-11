import { create } from 'zustand';
import {
  getAtPath,
  pathKey,
  setAtPath,
  type FieldPath,
  type Format,
  type MotionProject,
  type ProjectSummary,
  type SaveTemplateRequest,
  type StarterSummary,
  type TemplateSummary,
  type UpdateTemplateRequest,
  type UserTemplateSummary,
} from '@lms/shared';
import { templateModules } from '@lms/catalog';
import {
  SceneOperationError,
  createSceneId,
  duplicateScene as duplicateSceneOp,
  findSceneIndex,
  insertScene,
  moveScene as moveSceneOp,
  nextSceneName,
  removeScene as removeSceneOp,
  renameScene as renameSceneOp,
  sceneTypeOf,
  setSceneEnabled as setSceneEnabledOp,
} from '@lms/template-sdk';
import { api, ApiError } from '../api/client';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

interface EditorState {
  ready: boolean;
  templates: TemplateSummary[];
  userTemplates: UserTemplateSummary[];
  starters: StarterSummary[];
  projects: ProjectSummary[];
  project: MotionProject | null;
  /** JSON of the last persisted version, for dirty detection. */
  savedJson: string;
  saveState: SaveState;
  selectedTargetId: string;
  fieldErrors: Record<string, string>;
  past: MotionProject[];
  future: MotionProject[];
  lastCoalesce: { key: string; at: number } | null;
  toasts: Toast[];

  init(): Promise<void>;
  refreshProjects(): Promise<void>;
  openProject(id: string): Promise<void>;
  createProject(templateId: string, name?: string, format?: Format): Promise<void>;
  /** New free composition prefilled with a ready-made composition. */
  createFromStarter(starterId: string, name?: string, format?: Format): Promise<void>;
  /* User templates */
  refreshUserTemplates(): Promise<void>;
  createFromUserTemplate(templateId: string, name?: string, format?: Format): Promise<void>;
  saveAsTemplate(req: Omit<SaveTemplateRequest, 'projectId'>): Promise<UserTemplateSummary | null>;
  editUserTemplate(templateId: string): Promise<void>;
  publishDraft(): Promise<void>;
  updateUserTemplate(templateId: string, patch: UpdateTemplateRequest): Promise<void>;
  duplicateUserTemplate(templateId: string): Promise<void>;
  deleteUserTemplate(templateId: string): Promise<void>;
  update(path: FieldPath, value: unknown, opts?: { coalesce?: boolean }): boolean;
  replaceProject(next: MotionProject, opts?: { history?: boolean }): void;
  undo(): void;
  redo(): void;
  save(opts?: { force?: boolean }): Promise<void>;
  /** Discards local edits and reloads the version on disk (after a conflict). */
  reloadFromDisk(): Promise<void>;
  select(targetId: string): void;
  /* Scene composition. Each returns the affected scene id, or null if refused. */
  /** `keepPalette`: apply the scene type's original palette as a per-scene override. */
  addScene(type: string, atIndex?: number, opts?: { keepPalette?: boolean }): string | null;
  duplicateScene(sceneId: string): string | null;
  removeScene(sceneId: string): string | null;
  moveScene(sceneId: string, toIndex: number): string | null;
  renameScene(sceneId: string, name: string): string | null;
  setSceneEnabled(sceneId: string, enabled: boolean): string | null;
  resetTarget(targetId: string): void;
  resetProject(): void;
  duplicateProject(): Promise<void>;
  deleteProject(id: string): Promise<void>;
  importProject(file: File): Promise<void>;
  uploadAsset(file: File): Promise<string | null>;
  toast(kind: Toast['kind'], message: string): void;
  dismissToast(id: number): void;
}

const LAST_PROJECT_KEY = 'lms:lastProject';
const remember = (id: string) => {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, id);
  } catch {
    /* storage unavailable: only a convenience */
  }
};
const recall = (): string | null => {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
};

let toastSeq = 0;
let initPromise: Promise<void> | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTOSAVE_MS = 1200;
const HISTORY_LIMIT = 120;

const errMessage = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : String(err));

/** Validates a candidate document with its template schema. */
export const validateProject = (project: MotionProject) => {
  const template = templateModules.find(project.templateId);
  if (!template) return { ok: false as const, message: `Template desconhecido: ${project.templateId}` };
  const parsed = template.schema.safeParse(project);
  if (parsed.success) return { ok: true as const, project: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false as const, message: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Valor inválido' };
};

/** Free compositions may become empty; template projects keep at least one active scene. */
const listPolicy = (project: MotionProject) => ({ allowEmpty: Boolean(templateModules.get(project.templateId).allowEmpty) });

/** Target ids of a project: scene instance ids and `<sceneId>.<element>` ids. */
const selectionExists = (project: MotionProject, targetId: string): boolean => {
  if (targetId === 'project' || targetId.startsWith('global.')) return true;
  const sceneId = targetId.split('.')[0]!;
  return project.scenes.some((s) => s.id === sceneId);
};

export const useEditor = create<EditorState>((set, get) => {
  const scheduleAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => void get().save(), AUTOSAVE_MS);
  };

  /** After undo/redo/removal the selected scene may be gone: fall back to a neighbour. */
  const keepSelectionValid = (fallbackIndex = 0) => {
    const { project, selectedTargetId } = get();
    if (!project || selectionExists(project, selectedTargetId)) return;
    const scene = project.scenes[Math.min(fallbackIndex, project.scenes.length - 1)] ?? project.scenes[0];
    set({ selectedTargetId: scene?.id ?? 'project' });
  };

  /**
   * Applies a structural edit: validates the whole document with the template schema,
   * records one undo step and optionally selects a target. Refusals surface as toasts.
   * Returns the affected scene id, or null when the edit was refused.
   */
  const structural = (op: (project: MotionProject) => { next: MotionProject; affected: string; select?: string }): string | null => {
    const { project } = get();
    if (!project) return null;
    let result: ReturnType<typeof op>;
    try {
      result = op(project);
    } catch (err) {
      get().toast('error', err instanceof SceneOperationError ? err.message : errMessage(err));
      return null;
    }
    if (result.next !== project) {
      const valid = validateProject(result.next);
      if (!valid.ok) {
        get().toast('error', valid.message);
        return null;
      }
      get().replaceProject(valid.project);
    }
    if (result.select) set({ selectedTargetId: result.select });
    return result.affected;
  };

  const load = (project: MotionProject) => {
    remember(project.id);
    set({
      project,
      savedJson: JSON.stringify(project),
      saveState: 'saved',
      past: [],
      future: [],
      fieldErrors: {},
      selectedTargetId: project.scenes[0]?.id ?? 'project',
      lastCoalesce: null,
    });
  };

  return {
    ready: false,
    templates: [],
    userTemplates: [],
    starters: [],
    projects: [],
    project: null,
    savedJson: '',
    saveState: 'idle',
    selectedTargetId: 'project',
    fieldErrors: {},
    past: [],
    future: [],
    lastCoalesce: null,
    toasts: [],

    async init() {
      // StrictMode runs mount effects twice in development; initialize once.
      if (initPromise) return initPromise;
      initPromise = (async () => {
        try {
        const [templates, projects, userTemplates, starters] = await Promise.all([api.templates(), api.projects(), api.userTemplates().catch(() => []), api.starters().catch(() => [])]);
        set({ templates, projects, userTemplates, starters });
        const last = recall();
        const target = projects.find((p) => p.id === last) ?? projects[0];
        if (target) await get().openProject(target.id);
        else if (templates[0]) await get().createProject(templates[0].id, 'Meu primeiro projeto', 'landscape');
        } catch (err) {
          initPromise = null;
          get().toast('error', errMessage(err));
        } finally {
          set({ ready: true });
        }
      })();
      return initPromise;
    },

    async refreshProjects() {
      set({ projects: await api.projects() });
    },

    async openProject(id) {
      if (get().saveState === 'dirty' && get().project?.id !== id) await get().save();
      try {
        load(await api.project(id));
      } catch (err) {
        get().toast('error', `Não foi possível abrir o projeto: ${errMessage(err)}`);
      }
    },

    async createProject(templateId, name, format) {
      if (get().saveState === 'dirty') await get().save();
      try {
        const project = await api.createProject(templateId, name, format);
        load(project);
        await get().refreshProjects();
        get().toast('success', `Projeto “${project.name}” criado`);
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async createFromStarter(starterId, name, format) {
      if (get().saveState === 'dirty') await get().save();
      const free = get().templates.find((t) => t.mode === 'free');
      if (!free) return;
      try {
        const project = await api.createProject(free.id, name, format, starterId);
        load(project);
        await get().refreshProjects();
        get().toast('success', `“${project.name}” criado — todas as cenas são editáveis`);
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async refreshUserTemplates() {
      set({ userTemplates: await api.userTemplates() });
    },

    async createFromUserTemplate(templateId, name, format) {
      if (get().saveState === 'dirty') await get().save();
      try {
        const project = await api.projectFromTemplate(templateId, { ...(name ? { name } : {}), ...(format ? { format } : {}) });
        load(project);
        await get().refreshProjects();
        get().toast('success', `Projeto “${project.name}” criado a partir do template`);
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async saveAsTemplate(req) {
      const { project } = get();
      if (!project) return null;
      await get().save();
      try {
        const saved = await api.saveAsTemplate({ ...req, projectId: project.id });
        await get().refreshUserTemplates();
        get().toast('success', `Template “${saved.name}” salvo na biblioteca`);
        return saved;
      } catch (err) {
        get().toast('error', `Não foi possível salvar o template: ${errMessage(err)}`);
        return null;
      }
    },

    async editUserTemplate(templateId) {
      if (get().saveState === 'dirty') await get().save();
      try {
        const draft = await api.templateDraft(templateId);
        load(draft);
        await get().refreshProjects();
        get().toast('info', 'Editando uma cópia de trabalho. Publique para criar a nova versão do template.');
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async publishDraft() {
      const { project } = get();
      if (!project || project.origin.kind !== 'template-draft') return;
      await get().save();
      try {
        const t = await api.publishRevision(project.origin.templateId, project.id);
        load(await api.project(project.id));
        await Promise.all([get().refreshUserTemplates(), get().refreshProjects()]);
        get().toast('success', `“${t.name}” publicado como revisão ${t.revision}`);
      } catch (err) {
        get().toast('error', `Falha ao publicar: ${errMessage(err)}`);
      }
    },

    async updateUserTemplate(templateId, patch) {
      try {
        await api.updateTemplate(templateId, patch);
        await get().refreshUserTemplates();
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async duplicateUserTemplate(templateId) {
      try {
        const copy = await api.duplicateTemplate(templateId);
        await get().refreshUserTemplates();
        get().toast('success', `Duplicado como “${copy.name}”`);
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async deleteUserTemplate(templateId) {
      try {
        await api.deleteTemplate(templateId);
        await get().refreshUserTemplates();
        get().toast('info', 'Template excluído. Projetos criados a partir dele não foram alterados.');
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    update(path, value, opts = {}) {
      const { project } = get();
      if (!project) return false;
      if (Object.is(getAtPath(project, path), value)) return true;
      let next: MotionProject;
      try {
        next = setAtPath(project, path, value);
      } catch (err) {
        set({ fieldErrors: { ...get().fieldErrors, [pathKey(path)]: errMessage(err) } });
        return false;
      }
      const result = validateProject(next);
      const key = pathKey(path);
      if (!result.ok) {
        set({ fieldErrors: { ...get().fieldErrors, [key]: result.message } });
        return false;
      }
      const now = Date.now();
      const last = get().lastCoalesce;
      const coalesce = opts.coalesce && last?.key === key && now - last.at < 800;
      const { [key]: _removed, ...fieldErrors } = get().fieldErrors;
      set({
        project: next,
        past: coalesce ? get().past : [...get().past, project].slice(-HISTORY_LIMIT),
        future: [],
        fieldErrors,
        saveState: 'dirty',
        lastCoalesce: { key, at: now },
      });
      scheduleAutosave();
      return true;
    },

    replaceProject(next, opts = { history: true }) {
      const { project } = get();
      if (!project) return;
      set({
        project: next,
        past: opts.history ? [...get().past, project].slice(-HISTORY_LIMIT) : get().past,
        future: opts.history ? [] : get().future,
        saveState: 'dirty',
        lastCoalesce: null,
      });
      scheduleAutosave();
    },

    undo() {
      const { past, project, future } = get();
      const prev = past[past.length - 1];
      if (!prev || !project) return;
      set({ project: prev, past: past.slice(0, -1), future: [project, ...future], saveState: 'dirty', lastCoalesce: null });
      keepSelectionValid();
      scheduleAutosave();
    },

    redo() {
      const { past, project, future } = get();
      const next = future[0];
      if (!next || !project) return;
      set({ project: next, past: [...past, project], future: future.slice(1), saveState: 'dirty', lastCoalesce: null });
      keepSelectionValid();
      scheduleAutosave();
    },

    async save(opts = {}) {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      const { project: current, savedJson, saveState } = get();
      if (!current) return;
      // After a conflict only an explicit choice (overwrite / reload) may write.
      if (saveState === 'conflict' && !opts.force) return;
      // `updatedAt` is the server's version token. Undo/redo snapshots and edits made while
      // a save was in flight still carry an older one: always base the write on the version
      // of the last successful save (savedJson), not on the stamp inside the snapshot.
      const version = savedJson ? (JSON.parse(savedJson) as MotionProject).updatedAt : current.updatedAt;
      const project = current.updatedAt === version ? current : { ...current, updatedAt: version };
      if (project !== current) set({ project });
      const json = JSON.stringify(project);
      if (json === savedJson && !opts.force) {
        set({ saveState: 'saved' });
        return;
      }
      set({ saveState: 'saving' });
      try {
        const saved = await api.saveProject(project, opts.force);
        const current = get().project;
        if (current && JSON.stringify(current) === json) {
          const updated = { ...current, updatedAt: saved.updatedAt };
          set({ project: updated, savedJson: JSON.stringify(updated), saveState: 'saved' });
        } else {
          // Edits arrived while the request was in flight: keep them and save again.
          set({ savedJson: JSON.stringify({ ...project, updatedAt: saved.updatedAt }), saveState: 'dirty' });
          scheduleAutosave();
        }
        void get().refreshProjects();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          set({ saveState: 'conflict' });
          get().toast('error', 'Este projeto foi salvo em outra janela. Escolha na barra superior: recarregar a versão do disco ou sobrescrever com a sua.');
          return;
        }
        set({ saveState: 'error' });
        get().toast('error', `Falha ao salvar: ${errMessage(err)}`);
      }
    },

    async reloadFromDisk() {
      const { project } = get();
      if (!project) return;
      set({ saveState: 'idle' });
      await get().openProject(project.id);
    },

    select(targetId) {
      set({ selectedTargetId: targetId });
    },

    addScene(type, atIndex, opts = {}) {
      return structural((project) => {
        const template = templateModules.get(project.templateId);
        const def = sceneTypeOf(template, type);
        let scene = template.createScene(type, { id: createSceneId(project, type), name: nextSceneName(project, def.name) });
        const original = (def as { palette?: Partial<MotionProject['theme']> }).palette;
        if (opts.keepPalette && original) scene = { ...scene, palette: { ...scene.palette, ...original } };
        return { next: insertScene(project, scene, atIndex), affected: scene.id, select: scene.id };
      });
    },

    duplicateScene(sceneId) {
      return structural((project) => {
        const { project: next, scene } = duplicateSceneOp(project, sceneId);
        return { next, affected: scene.id, select: scene.id };
      });
    },

    removeScene(sceneId) {
      const index = get().project ? findSceneIndex(get().project!.scenes, sceneId) : -1;
      const result = structural((project) => ({ next: removeSceneOp(project, sceneId, listPolicy(project)), affected: sceneId }));
      if (result) keepSelectionValid(Math.max(0, index));
      return result;
    },

    moveScene(sceneId, toIndex) {
      // Moving keeps the current selection when it belongs to the moved scene.
      const selected = get().selectedTargetId;
      return structural((project) => ({
        next: moveSceneOp(project, sceneId, toIndex),
        affected: sceneId,
        select: selected.split('.')[0] === sceneId ? selected : sceneId,
      }));
    },

    renameScene(sceneId, name) {
      return structural((project) => {
        const current = project.scenes.find((s) => s.id === sceneId);
        const unchanged = current?.name === name.replace(/\s+/g, ' ').trim();
        return { next: unchanged ? project : renameSceneOp(project, sceneId, name), affected: sceneId };
      });
    },

    setSceneEnabled(sceneId, enabled) {
      return structural((project) => ({ next: setSceneEnabledOp(project, sceneId, enabled, listPolicy(project)), affected: sceneId }));
    },

    resetTarget(targetId) {
      const { project } = get();
      if (!project) return;
      const template = templateModules.get(project.templateId);
      const target = template.getEditableTargets(project).find((t) => t.id === targetId);
      if (!target) return;
      // Defaults come from the instance's *type*, placed at the instance's own index, so
      // resetting "Impact #3" restores Impact defaults without touching other scenes.
      let defaults: MotionProject = template.createDefaults({ id: project.id, name: project.name, format: project.format, fps: project.fps, now: project.createdAt });
      const sceneIndex = target.sceneId ? findSceneIndex(project.scenes, target.sceneId) : -1;
      if (sceneIndex >= 0) {
        const scene = project.scenes[sceneIndex]!;
        const fresh = template.createScene(scene.type, { id: scene.id, name: scene.name });
        const scenes = [...project.scenes];
        scenes[sceneIndex] = fresh;
        defaults = { ...defaults, scenes };
      }
      let next = project;
      for (const section of target.sections) {
        for (const field of section.fields) {
          if (field.path[0] === 'name' || field.path[0] === 'fps' || field.path.at(-1) === 'name') continue;
          next = setAtPath(next, field.path, structuredClone(getAtPath(defaults, field.path)));
        }
      }
      const result = validateProject(next);
      if (!result.ok) {
        get().toast('error', result.message);
        return;
      }
      get().replaceProject(next);
      get().toast('info', `“${target.label}” restaurado aos valores originais`);
    },

    resetProject() {
      const { project } = get();
      if (!project) return;
      const template = templateModules.get(project.templateId);
      const defaults = template.createDefaults({ id: project.id, name: project.name, format: project.format, fps: project.fps, now: project.createdAt });
      get().replaceProject({ ...defaults, assets: project.assets, updatedAt: project.updatedAt });
      get().toast('info', 'Projeto restaurado aos valores originais do template');
    },

    async duplicateProject() {
      const { project } = get();
      if (!project) return;
      await get().save();
      try {
        const copy = await api.duplicateProject(project.id);
        load(copy);
        await get().refreshProjects();
        get().toast('success', `Duplicado como “${copy.name}”`);
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async deleteProject(id) {
      try {
        await api.deleteProject(id);
        await get().refreshProjects();
        if (get().project?.id === id) {
          const next = get().projects[0];
          if (next) await get().openProject(next.id);
          else set({ project: null });
        }
        get().toast('info', 'Projeto excluído');
      } catch (err) {
        get().toast('error', errMessage(err));
      }
    },

    async importProject(file) {
      try {
        const raw = JSON.parse(await file.text()) as unknown;
        const project = await api.importProject(raw);
        load(project);
        await get().refreshProjects();
        get().toast('success', `Projeto “${project.name}” importado`);
      } catch (err) {
        get().toast('error', `Importação falhou: ${errMessage(err)}`);
      }
    },

    async uploadAsset(file) {
      const { project } = get();
      if (!project) return null;
      try {
        const { asset, project: onDisk } = await api.uploadAsset(project.id, file);
        // The server persisted the new asset list (and bumped updatedAt): adopt both so
        // the next save is based on the current disk version.
        const current = get().project!;
        set({ project: { ...current, assets: [...current.assets, asset], updatedAt: onDisk.updatedAt } });
        const saved = JSON.parse(get().savedJson || '{}') as MotionProject;
        set({ savedJson: JSON.stringify({ ...saved, assets: [...(saved.assets ?? []), asset], updatedAt: onDisk.updatedAt }) });
        return asset.id;
      } catch (err) {
        get().toast('error', `Upload falhou: ${errMessage(err)}`);
        return null;
      }
    },

    toast(kind, message) {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts, { id, kind, message }] });
      setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500);
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
  };
});
