import type {
  AssetRef,
  CreateRenderRequest,
  Format,
  MotionProject,
  ProjectSummary,
  RenderJob,
  SaveTemplateRequest,
  StarterSummary,
  TemplateSummary,
  UpdateTemplateRequest,
  UserTemplateSummary,
} from '@lms/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const request = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init.body && !(init.body instanceof Blob) ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    });
  } catch {
    throw new ApiError(0, 'Servidor local indisponível. Ele está rodando? (pnpm dev)');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const err = data as { error?: string; details?: unknown } | undefined;
    throw new ApiError(res.status, err?.error ?? `HTTP ${res.status}`, err?.details);
  }
  return data as T;
};

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  templates: () => request<TemplateSummary[]>('/api/templates'),
  projects: () => request<ProjectSummary[]>('/api/projects'),
  project: (id: string) => request<MotionProject>(`/api/projects/${id}`),
  createProject: (templateId: string, name?: string, format?: Format, starterId?: string) => request<MotionProject>('/api/projects', json({ templateId, name, format, starterId })),
  starters: () => request<StarterSummary[]>('/api/starters'),
  saveProject: (project: MotionProject, force = false) =>
    request<MotionProject>(`/api/projects/${project.id}${force ? '?force=1' : ''}`, { method: 'PUT', body: JSON.stringify(project) }),
  duplicateProject: (id: string, name?: string) => request<MotionProject>(`/api/projects/${id}/duplicate`, json({ name })),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  importProject: (raw: unknown) => request<MotionProject>('/api/projects/import', json(raw)),
  exportUrl: (id: string) => `/api/projects/${id}/export`,
  uploadAsset: (projectId: string, file: File) =>
    request<{ project: MotionProject; asset: AssetRef }>(`/api/projects/${projectId}/assets?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      body: file,
      headers: { 'content-type': 'application/octet-stream' },
    }),
  userTemplates: () => request<UserTemplateSummary[]>('/api/user-templates'),
  userTemplate: (id: string, revision?: number) =>
    request<{ template: UserTemplateSummary; document: MotionProject }>(`/api/user-templates/${id}${revision ? `?revision=${revision}` : ''}`),
  saveAsTemplate: (body: SaveTemplateRequest) => request<UserTemplateSummary>('/api/user-templates', json(body)),
  updateTemplate: (id: string, patch: UpdateTemplateRequest) => request<UserTemplateSummary>(`/api/user-templates/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTemplate: (id: string) => request<void>(`/api/user-templates/${id}`, { method: 'DELETE' }),
  duplicateTemplate: (id: string) => request<UserTemplateSummary>(`/api/user-templates/${id}/duplicate`, { method: 'POST' }),
  projectFromTemplate: (id: string, body: { name?: string; format?: Format }) => request<MotionProject>(`/api/user-templates/${id}/projects`, json(body)),
  templateDraft: (id: string) => request<MotionProject>(`/api/user-templates/${id}/drafts`, { method: 'POST' }),
  publishRevision: (id: string, projectId: string) => request<UserTemplateSummary>(`/api/user-templates/${id}/revisions`, json({ projectId })),
  templateThumbUrl: (id: string, file: string) => `/api/user-templates/${id}/thumbnails/${file}`,
  renders: () => request<RenderJob[]>('/api/renders'),
  render: (body: CreateRenderRequest) => request<RenderJob>('/api/renders', json(body)),
  cancelRender: (id: string) => request<RenderJob>(`/api/renders/${id}/cancel`, { method: 'POST' }),
  revealRender: (id: string) => request<{ ok: boolean }>(`/api/renders/${id}/reveal`, { method: 'POST' }),
  renderFileUrl: (id: string, download = true) => `/api/renders/${id}/file${download ? '' : '?download=0'}`,
};
