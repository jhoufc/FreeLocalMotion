import { create } from 'zustand';
import { getAtPath, pathKey, setAtPath, type FieldPath, type Format, type MotionProject, type ProjectSummary, type TemplateSummary } from '@lms/shared';
import { templateModules } from '@lms/catalog';
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
  update(path: FieldPath, value: unknown, opts?: { coalesce?: boolean }): boolean;
  replaceProject(next: MotionProject, opts?: { history?: boolean }): void;
  undo(): void;
  redo(): void;
  save(opts?: { force?: boolean }): Promise<void>;
  /** Discards local edits and reloads the version on disk (after a conflict). */
  reloadFromDisk(): Promise<void>;
  select(targetId: string): void;
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

export const useEditor = create<EditorState>((set, get) => {
  const scheduleAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => void get().save(), AUTOSAVE_MS);
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
        const [templates, projects] = await Promise.all([api.templates(), api.projects()]);
        set({ templates, projects });
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
      scheduleAutosave();
    },

    redo() {
      const { past, project, future } = get();
      const next = future[0];
      if (!next || !project) return;
      set({ project: next, past: [...past, project], future: future.slice(1), saveState: 'dirty', lastCoalesce: null });
      scheduleAutosave();
    },

    async save(opts = {}) {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      const { project, savedJson, saveState } = get();
      if (!project) return;
      // After a conflict only an explicit choice (overwrite / reload) may write.
      if (saveState === 'conflict' && !opts.force) return;
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

    resetTarget(targetId) {
      const { project } = get();
      if (!project) return;
      const template = templateModules.get(project.templateId);
      const defaults = template.createDefaults({ id: project.id, name: project.name, format: project.format, fps: project.fps, now: project.createdAt });
      const target = template.getEditableTargets(project).find((t) => t.id === targetId);
      if (!target) return;
      let next = project;
      for (const section of target.sections) {
        for (const field of section.fields) {
          if (field.path[0] === 'name' || field.path[0] === 'fps') continue;
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
