import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SCENE_CATEGORIES, SCENE_CATEGORY_LABELS, type MotionProject, type SceneCategory } from '@lms/shared';
import { computeSceneRanges, totalFrames } from '@lms/template-sdk';
import { sceneDefinitions } from '@lms/catalog';
import { useEditor } from '../stores/editor';
import { Dialog } from './ui';

/**
 * "Salvar como template": validates the composition, then asks for name, description and
 * category. The server snapshots the scenes, copies the assets and renders a thumbnail.
 */
export const SaveTemplateDialog = ({ project, onClose }: { project: MotionProject; onClose: () => void }) => {
  const saveAsTemplate = useEditor((s) => s.saveAsTemplate);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState('');
  const counts = new Map<string, number>();
  for (const s of project.scenes) {
    const c = sceneDefinitions.find(s.type)?.category ?? 'typography';
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const dominant = ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'typography') as SceneCategory;
  const [category, setCategory] = useState<SceneCategory>(dominant);
  const [busy, setBusy] = useState(false);

  const ranges = computeSceneRanges(project.scenes, project.fps);
  const unknown = project.scenes.filter((s) => !sceneDefinitions.has(s.type));
  const problems = [
    ...(ranges.length === 0 ? ['A composição não tem cenas ativas.'] : []),
    ...unknown.map((s) => `A cena “${s.name}” não está na biblioteca global.`),
  ];
  const usedAssets = project.assets.length;

  const submit = async () => {
    if (problems.length || !name.trim()) return;
    setBusy(true);
    const saved = await saveAsTemplate({ name: name.trim(), description: description.trim(), category });
    setBusy(false);
    if (saved) onClose();
  };

  return (
    <Dialog
      title="Salvar como template"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy || problems.length > 0 || !name.trim()} onClick={() => void submit()}>
            {busy ? 'Salvando…' : 'Salvar template'}
          </button>
        </>
      }
    >
      {problems.length ? (
        <div className="callout danger">
          <AlertTriangle size={14} />
          <div>{problems.map((p) => <div key={p}>{p}</div>)}</div>
        </div>
      ) : (
        <div className="callout">
          <CheckCircle2 size={14} />
          <div>
            {ranges.length} cena{ranges.length === 1 ? '' : 's'} · {(totalFrames(ranges) / project.fps).toFixed(1)}s · {usedAssets} asset{usedAssets === 1 ? '' : 's'} copiado
            {usedAssets === 1 ? '' : 's'} para o template. Ordem, textos, cores, backgrounds, layouts por formato e estilo global são preservados.
          </div>
        </div>
      )}
      <div className="field">
        <div className="field-label">Nome</div>
        <input className="input" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
      </div>
      <div className="field">
        <div className="field-label">
          <span>Descrição (opcional)</span>
          <span className="value">{description.length}/280</span>
        </div>
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
      <span className="muted" style={{ fontSize: 11.5 }}>
        Projetos criados a partir do template são cópias independentes. Editar o template depois gera uma nova revisão, sem alterar projetos existentes.
      </span>
    </Dialog>
  );
};
