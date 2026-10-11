import { useMemo, useRef, useState } from 'react';
import { Player, Thumbnail } from '@remotion/player';
import { Copy, LayoutTemplate, MoreHorizontal, Pencil, Plus, Sparkles, Tag, Trash2 } from 'lucide-react';
import { SCENE_CATEGORIES, SCENE_CATEGORY_LABELS, type SceneCategory, type UserTemplateSummary } from '@lms/shared';
import { TemplateStage, buildStarter, templateModules, type StageProps } from '@lms/catalog';
import { api } from '../api/client';
import { useEditor } from '../stores/editor';
import { NewCreationDialog } from '../components/NewCreationDialog';
import { Dialog, useDismiss } from '../components/ui';

const TemplatePreview = ({ templateId, starterId }: { templateId: string; starterId?: string }) => {
  const [hover, setHover] = useState(false);
  const template = templateModules.get(templateId);
  const project = useMemo(
    () =>
      starterId
        ? buildStarter(starterId, { id: 'library-preview', format: 'landscape', now: '1970-01-01T00:00:00.000Z' })
        : template.createDefaults({ id: 'library-preview', name: template.name, format: 'landscape', now: '1970-01-01T00:00:00.000Z' }),
    [template, starterId],
  );
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

/** Rename / re-describe / re-categorize a user template (metadata only, no new revision). */
const TemplateMetaDialog = ({ template, onClose }: { template: UserTemplateSummary; onClose: () => void }) => {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [category, setCategory] = useState<SceneCategory>(template.category);
  const submit = async () => {
    if (!name.trim()) return;
    await useEditor.getState().updateUserTemplate(template.id, { name: name.trim(), description, category });
    onClose();
  };
  return (
    <Dialog
      title="Editar informações do template"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!name.trim()} onClick={() => void submit()}>
            Salvar
          </button>
        </>
      }
    >
      <div className="field">
        <div className="field-label">Nome</div>
        <input className="input" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <div className="field-label">Descrição</div>
        <textarea className="textarea" rows={2} maxLength={280} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <div className="field-label">Categoria</div>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value as SceneCategory)}>
          {SCENE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SCENE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
    </Dialog>
  );
};

const UserTemplateCard = ({ t, onUse, onEditMeta }: { t: UserTemplateSummary; onUse: () => void; onEditMeta: () => void }) => {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(menu, () => setMenu(false), ref);
  const { editUserTemplate, duplicateUserTemplate, deleteUserTemplate } = useEditor.getState();
  const item = (label: string, icon: React.ReactNode, run: () => void, danger = false) => (
    <button
      className={`menu-item ${danger ? 'danger' : ''}`}
      onClick={() => {
        setMenu(false);
        run();
      }}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="template-card user">
      <div className={`preview ${t.format === 'portrait' ? 'portrait' : ''}`}>
        {t.thumbnail ? <img src={api.templateThumbUrl(t.id, t.thumbnail)} alt="" /> : <LayoutTemplate size={22} className="muted" />}
      </div>
      <div className="info">
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <b title={t.name}>{t.name}</b>
          <div style={{ position: 'relative' }} ref={ref}>
            <button className="icon-btn sm" title="Ações do template" onClick={() => setMenu((m) => !m)}>
              <MoreHorizontal size={14} />
            </button>
            {menu && (
              <div className="popover" style={{ top: 26, right: 0, width: 230 }}>
                {item('Editar template (nova revisão)', <Pencil size={13} />, () => void editUserTemplate(t.id))}
                {item('Renomear / categoria', <Tag size={13} />, onEditMeta)}
                {item('Duplicar', <Copy size={13} />, () => void duplicateUserTemplate(t.id))}
                <div className="divider" />
                {item(
                  'Excluir template',
                  <Trash2 size={13} />,
                  () => {
                    if (confirm(`Excluir o template “${t.name}” e todas as revisões? Projetos já criados a partir dele não serão alterados.`)) void deleteUserTemplate(t.id);
                  },
                  true,
                )}
              </div>
            )}
          </div>
        </div>
        <span className="mono muted" style={{ fontSize: 10.5 }}>
          rev. {t.revision} · {t.sceneCount} cenas · {t.durationSeconds.toFixed(1)}s · {t.format === 'portrait' ? '9:16' : '16:9'}
        </span>
        {t.description && <span className="muted desc">{t.description}</span>}
        <div className="tags">
          <span className="tag">{SCENE_CATEGORY_LABELS[t.category]}</span>
          <span className="tag">Meu template</span>
        </div>
        <button className="btn primary sm" style={{ justifyContent: 'center' }} onClick={onUse}>
          <Plus size={13} /> Criar projeto
        </button>
      </div>
    </div>
  );
};

export const TemplatesTab = () => {
  const templates = useEditor((s) => s.templates);
  const userTemplates = useEditor((s) => s.userTemplates);
  const starters = useEditor((s) => s.starters);
  const free = templates.find((t) => t.mode === 'free');
  const [creating, setCreating] = useState<{ mode: 'free' | 'template'; source?: string } | null>(null);
  const [editing, setEditing] = useState<UserTemplateSummary | null>(null);
  const natives = templates.filter((t) => t.mode !== 'free');
  return (
    <div className="scroll">
      <div className="section-title">
        <span>Criar</span>
      </div>
      <button className="create-free" onClick={() => setCreating({ mode: 'free' })}>
        <Sparkles size={16} />
        <div>
          <b>Composição livre</b>
          <span>Timeline vazia + biblioteca de cenas</span>
        </div>
      </button>

      {free && starters.length > 0 && (
        <>
          <div className="section-title">
            <span>Composições prontas</span>
            <span>{starters.length}</span>
          </div>
          {starters.map((s) => (
            <div key={s.id} className="template-card">
              <TemplatePreview templateId={free.id} starterId={s.id} />
              <div className="info">
                <div className="field-row" style={{ justifyContent: 'space-between' }}>
                  <b>{s.name}</b>
                  <span className="mono muted" style={{ fontSize: 10.5 }}>
                    {s.sceneCount} cenas · {Math.round(s.durationSeconds)}s
                  </span>
                </div>
                <span className="muted desc">{s.description}</span>
                <div className="tags">
                  <span className="tag">{SCENE_CATEGORY_LABELS[s.category]}</span>
                  <span className="tag">Nativo · editável</span>
                </div>
                <button className="btn primary sm" style={{ justifyContent: 'center' }} onClick={() => setCreating({ mode: 'template', source: `starter:${s.id}` })}>
                  <Plus size={13} /> Usar composição
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">
        <span>Templates nativos</span>
        <span>{natives.length}</span>
      </div>
      {natives.map((t) => (
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
              <span className="tag">Nativo · protegido</span>
            </div>
            <button className="btn primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={() => setCreating({ mode: 'template', source: `native:${t.id}` })}>
              <Plus size={14} /> Novo projeto com este template
            </button>
          </div>
        </div>
      ))}

      <div className="section-title">
        <span>Meus templates</span>
        <span>{userTemplates.length}</span>
      </div>
      {userTemplates.map((t) => (
        <UserTemplateCard key={t.id} t={t} onUse={() => setCreating({ mode: 'template', source: `user:${t.id}` })} onEditMeta={() => setEditing(t)} />
      ))}
      {userTemplates.length === 0 && (
        <div className="empty" style={{ padding: '4px 14px 16px', textAlign: 'left' }}>
          Nenhum template salvo ainda. Monte uma composição e use <b>Projeto → Salvar como template…</b>
        </div>
      )}
      {creating && <NewCreationDialog initial={creating} onClose={() => setCreating(null)} />}
      {editing && <TemplateMetaDialog template={editing} onClose={() => setEditing(null)} />}
    </div>
  );
};
