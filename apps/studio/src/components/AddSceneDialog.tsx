import { useMemo } from 'react';
import type { MotionProject } from '@lms/shared';
import { templateModules } from '@lms/catalog';
import { isDurationEditable, type SceneDefinition } from '@lms/template-sdk';
import { sceneCommands } from '../editor/sceneCommands';
import { SceneStill } from '../panels/SceneStill';
import { Dialog } from './ui';

const STRATEGY_LABEL: Record<SceneDefinition['duration']['strategy'], string> = {
  hold: 'sustentação ajustável',
  proportional: 'ritmo proporcional',
  fixed: 'duração fixa',
};

/** Catalog of the current template's scene types; picking one inserts a default instance. */
export const AddSceneDialog = ({ project, atIndex, onClose }: { project: MotionProject; atIndex: number; onClose: () => void }) => {
  const template = templateModules.get(project.templateId);
  // Previews use the project's theme and format, so the user sees what will be inserted.
  const previews = useMemo(
    () => template.sceneTypes.map((def) => ({ def, scene: template.createScene(def.id, { id: `preview-${def.id}`, name: def.name }) })),
    [template],
  );
  const where = atIndex >= project.scenes.length ? 'no fim do vídeo' : atIndex === 0 ? 'no início do vídeo' : `após “${project.scenes[atIndex - 1]!.name}”`;
  return (
    <Dialog
      title="Adicionar cena"
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
      }
    >
      <span className="muted" style={{ marginTop: -4 }}>
        Cenas de <b style={{ color: 'var(--text-0)' }}>{template.name}</b>. A nova cena entra {where} com os valores padrão do tipo e pode ser editada sem afetar as demais.
      </span>
      <div className="scene-catalog">
        {previews.map(({ def, scene }) => (
          <button
            key={def.id}
            className="scene-type-card"
            onClick={() => {
              onClose();
              sceneCommands.add(def.id, atIndex);
            }}
          >
            <SceneStill project={project} scene={scene} def={def} portrait={project.format === 'portrait'} />
            <div className="info">
              <b>{def.name}</b>
              <span className="muted">{def.description}</span>
              <span className="mono muted" style={{ fontSize: 10.5 }}>
                {def.duration.default.toFixed(1)}s
                {isDurationEditable(def) ? ` · ${def.duration.min}–${def.duration.max}s` : ''} · {STRATEGY_LABEL[def.duration.strategy]}
              </span>
            </div>
          </button>
        ))}
      </div>
    </Dialog>
  );
};
