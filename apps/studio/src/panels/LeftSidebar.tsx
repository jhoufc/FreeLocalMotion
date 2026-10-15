import { useMemo, useRef, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { AudioLines, Copy, Download, Eye, EyeOff, FolderOpen, Layers, LayoutTemplate, Plus, Trash2, Upload, Clapperboard } from 'lucide-react';
import { getAtPath, type MotionProject, type ProjectSummary, type TemplateSummary } from '@lms/shared';
import { TemplateStage, templateModules, type StageProps } from '@lms/catalog';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';
import { sceneAtFrame, type ProjectModel } from '../editor/useProjectModel';
import { api } from '../api/client';
import { KindIcon } from './KindIcon';
import { NewCreationDialog } from '../components/NewCreationDialog';
import { TemplatesTab } from './TemplatesTab';
import { SceneList } from './SceneList';
import { SpeechTab } from './SpeechTab';

type Tab = 'scene' | 'speech' | 'templates' | 'projects';

/* ------------------------------------------------------------------ */
/* Scenes + layers                                                     */
/* ------------------------------------------------------------------ */

const ScenesTab = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const selected = useEditor((s) => s.selectedTargetId);
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.update);
  const current = usePlayback((s) => sceneAtFrame(model.ranges, s.frame)?.id);
  const selectedTarget = model.targetsById.get(selected);
  const activeSceneId = selectedTarget?.sceneId ?? current ?? project.scenes[0]?.id ?? null;
  const activeScene = project.scenes.find((s) => s.id === activeSceneId);
  const layers = model.targets.filter((t) => t.sceneId === activeSceneId && t.kind !== 'scene');
  const globals = model.targets.filter((t) => t.sceneId === null);

  const LayerRow = ({ id }: { id: string }) => {
    const t = model.targetsById.get(id)!;
    const visible = t.visibilityPath ? Boolean(getAtPath(project, t.visibilityPath)) : true;
    return (
      <div className={`layer ${selected === id ? 'on' : ''} ${visible ? '' : 'hidden-el'}`} onClick={() => select(id)}>
        <span className={`kind kind-${t.kind}`}>
          <KindIcon kind={t.kind} />
        </span>
        <span className="name">{t.label}</span>
        {t.visibilityPath && (
          <button
            className="icon-btn sm"
            title={visible ? 'Ocultar' : 'Mostrar'}
            onClick={(e) => {
              e.stopPropagation();
              update(t.visibilityPath!, !visible);
            }}
          >
            {visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="scroll">
      <div className="section-title">
        <span>Cenas</span>
        <span className="mono" style={{ letterSpacing: 0 }}>
          {model.ranges.length}/{project.scenes.length} · {(model.durationInFrames / model.fps).toFixed(1)}s
        </span>
      </div>
      <SceneList project={project} model={model} activeSceneId={activeSceneId} />

      {activeSceneId && (
        <>
          <div className="section-title">
            <span>Elementos da cena</span>
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{activeScene?.name}</span>
          </div>
          <div className={`layer ${selected === activeSceneId ? 'on' : ''}`} onClick={() => select(activeSceneId)}>
            <span className="kind kind-scene">
              <Clapperboard size={13} />
            </span>
            <span className="name">Cena, background e layout</span>
          </div>
          {layers.map((t) => (
            <LayerRow key={t.id} id={t.id} />
          ))}
        </>
      )}

      <div className="section-title">
        <span>Global</span>
      </div>
      {globals.map((t) => (
        <LayerRow key={t.id} id={t.id} />
      ))}
      <div style={{ height: 16 }} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Template library                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

const originLabel = (origin: ProjectSummary['origin'], templates: TemplateSummary[]): string | null => {
  if (!origin) return null;
  switch (origin.kind) {
    case 'blank':
      return 'Livre';
    case 'template':
      if (origin.templateId === 'speech') return 'Da fala';
      if (origin.templateId.startsWith('starter:')) return 'Pronta';
      return templates.find((t) => t.id === origin.templateId)?.name ?? origin.templateId;
    case 'user-template':
      return `de ${origin.name}`;
    case 'template-draft':
      return `Rascunho · ${origin.name}`;
  }
};

const ProjectsTab = () => {
  const projects = useEditor((s) => s.projects);
  const current = useEditor((s) => s.project?.id);
  const { openProject, deleteProject, importProject } = useEditor.getState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const templates = useEditor((s) => s.templates);
  return (
    <div className="scroll">
      <div className="section-title">
        <span>Projetos locais</span>
        <span>{projects.length}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 10px 10px' }}>
        <button className="btn sm" onClick={() => setCreating(true)} disabled={!templates[0]}>
          <Plus size={13} /> Nova criação
        </button>
        <button className="btn sm" onClick={() => fileRef.current?.click()}>
          <Upload size={13} /> Importar JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importProject(f);
            e.target.value = '';
          }}
        />
      </div>
      {projects.map((p) => (
        <div key={p.id} className={`project-row ${p.id === current ? 'on' : ''}`} onClick={() => p.id !== current && void openProject(p.id)}>
          <FolderOpen size={15} style={{ color: 'var(--text-2)', flex: 'none' }} />
          <div className="grow">
            <b>
              {p.name}
              {originLabel(p.origin, templates) && <span className="origin-badge">{originLabel(p.origin, templates)}</span>}
            </b>
            <span>
              {p.format === 'portrait' ? '9:16' : '16:9'} · {new Date(p.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
          <a className="icon-btn sm" href={api.exportUrl(p.id)} title="Exportar JSON" onClick={(e) => e.stopPropagation()}>
            <Download size={13} />
          </a>
          <button
            className="icon-btn sm"
            title="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Excluir o projeto “${p.name}” e seus assets? Esta ação não pode ser desfeita.`)) void deleteProject(p.id);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {projects.length === 0 && <div className="empty">Nenhum projeto ainda.</div>}
      {creating && <NewCreationDialog onClose={() => setCreating(false)} />}
    </div>
  );
};

export const LeftSidebar = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const [tab, setTab] = useState<Tab>('scene');
  const duplicate = useEditor((s) => s.duplicateProject);
  const hasSpeech = useEditor((s) => Boolean(s.speech));
  const current = hasSpeech || tab !== 'speech' ? tab : 'scene';
  return (
    <aside className="panel area-left">
      <div className="tabs">
        <button className={`tab ${current === 'scene' ? 'on' : ''}`} onClick={() => setTab('scene')}>
          <Layers size={13} /> Cenas
        </button>
        {hasSpeech && (
          <button className={`tab ${current === 'speech' ? 'on' : ''}`} onClick={() => setTab('speech')}>
            <AudioLines size={13} /> Fala
          </button>
        )}
        <button className={`tab ${tab === 'templates' ? 'on' : ''}`} onClick={() => setTab('templates')}>
          <LayoutTemplate size={13} /> Templates
        </button>
        <button className={`tab ${tab === 'projects' ? 'on' : ''}`} onClick={() => setTab('projects')}>
          <FolderOpen size={13} /> Projetos
        </button>
      </div>
      {current === 'scene' && <ScenesTab project={project} model={model} />}
      {current === 'speech' && <SpeechTab project={project} model={model} />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'projects' && <ProjectsTab />}
      {tab === 'projects' && (
        <div style={{ padding: 10, borderTop: '1px solid var(--line)' }}>
          <button className="btn sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => void duplicate()}>
            <Copy size={13} /> Duplicar projeto atual
          </button>
        </div>
      )}
    </aside>
  );
};
