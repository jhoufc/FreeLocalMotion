import { memo, useDeferredValue, useMemo, useRef, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { Copy, Download, Eye, EyeOff, FolderOpen, Layers, LayoutTemplate, Plus, Trash2, Upload, Clapperboard } from 'lucide-react';
import { getAtPath, type MotionProject } from '@lms/shared';
import { TemplateStage, templateModules, type StageProps } from '@lms/catalog';
import type { SceneRange } from '@lms/template-sdk';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';
import { sceneAtFrame, type ProjectModel } from '../editor/useProjectModel';
import { api } from '../api/client';
import { KindIcon } from './KindIcon';
import { NewProjectDialog } from '../components/NewProjectDialog';

type Tab = 'scene' | 'templates' | 'projects';

/* ------------------------------------------------------------------ */
/* Scenes + layers                                                     */
/* ------------------------------------------------------------------ */

const SceneThumb = memo(({ project, frame, portrait }: { project: MotionProject; frame: number; portrait: boolean }) => {
  const meta = templateModules.get(project.templateId).getMetadata(project);
  const inputProps = useMemo<StageProps>(() => ({ project, assetBaseUrl: '' }), [project]);
  return (
    <div className={`thumb ${portrait ? 'portrait' : ''}`}>
      <Thumbnail
        component={TemplateStage}
        inputProps={inputProps}
        compositionWidth={meta.width}
        compositionHeight={meta.height}
        durationInFrames={meta.durationInFrames}
        fps={meta.fps}
        frameToDisplay={Math.min(meta.durationInFrames - 1, frame)}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});

const ScenesTab = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const selected = useEditor((s) => s.selectedTargetId);
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.update);
  const current = usePlayback((s) => sceneAtFrame(model.ranges, s.frame)?.id);
  const deferred = useDeferredValue(project);
  const selectedTarget = model.targetsById.get(selected);
  const activeSceneId = selectedTarget?.sceneId ?? current ?? project.scenes[0]!.id;
  const layers = model.targets.filter((t) => t.sceneId === activeSceneId && t.kind !== 'scene');
  const globals = model.targets.filter((t) => t.sceneId === null);

  // Thumbnails show each scene at a moment where its typography has settled.
  const heroFrame = (r: SceneRange) => r.from + Math.round(r.durationInFrames * 0.62);

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
          {(model.durationInFrames / model.fps).toFixed(1)}s
        </span>
      </div>
      {project.scenes.map((scene, i) => {
        const r = model.ranges[i]!;
        return (
          <div
            key={scene.id}
            className={`scene-card ${activeSceneId === scene.id ? 'on' : ''} ${current === scene.id ? 'playing' : ''}`}
            onClick={() => {
              select(scene.id);
              usePlayback.getState().seek(r.from);
            }}
          >
            <SceneThumb project={deferred} frame={heroFrame(r)} portrait={project.format === 'portrait'} />
            <div className="meta">
              <b>
                <span className="mono" style={{ color: 'var(--accent)', marginRight: 6 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {scene.name}
              </b>
              <span>
                {(r.from / model.fps).toFixed(1)}s → {((r.from + r.durationInFrames) / model.fps).toFixed(1)}s · {scene.duration.toFixed(1)}s
              </span>
            </div>
          </div>
        );
      })}

      <div className="section-title">
        <span>Elementos da cena</span>
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

const TemplatePreview = ({ templateId }: { templateId: string }) => {
  const [hover, setHover] = useState(false);
  const template = templateModules.get(templateId);
  const project = useMemo(() => template.createDefaults({ id: 'library-preview', name: template.name, format: 'landscape', now: '1970-01-01T00:00:00.000Z' }), [template]);
  const meta = template.getMetadata(project);
  const inputProps = useMemo<StageProps>(() => ({ project, assetBaseUrl: '' }), [project]);
  const common = {
    component: TemplateStage,
    inputProps,
    compositionWidth: meta.width,
    compositionHeight: meta.height,
    durationInFrames: meta.durationInFrames,
    fps: meta.fps,
    style: { width: '100%', height: '100%' },
  };
  return (
    <div className="preview" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {hover ? <Player {...common} autoPlay loop controls={false} acknowledgeRemotionLicense /> : <Thumbnail {...common} frameToDisplay={Math.round(meta.fps * 1.9)} />}
    </div>
  );
};

const TemplatesTab = () => {
  const templates = useEditor((s) => s.templates);
  const [creating, setCreating] = useState<string | null>(null);
  return (
    <div className="scroll">
      <div className="section-title">
        <span>Biblioteca</span>
        <span>{templates.length}</span>
      </div>
      {templates.map((t) => (
        <div key={t.id} className="template-card">
          <TemplatePreview templateId={t.id} />
          <div className="info">
            <div className="field-row" style={{ justifyContent: 'space-between' }}>
              <b>{t.name}</b>
              <span className="mono muted" style={{ fontSize: 10.5 }}>
                v{t.version} · {t.durationSeconds.toFixed(0)}s
              </span>
            </div>
            <span className="muted">{t.description}</span>
            <div className="tags">
              {t.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
              <span className="tag">9:16 + 16:9</span>
            </div>
            <button className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={() => setCreating(t.id)}>
              <Plus size={14} /> Novo projeto com este template
            </button>
          </div>
        </div>
      ))}
      <div className="template-card soon">
        <div className="info">
          <b>Adicionar um template</b>
          <span className="muted">
            Novos templates registram schema, composição, campos e timeline no registry — sem alterar o editor. Veja <span className="mono">docs/creating-templates.md</span>.
          </span>
        </div>
      </div>
      {creating && <NewProjectDialog templateId={creating} onClose={() => setCreating(null)} />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

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
          <Plus size={13} /> Novo
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
            <b>{p.name}</b>
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
      {creating && templates[0] && <NewProjectDialog templateId={templates[0].id} onClose={() => setCreating(false)} />}
    </div>
  );
};

export const LeftSidebar = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const [tab, setTab] = useState<Tab>('scene');
  const duplicate = useEditor((s) => s.duplicateProject);
  return (
    <aside className="panel area-left">
      <div className="tabs">
        <button className={`tab ${tab === 'scene' ? 'on' : ''}`} onClick={() => setTab('scene')}>
          <Layers size={13} /> Cenas
        </button>
        <button className={`tab ${tab === 'templates' ? 'on' : ''}`} onClick={() => setTab('templates')}>
          <LayoutTemplate size={13} /> Templates
        </button>
        <button className={`tab ${tab === 'projects' ? 'on' : ''}`} onClick={() => setTab('projects')}>
          <FolderOpen size={13} /> Projetos
        </button>
      </div>
      {tab === 'scene' && <ScenesTab project={project} model={model} />}
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
