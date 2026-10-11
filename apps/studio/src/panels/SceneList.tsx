import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MotionProject } from '@lms/shared';
import { isDurationEditable, sceneTypeOf } from '@lms/template-sdk';
import { SceneStill } from './SceneStill';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';
import { sceneAtFrame, type ProjectModel } from '../editor/useProjectModel';
import { sceneCommands } from '../editor/sceneCommands';
import { useDismiss } from '../components/ui';
import { AddSceneDialog } from '../components/AddSceneDialog';

type Scene = MotionProject['scenes'][number];

const SceneMenu = ({ scene, index, count, onRename, onClose }: { scene: Scene; index: number; count: number; onRename: () => void; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, ref);
  const item = (label: string, icon: ReactNode, run: () => void, opts: { hint?: string; disabled?: boolean; danger?: boolean } = {}) => (
    <button
      className={`menu-item ${opts.danger ? 'danger' : ''}`}
      disabled={opts.disabled}
      style={opts.disabled ? { opacity: 0.4, cursor: 'default' } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
        run();
      }}
    >
      {icon}
      {label}
      {opts.hint && <span className="muted mono">{opts.hint}</span>}
    </button>
  );
  return (
    <div className="popover scene-menu" ref={ref} onClick={(e) => e.stopPropagation()} role="menu">
      {item('Renomear', <Pencil size={13} />, onRename, { hint: 'duplo clique' })}
      {item('Duplicar cena', <Copy size={13} />, () => sceneCommands.duplicate(scene.id), { hint: 'Ctrl+D' })}
      {item('Mover para cima', <ArrowUp size={13} />, () => sceneCommands.moveBy(scene.id, -1), { disabled: index === 0 })}
      {item('Mover para baixo', <ArrowDown size={13} />, () => sceneCommands.moveBy(scene.id, 1), { disabled: index === count - 1 })}
      {item(scene.enabled ? 'Ocultar do vídeo' : 'Incluir no vídeo', scene.enabled ? <EyeOff size={13} /> : <Eye size={13} />, () => sceneCommands.toggleEnabled(scene.id))}
      <div style={{ height: 1, background: 'var(--line)', margin: '4px 2px' }} />
      {item('Excluir cena', <Trash2 size={13} />, () => sceneCommands.remove(scene.id), { hint: 'Del', danger: true, disabled: count <= 1 })}
    </div>
  );
};

const RenameInput = ({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) => {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      className="input scene-rename"
      autoFocus
      maxLength={60}
      value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
      onBlur={() => finish(value)}
    />
  );
};

/** Thin insertion point between cards: "+" adds a scene exactly there. */
const InsertPoint = ({ index, onAdd, dropActive }: { index: number; onAdd: (index: number) => void; dropActive: boolean }) => (
  <div className={`scene-insert ${dropActive ? 'drop' : ''}`}>
    <button className="scene-insert-btn" title="Adicionar cena aqui" onClick={() => onAdd(index)}>
      <Plus size={11} />
    </button>
  </div>
);

export const SceneList = ({ project, model, activeSceneId }: { project: MotionProject; model: ProjectModel; activeSceneId: string | null }) => {
  const select = useEditor((s) => s.select);
  const current = usePlayback((s) => sceneAtFrame(model.ranges, s.frame)?.id);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: number | null } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const portrait = project.format === 'portrait';
  const rangeById = useMemo(() => new Map(model.ranges.map((r) => [r.id, r])), [model.ranges]);
  const count = project.scenes.length;

  /*
   * Reordering by dragging the grip. Pointer events (not HTML5 drag and drop) so it works
   * the same with mouse, pen and touch. `over` is an insertion position 0..count.
   */
  const startDrag = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setMenuFor(null);
    const y0 = e.clientY;
    let active = false;
    let over: number | null = null;
    const scroller = listRef.current?.closest('.scroll') as HTMLElement | null;
    const insertionAt = (y: number) => {
      const cards = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-scene-id]') ?? [])];
      const i = cards.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      return i < 0 ? cards.length : i;
    };
    const move = (ev: PointerEvent) => {
      if (!active && Math.abs(ev.clientY - y0) < 4) return;
      active = true;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (ev.clientY < r.top + 30) scroller.scrollTop -= 12;
        else if (ev.clientY > r.bottom - 30) scroller.scrollTop += 12;
      }
      over = insertionAt(ev.clientY);
      setDrag({ id, over });
    };
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('keydown', key, true);
      setDrag(null);
      if (!commit || !active || over === null) return;
      const from = useEditor.getState().project?.scenes.findIndex((s) => s.id === id) ?? -1;
      const to = over > from ? over - 1 : over;
      if (from >= 0 && to !== from) sceneCommands.move(id, to);
    };
    const up = () => finish(true);
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      finish(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('keydown', key, true);
  };

  if (count === 0) {
    return (
      <div className="empty-state">
        <b>Nenhuma cena ainda</b>
        <span>Monte o vídeo com cenas da biblioteca — de qualquer família, em qualquer ordem.</span>
        <button className="btn primary" onClick={() => setAdding(0)}>
          <Plus size={14} /> Adicionar primeira cena
        </button>
        {adding !== null && <AddSceneDialog project={project} atIndex={0} onClose={() => setAdding(null)} />}
      </div>
    );
  }

  return (
    <div className={`scene-list ${drag ? 'reordering' : ''}`} ref={listRef}>
      {project.scenes.map((scene, i) => {
        const r = rangeById.get(scene.id);
        const def = sceneTypeOf(model.template, scene.type);
        const showDrop = drag !== null && drag.over === i && drag.id !== scene.id && project.scenes[i - 1]?.id !== drag.id;
        return (
          <div key={scene.id}>
            <InsertPoint index={i} onAdd={setAdding} dropActive={showDrop} />
            <div
              className={`scene-card ${activeSceneId === scene.id ? 'on' : ''} ${current === scene.id && r ? 'playing' : ''} ${scene.enabled ? '' : 'disabled'} ${drag?.id === scene.id ? 'dragging' : ''}`}
              onClick={() => {
                select(scene.id);
                if (r) usePlayback.getState().seek(r.from);
              }}
              onDoubleClick={() => setRenaming(scene.id)}
              data-scene-id={scene.id}
            >
              <span
                className="scene-grip"
                title="Arraste para reordenar"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => startDrag(e, scene.id)}
              >
                <GripVertical size={13} />
              </span>
              <SceneStill project={project} scene={scene} def={def} portrait={portrait} />
              <div className="meta">
                {renaming === scene.id ? (
                  <RenameInput
                    initial={scene.name}
                    onDone={(name) => {
                      setRenaming(null);
                      if (name !== null && name.trim()) sceneCommands.rename(scene.id, name);
                    }}
                  />
                ) : (
                  <b title={scene.name}>
                    <span className="mono" style={{ color: 'var(--accent)', marginRight: 6 }}>
                      {r ? String(r.order + 1).padStart(2, '0') : '––'}
                    </span>
                    {scene.name}
                  </b>
                )}
                <span className="scene-sub">
                  <span className={`type-badge ${scene.name.startsWith(def.name) ? 'quiet' : ''}`} title={def.description}>
                    {def.name}
                  </span>
                  <span title={isDurationEditable(def) ? `Duração ajustável: ${def.duration.min}–${def.duration.max}s` : 'Duração fixa desta cena'}>
                    {scene.duration.toFixed(1)}s
                  </span>
                  {r ? <span className="muted">@ {(r.from / model.fps).toFixed(1)}s</span> : <span className="off-badge">fora do vídeo</span>}
                </span>
              </div>
              <button
                className={`icon-btn sm scene-more ${menuFor === scene.id ? 'active' : ''}`}
                title="Ações da cena"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuFor(menuFor === scene.id ? null : scene.id);
                }}
              >
                <MoreHorizontal size={14} />
              </button>
              {menuFor === scene.id && (
                <SceneMenu
                  scene={scene}
                  index={i}
                  count={count}
                  onRename={() => setRenaming(scene.id)}
                  onClose={() => setMenuFor(null)}
                />
              )}
            </div>
          </div>
        );
      })}
      <InsertPoint index={count} onAdd={setAdding} dropActive={drag !== null && drag.over === count && project.scenes[count - 1]?.id !== drag.id} />
      <button className="btn add-scene" onClick={() => setAdding(count)}>
        <Plus size={14} /> Adicionar cena
      </button>
      {adding !== null && <AddSceneDialog project={project} atIndex={adding} onClose={() => setAdding(null)} />}
    </div>
  );
};
