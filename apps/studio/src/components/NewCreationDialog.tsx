import { useState } from 'react';
import { AudioLines, LayoutTemplate, Monitor, Smartphone, Sparkles } from 'lucide-react';
import type { Format } from '@lms/shared';
import { useEditor } from '../stores/editor';
import { Dialog } from './ui';
import { SpeechDialog } from './SpeechDialog';

type Mode = 'free' | 'template' | 'speech';
/** `native:<id>` or `user:<id>`. */
type Source = string;

/**
 * "Nova criação": either a blank free composition (pick scenes from the library) or a
 * project started from a template — native (Signature / 001) or saved by the user.
 */
export const NewCreationDialog = ({ onClose, initial }: { onClose: () => void; initial?: { mode: Mode; source?: Source } }) => {
  const templates = useEditor((s) => s.templates);
  const userTemplates = useEditor((s) => s.userTemplates);
  const starters = useEditor((s) => s.starters);
  const { createProject, createFromUserTemplate, createFromStarter } = useEditor.getState();
  const free = templates.find((t) => t.mode === 'free');
  const natives = templates.filter((t) => t.mode !== 'free');
  const [mode, setMode] = useState<Mode>(initial?.mode ?? 'free');
  const [source, setSource] = useState<Source>(initial?.source ?? (natives[0] ? `native:${natives[0].id}` : ''));
  const [name, setName] = useState('');
  const [format, setFormat] = useState<Format>(initial?.mode === 'template' ? 'landscape' : 'portrait');
  const [busy, setBusy] = useState(false);

  if (mode === 'speech') return <SpeechDialog onClose={onClose} />;

  const submit = async () => {
    setBusy(true);
    const n = name.trim() || undefined;
    if (mode === 'free' && free) await createProject(free.id, n ?? 'Nova composição', format);
    else if (source.startsWith('user:')) await createFromUserTemplate(source.slice(5), n, format);
    else if (source.startsWith('starter:')) await createFromStarter(source.slice(8), n, format);
    else if (source.startsWith('native:')) await createProject(source.slice(7), n ?? 'Novo projeto', format);
    setBusy(false);
    onClose();
  };

  return (
    <Dialog
      title="Nova criação"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy || (mode === 'template' && !source)} onClick={() => void submit()}>
            {mode === 'free' ? 'Criar composição' : 'Criar projeto'}
          </button>
        </>
      }
    >
      <div className="mode-cards">
        <button className={`mode-card ${mode === 'free' ? 'on' : ''}`} onClick={() => setMode('free')} disabled={!free}>
          <Sparkles size={18} />
          <b>Composição livre</b>
          <span>Timeline vazia. Combine cenas de qualquer família da biblioteca.</span>
        </button>
        <button className={`mode-card ${mode === 'template' ? 'on' : ''}`} onClick={() => setMode('template')}>
          <LayoutTemplate size={18} />
          <b>A partir de um template</b>
          <span>Comece de um storyboard pronto — nativo ou salvo por você.</span>
        </button>
        <button className="mode-card" onClick={() => setMode('speech')} disabled={!free}>
          <AudioLines size={18} />
          <b>A partir da fala</b>
          <span>Envie o áudio/vídeo ou a transcrição: as cenas seguem o que você diz.</span>
        </button>
      </div>

      {mode === 'template' && (
        <div className="field">
          <div className="field-label">Template</div>
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
            <optgroup label="Nativos">
              {natives.map((t) => (
                <option key={t.id} value={`native:${t.id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            {starters.length > 0 && (
              <optgroup label="Composições prontas">
                {starters.map((s) => (
                  <option key={s.id} value={`starter:${s.id}`}>
                    {s.name} · {s.sceneCount} cenas · {Math.round(s.durationSeconds)}s
                  </option>
                ))}
              </optgroup>
            )}
            {userTemplates.length > 0 && (
              <optgroup label="Meus templates">
                {userTemplates.map((t) => (
                  <option key={t.id} value={`user:${t.id}`}>
                    {t.name} · rev. {t.revision}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      )}

      <div className="field">
        <div className="field-label">Nome</div>
        <input
          className="input"
          autoFocus
          placeholder={mode === 'free' ? 'Nova composição' : 'Novo projeto'}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
      </div>
      <div className="field">
        <div className="field-label">Proporção (pode alternar depois)</div>
        <div className="segmented">
          <button className={format === 'portrait' ? 'on' : ''} onClick={() => setFormat('portrait')}>
            <Smartphone size={12} style={{ verticalAlign: -2, marginRight: 6 }} />
            Vertical 9:16
          </button>
          <button className={format === 'landscape' ? 'on' : ''} onClick={() => setFormat('landscape')}>
            <Monitor size={12} style={{ verticalAlign: -2, marginRight: 6 }} />
            Horizontal 16:9
          </button>
        </div>
      </div>
    </Dialog>
  );
};
