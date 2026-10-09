import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { getAtPath, type MotionProject } from '@lms/shared';
import { useEditor } from '../stores/editor';
import type { ProjectModel } from '../editor/useProjectModel';
import { FieldControl } from './fields';
import { KindIcon } from './KindIcon';

const KIND_LABEL = { project: 'Projeto', scene: 'Cena', text: 'Texto', graphic: 'Elemento gráfico', overlay: 'Overlay global' } as const;

export const Inspector = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const selectedId = useEditor((s) => s.selectedTargetId);
  const update = useEditor((s) => s.update);
  const resetTarget = useEditor((s) => s.resetTarget);
  const select = useEditor((s) => s.select);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const target = model.targetsById.get(selectedId) ?? model.targetsById.get('project')!;
  const scene = target.sceneId ? project.scenes.find((s) => s.id === target.sceneId) : undefined;
  const visible = target.visibilityPath ? Boolean(getAtPath(project, target.visibilityPath)) : true;

  return (
    <aside className="panel area-right">
      <div className="inspector-head">
        <div className="crumb">
          {scene ? (
            <>
              <button className="btn ghost sm" style={{ padding: 0, height: 'auto' }} onClick={() => select(scene.id)}>
                {scene.name}
              </button>
              <span>›</span>
            </>
          ) : null}
          <span>{KIND_LABEL[target.kind]}</span>
        </div>
        <h2>
          <span className={`kind kind-${target.kind}`}>
            <KindIcon kind={target.kind} size={15} />
          </span>
          <span style={{ flex: 1 }}>{target.label}</span>
          {target.visibilityPath && (
            <button className="icon-btn sm" title={visible ? 'Ocultar' : 'Mostrar'} onClick={() => update(target.visibilityPath!, !visible)}>
              {visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          {target.kind !== 'project' && (
            <button className="icon-btn sm" title="Restaurar valores originais deste item" onClick={() => resetTarget(target.id)}>
              <RotateCcw size={13} />
            </button>
          )}
        </h2>
        {target.description && <p>{target.description}</p>}
      </div>
      <div className="scroll">
        {target.sections.map((section) => {
          const key = `${target.kind}:${section.id}`;
          const isCollapsed = collapsed[key] ?? false;
          return (
            <div key={section.id + section.label} className="insp-section">
              <button onClick={() => setCollapsed((c) => ({ ...c, [key]: !isCollapsed }))}>
                <span>{section.label}</span>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              {!isCollapsed && (
                <div className="insp-fields">
                  {section.fields.map((f) => (
                    <FieldControl key={f.path.join('.')} field={f} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
