import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BookmarkPlus, ChevronDown, Copy, Download, FilePlus2, Redo2, RotateCcw, Save, Send, Undo2, Upload } from 'lucide-react';
import type { MotionProject } from '@lms/shared';
import { api } from '../api/client';
import { useEditor } from '../stores/editor';
import { NewCreationDialog } from './NewCreationDialog';
import { SaveTemplateDialog } from './SaveTemplateDialog';
import { RenderButton } from './RenderPanel';
import { useDismiss } from './ui';

const SAVE_LABEL = { idle: '', dirty: 'Alterações não salvas', saving: 'Salvando…', saved: 'Salvo localmente', error: 'Erro ao salvar', conflict: 'Conflito de versão' } as const;

const Logo = () => (
  <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
    <rect width="32" height="32" rx="8" fill="#0F121A" />
    <circle cx="16" cy="16" r="9" fill="none" stroke="#F5F7FF" strokeWidth="1.8" />
    <rect x="11.5" y="11.5" width="9" height="9" fill="none" stroke="#6574FF" strokeWidth="1.6" transform="rotate(45 16 16)" />
    <circle cx="16" cy="16" r="2.8" fill="#B8FF35" />
    <path d="M3 16h26" stroke="#B8FF35" strokeWidth="1.3" />
  </svg>
);

export const TopBar = ({ project }: { project: MotionProject }) => {
  const saveState = useEditor((s) => s.saveState);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const templates = useEditor((s) => s.templates);
  const { update, save, undo, redo, duplicateProject, resetProject, importProject } = useEditor.getState();
  const [name, setName] = useState(project.name);
  const [menu, setMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const free = templates.find((t) => t.id === project.templateId)?.mode === 'free';
  const origin = project.origin;
  const fileRef = useRef<HTMLInputElement>(null);
  const menuBtn = useRef<HTMLDivElement>(null);
  const menuPop = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  useDismiss(menu, closeMenu, menuBtn, menuPop);
  useEffect(() => setName(project.name), [project.name]);

  const item = (icon: ReactNode, label: string, action: () => void, hint?: string, danger = false) => (
    <button
      className={`menu-item ${danger ? 'danger' : ''}`}
      onClick={() => {
        setMenu(false);
        action();
      }}
    >
      {icon}
      {label}
      {hint && <span className="muted kbd">{hint}</span>}
    </button>
  );

  return (
    <header className="topbar area-top">
      <div className="brand">
        <Logo />
        Local Motion <small>Studio</small>
      </div>
      <input
        className="project-name"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => (name.trim() ? update(['name'], name.trim()) : setName(project.name))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Nome do projeto"
      />
      <div style={{ position: 'relative' }} ref={menuBtn}>
        <button className="btn ghost sm" onClick={() => setMenu((m) => !m)}>
          Projeto <ChevronDown size={13} />
        </button>
        {menu && (
          <div className="popover" ref={menuPop} style={{ top: 34, left: 0, width: 250 }}>
            {item(<FilePlus2 size={14} />, 'Nova criação…', () => setCreating(true))}
            {item(<Save size={14} />, 'Salvar', () => void save(), 'Ctrl S')}
            {item(<Copy size={14} />, 'Duplicar', () => void duplicateProject())}
            <div className="divider" />
            {origin.kind === 'template-draft'
              ? item(<Send size={14} />, 'Publicar nova revisão do template', () => void useEditor.getState().publishDraft())
              : item(<BookmarkPlus size={14} />, 'Salvar como template…', () => setSavingTemplate(true))}
            <div className="divider" />
            {item(<Download size={14} />, 'Exportar configuração JSON', () => {
              void save().then(() => window.location.assign(api.exportUrl(project.id)));
            })}
            {item(<Upload size={14} />, 'Importar configuração JSON…', () => fileRef.current?.click())}
            <div className="divider" />
            {!free &&
              item(<RotateCcw size={14} />, 'Restaurar valores originais', () => {
                if (confirm('Restaurar todos os textos, cores, backgrounds e animações para os valores do template? (Pode desfazer com Ctrl+Z)')) resetProject();
              }, undefined, true)}
          </div>
        )}
      </div>
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
      <div className={`save-state ${saveState === 'conflict' ? 'error' : saveState}`}>
        <span className="dot" />
        {SAVE_LABEL[saveState]}
      </div>
      {saveState === 'conflict' && (
        <>
          <button className="btn sm" onClick={() => void useEditor.getState().reloadFromDisk()} title="Descarta as suas alterações locais">
            Recarregar do disco
          </button>
          <button className="btn sm danger" onClick={() => void save({ force: true })} title="Grava a sua versão por cima da outra">
            Sobrescrever
          </button>
        </>
      )}
      <button className="icon-btn" disabled={!canUndo} onClick={undo} title="Desfazer (Ctrl+Z)">
        <Undo2 size={15} />
      </button>
      <button className="icon-btn" disabled={!canRedo} onClick={redo} title="Refazer (Ctrl+Shift+Z)">
        <Redo2 size={15} />
      </button>
      <div className="spacer" />
      {origin.kind === 'template-draft' ? (
        <div className="draft-banner">
          <span>
            Editando template <b>{origin.name}</b> · base rev. {origin.revision}
          </span>
          <button className="btn sm primary" onClick={() => void useEditor.getState().publishDraft()} title="Grava esta composição como nova revisão. Projetos já criados não mudam.">
            <Send size={13} /> Publicar revisão
          </button>
        </div>
      ) : (
        <span className="muted" style={{ fontSize: 11.5 }}>
          {origin.kind === 'user-template' ? `Template: ${origin.name} · rev. ${origin.revision}` : templates.find((t) => t.id === project.templateId)?.name}
        </span>
      )}
      <RenderButton />
      {creating && <NewCreationDialog onClose={() => setCreating(false)} />}
      {savingTemplate && <SaveTemplateDialog project={project} onClose={() => setSavingTemplate(false)} />}
    </header>
  );
};
