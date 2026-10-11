import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { SCENE_CATEGORY_LABELS, type MotionProject, type SceneCategory } from '@lms/shared';
import { templateModules } from '@lms/catalog';
import { isDurationEditable, type SceneDefinition } from '@lms/template-sdk';
import { sceneCommands } from '../editor/sceneCommands';
import { ScenePreview } from '../panels/SceneStill';
import { Dialog } from './ui';

const STRATEGY_LABEL: Record<SceneDefinition['duration']['strategy'], string> = {
  hold: 'sustentação ajustável',
  proportional: 'ritmo proporcional',
  fixed: 'duração fixa',
};

const PALETTE_KEY = 'lms:keepScenePalette';
const readKeepPalette = () => {
  try {
    return localStorage.getItem(PALETTE_KEY) === '1';
  } catch {
    return false;
  }
};

const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Scene library. Lists the scene types the project's template accepts — every type of the
 * global library for free compositions — with search, categories, family badges and
 * thumbnails rendered from the real scene (hover plays it).
 */
export const AddSceneDialog = ({ project, atIndex, onClose }: { project: MotionProject; atIndex: number; onClose: () => void }) => {
  const template = templateModules.get(project.templateId);
  const free = template.mode === 'free';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SceneCategory | 'all'>('all');
  const [keepPalette, setKeepPalette] = useState(readKeepPalette);
  const types = template.sceneTypes;
  const categories = useMemo(() => [...new Set(types.map((t) => t.category))], [types]);
  const families = useMemo(() => [...new Set(types.map((t) => t.family.name))], [types]);

  // Previews use the project's theme and format, so the user sees what will be inserted.
  const previews = useMemo(
    () =>
      types.map((def) => {
        let scene = template.createScene(def.id, { id: `preview-${def.id}`, name: def.name });
        const original = (def as { palette?: Partial<MotionProject['theme']> }).palette;
        if (free && keepPalette && original) scene = { ...scene, palette: { ...scene.palette, ...original } };
        return { def, scene };
      }),
    [template, types, free, keepPalette],
  );

  const q = normalize(query.trim());
  const shown = previews.filter(
    ({ def }) =>
      (category === 'all' || def.category === category) &&
      (!q || normalize(`${def.name} ${def.description} ${def.family.name} ${SCENE_CATEGORY_LABELS[def.category]}`).includes(q)),
  );
  const where = atIndex >= project.scenes.length ? 'no fim do vídeo' : atIndex === 0 ? 'no início do vídeo' : `após “${project.scenes[atIndex - 1]!.name}”`;

  const add = (def: SceneDefinition) => {
    onClose();
    sceneCommands.add(def.id, atIndex, { keepPalette: free && keepPalette });
  };

  return (
    <Dialog
      title={free ? 'Biblioteca de cenas' : 'Adicionar cena'}
      wide={free}
      onClose={onClose}
      footer={
        <>
          {free && (
            <div className="palette-choice">
              <span className="muted">Cores da nova cena</span>
              <div className="segmented" style={{ width: 280 }}>
                <button
                  className={!keepPalette ? 'on' : ''}
                  onClick={() => {
                    setKeepPalette(false);
                    try {
                      localStorage.setItem(PALETTE_KEY, '0');
                    } catch {
                      /* convenience only */
                    }
                  }}
                >
                  Paleta da composição
                </button>
                <button
                  className={keepPalette ? 'on' : ''}
                  onClick={() => {
                    setKeepPalette(true);
                    try {
                      localStorage.setItem(PALETTE_KEY, '1');
                    } catch {
                      /* convenience only */
                    }
                  }}
                >
                  Original da cena
                </button>
              </div>
            </div>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
        </>
      }
    >
      <span className="muted" style={{ marginTop: -4 }}>
        {free ? `${types.length} cenas de ${families.length} famílias` : `Cenas de ${template.name}`}. A nova cena entra {where} com os valores padrão e pode ser editada sem afetar as demais.
      </span>
      {types.length > 4 && (
        <div className="library-filters">
          <div className="search-box">
            <Search size={13} />
            <input className="input" autoFocus placeholder="Buscar por nome, família ou categoria" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="chips">
            <button className={`chip ${category === 'all' ? 'on' : ''}`} onClick={() => setCategory('all')}>
              Todas
            </button>
            {categories.map((c) => (
              <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
                {SCENE_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`scene-catalog ${free ? 'wide' : ''}`}>
        {shown.map(({ def, scene }) => (
          <div key={def.id} className="scene-type-card" role="button" tabIndex={0} onClick={() => add(def)} onKeyDown={(e) => e.key === 'Enter' && add(def)}>
            <ScenePreview project={project} scene={scene} def={def} portrait={project.format === 'portrait'} />
            <div className="info">
              <div className="field-row" style={{ justifyContent: 'space-between', gap: 6 }}>
                <b>{def.name}</b>
                <span className="mono muted" style={{ fontSize: 10.5 }}>
                  {def.duration.default.toFixed(1)}s
                </span>
              </div>
              <div className="field-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                <span className="type-badge">{SCENE_CATEGORY_LABELS[def.category]}</span>
                <span className="type-badge quiet">{def.family.name}</span>
              </div>
              <span className="muted desc">{def.description}</span>
              <span className="mono muted" style={{ fontSize: 10 }}>
                {isDurationEditable(def) ? `${def.duration.min}–${def.duration.max}s · ` : ''}
                {STRATEGY_LABEL[def.duration.strategy]}
              </span>
              <span className="add-hint">
                <Plus size={12} /> Adicionar
              </span>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="empty">Nenhuma cena encontrada para “{query}”.</div>}
      </div>
    </Dialog>
  );
};
