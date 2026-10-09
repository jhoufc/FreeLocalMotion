import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import type { Format } from '@lms/shared';
import { useEditor } from '../stores/editor';
import { Dialog } from './ui';

export const NewProjectDialog = ({ templateId, onClose }: { templateId: string; onClose: () => void }) => {
  const templates = useEditor((s) => s.templates);
  const create = useEditor((s) => s.createProject);
  const [tid, setTid] = useState(templateId);
  const [name, setName] = useState('Novo projeto');
  const [format, setFormat] = useState<Format>('landscape');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    await create(tid, name.trim() || 'Novo projeto', format);
    setBusy(false);
    onClose();
  };
  return (
    <Dialog
      title="Novo projeto"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy} onClick={() => void submit()}>
            Criar projeto
          </button>
        </>
      }
    >
      <div className="field">
        <div className="field-label">Template</div>
        <select className="select" value={tid} onChange={(e) => setTid(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="field-label">Nome</div>
        <input className="input" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
      </div>
      <div className="field">
        <div className="field-label">Formato inicial (pode alternar depois)</div>
        <div className="segmented">
          <button className={format === 'landscape' ? 'on' : ''} onClick={() => setFormat('landscape')}>
            <Monitor size={12} style={{ verticalAlign: -2, marginRight: 6 }} />
            Horizontal 16:9
          </button>
          <button className={format === 'portrait' ? 'on' : ''} onClick={() => setFormat('portrait')}>
            <Smartphone size={12} style={{ verticalAlign: -2, marginRight: 6 }} />
            Vertical 9:16
          </button>
        </div>
      </div>
    </Dialog>
  );
};
