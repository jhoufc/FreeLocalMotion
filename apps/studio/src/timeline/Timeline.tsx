import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Eye, EyeOff, ZoomIn, ZoomOut, Clapperboard } from 'lucide-react';
import { getAtPath, type MotionProject } from '@lms/shared';
import type { TimelineLayer } from '@lms/template-sdk';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';
import { formatTime, sceneAtFrame, type ProjectModel } from '../editor/useProjectModel';
import { useElementSize } from '../components/ui';
import { KindIcon } from '../panels/KindIcon';

type Row = { type: 'group'; id: string; label: string } | { type: 'layer'; layer: TimelineLayer };

const RULER_H = 26;
const SCENES_H = 34;
const ROW_H = 26;
const GROUP_H = 24;

/** Isolated so 30-60 Hz frame updates only re-render this line. */
const Playhead = ({ px }: { px: number }) => {
  const frame = usePlayback((s) => s.frame);
  return <div className="tl-playhead" style={{ left: frame * px }} />;
};

const Tooltip = ({ text, x, y }: { text: string; x: number; y: number }) => (
  <div className="tl-tooltip" style={{ left: x + 12, top: y - 28 }}>
    {text}
  </div>
);

export const Timeline = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const { timeline, fps, durationInFrames } = model;
  const selected = useEditor((s) => s.selectedTargetId);
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.update);
  const [scrollRef, size] = useElementSize<HTMLDivElement>();
  const labelsRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState<'scene' | 'all'>('scene');
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const currentScene = usePlayback((s) => sceneAtFrame(model.ranges, s.frame)?.id);

  const fitPx = size.width > 0 ? (size.width - 24) / durationInFrames : 2;
  const px = fitPx * zoom;
  const contentW = Math.max(size.width, durationInFrames * px + 24);

  const focusSceneId = model.targetsById.get(selected)?.sceneId ?? currentScene;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const scene of timeline.scenes) {
      if (filter === 'scene' && scene.id !== focusSceneId) continue;
      out.push({ type: 'group', id: `g-${scene.id}`, label: `${String(scene.index + 1).padStart(2, '0')} · ${scene.label}` });
      for (const layer of timeline.layers) if (layer.sceneId === scene.id) out.push({ type: 'layer', layer });
    }
    const globals = timeline.layers.filter((l) => l.sceneId === null);
    if (globals.length) {
      out.push({ type: 'group', id: 'g-global', label: 'Global' });
      for (const layer of globals) out.push({ type: 'layer', layer });
    }
    return out;
  }, [timeline, filter, focusSceneId]);

  const frameFromClientX = (clientX: number) => {
    const el = scrollRef.current!;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    return Math.max(0, Math.min(durationInFrames - 1, Math.round(x / px)));
  };

  /* ---------- scrubbing ---------- */
  const startScrub = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    const pb = usePlayback.getState();
    pb.player?.pause();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pb.seek(frameFromClientX(e.clientX));
    const move = (ev: PointerEvent) => usePlayback.getState().seek(frameFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---------- bounded timing drags ---------- */
  const startDrag = (
    e: RPointerEvent,
    id: string,
    opts: { path: readonly (string | number)[]; min: number; max: number; step: number; start: number; label: (v: number) => string },
  ) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const x0 = e.clientX;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dxSeconds = (ev.clientX - x0) / px / fps;
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      moved = true;
      setDragging(id);
      const raw = opts.start + dxSeconds;
      const v = Math.round(Math.min(opts.max, Math.max(opts.min, raw)) / opts.step) * opts.step;
      update(opts.path, Number(v.toFixed(3)), { coalesce: true });
      setTip({ text: opts.label(v), x: ev.clientX, y: ev.clientY });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(null);
      setTip(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---------- follow playhead while playing ---------- */
  useEffect(
    () =>
      usePlayback.subscribe((s) => {
        const el = scrollRef.current;
        if (!el || !s.playing) return;
        const x = s.frame * px;
        if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - 40);
      }),
    [px, scrollRef],
  );

  /* ---------- ruler ticks ---------- */
  const seconds = durationInFrames / fps;
  const stepS = px * fps > 160 ? 0.5 : px * fps > 60 ? 1 : 2;
  const ticks: { x: number; label: string | null; major: boolean }[] = [];
  for (let s = 0; s <= seconds + 1e-6; s += stepS / 2) {
    const major = Math.abs(s / stepS - Math.round(s / stepS)) < 1e-6;
    ticks.push({ x: s * fps * px, label: major ? `${s.toFixed(stepS < 1 ? 1 : 0)}s` : null, major });
  }

  const visibleFor = (layer: TimelineLayer) => {
    const t = model.targetsById.get(layer.targetId);
    return t?.visibilityPath && layer.targetId === layer.id ? Boolean(getAtPath(project, t.visibilityPath)) : !layer.hidden;
  };

  return (
    <section className="timeline area-timeline">
      <div className="tl-toolbar">
        <b style={{ fontWeight: 600 }}>Timeline</b>
        <span className="muted mono" style={{ fontSize: 11 }}>
          {timeline.scenes.length} cenas · {timeline.layers.length} camadas · {formatTime(durationInFrames, fps)}
        </span>
        <div className="spacer" />
        <div className="segmented" style={{ width: 190 }}>
          <button className={filter === 'scene' ? 'on' : ''} onClick={() => setFilter('scene')}>
            Cena atual
          </button>
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            Todas
          </button>
        </div>
        <button className="icon-btn sm" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} title="Diminuir zoom">
          <ZoomOut size={14} />
        </button>
        <input
          className="range"
          style={{ width: 110, ['--fill' as string]: `${((zoom - 1) / 11) * 100}%` }}
          type="range"
          min={1}
          max={12}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          title="Zoom temporal"
        />
        <button className="icon-btn sm" onClick={() => setZoom((z) => Math.min(12, z * 1.5))} title="Aumentar zoom">
          <ZoomIn size={14} />
        </button>
      </div>

      <div className="tl-body">
        {/* Labels column (scroll-synced) */}
        <div className="tl-labels">
          <div className="tl-labels-inner" ref={labelsRef}>
            <div className="tl-label ruler-spacer" style={{ height: RULER_H, borderBottom: '1px solid var(--line)' }} />
            <div className="tl-label scenes-label">
              <Clapperboard size={13} /> Cenas
            </div>
            {rows.map((row) =>
              row.type === 'group' ? (
                <div key={row.id} className="tl-label group">
                  {row.label}
                </div>
              ) : (
                (() => {
                  const l = row.layer;
                  const t = model.targetsById.get(l.targetId);
                  const visible = visibleFor(l);
                  const canToggle = Boolean(t?.visibilityPath && l.targetId === l.id);
                  return (
                    <div key={l.id} className={`tl-label ${selected === l.targetId ? 'on' : ''}`} style={{ opacity: visible ? 1 : 0.5 }} onClick={() => select(l.targetId)}>
                      <span className={`kind-${l.kind === 'background' ? 'scene' : l.kind}`}>
                        <KindIcon kind={l.kind} />
                      </span>
                      <span className="name">{l.label}</span>
                      {canToggle && (
                        <button
                          className="icon-btn sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            update(t!.visibilityPath!, !visible);
                          }}
                        >
                          {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      )}
                    </div>
                  );
                })()
              ),
            )}
          </div>
        </div>

        {/* Tracks */}
        <div
          className="tl-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            if (labelsRef.current) labelsRef.current.style.transform = `translateY(${-e.currentTarget.scrollTop}px)`;
          }}
        >
          <div className="tl-content" style={{ width: contentW }}>
            <div className="tl-ruler" onPointerDown={startScrub}>
              {ticks.map((t, i) => (
                <div key={i}>
                  <div className="tl-tick" style={{ left: t.x, height: t.major ? 10 : 5 }} />
                  {t.label && (
                    <div className="tl-tick-label" style={{ left: t.x }}>
                      {t.label}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="tl-row scenes" onPointerDown={startScrub}>
              {timeline.scenes.length === 0 && <div className="tl-empty">Timeline vazia — adicione cenas pela aba Cenas ou pelo preview.</div>}
              {timeline.scenes.map((s) => (
                <div
                  key={s.id}
                  className={`tl-scene ${focusSceneId === s.id ? 'on' : ''}`}
                  style={{ left: s.from * px + 1, width: Math.max(4, s.durationInFrames * px - 2) }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    select(s.targetId);
                    usePlayback.getState().seek(s.from);
                  }}
                >
                  <span className="idx">{String(s.index + 1).padStart(2, '0')}</span>
                  <span className="tl-scene-name" title={s.typeLabel && s.typeLabel !== s.label ? `${s.label} · ${s.typeLabel}` : s.label}>
                    {s.label}
                  </span>
                  {s.typeLabel && !s.label.startsWith(s.typeLabel) && <span className="tl-scene-type">{s.typeLabel}</span>}
                  <span className="dur">{(s.durationInFrames / fps).toFixed(1)}s</span>
                  {s.duration && (
                    <div
                      className="tl-handle"
                      title="Arraste para ajustar a duração (limitada pelo template)"
                      onPointerDown={(e) => {
                        const h = s.duration!;
                        startDrag(e, s.id, {
                          path: h.path,
                          min: h.min,
                          max: h.max,
                          step: 0.1,
                          start: Number(getAtPath(project, h.path)),
                          label: (v) => `${v.toFixed(1)}s  (${h.min}–${h.max}s)`,
                        });
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {rows.map((row) =>
              row.type === 'group' ? (
                <div key={row.id} className="tl-row group" onPointerDown={startScrub} />
              ) : (
                <div key={row.layer.id} className="tl-row" onPointerDown={startScrub}>
                  {row.layer.clips.map((c, i) => {
                    const l = row.layer;
                    const delay = l.delay;
                    return (
                      <div
                        key={i}
                        className={`tl-clip ${l.kind} ${selected === l.targetId ? 'on' : ''} ${visibleFor(l) ? '' : 'hidden-el'} ${delay ? 'draggable' : ''} ${dragging === l.id ? 'dragging' : ''}`}
                        style={{ left: c.from * px, width: Math.max(3, c.durationInFrames * px) }}
                        title={delay ? 'Clique para selecionar · arraste para ajustar o atraso de entrada' : 'Clique para selecionar'}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          select(l.targetId);
                          if (delay) {
                            startDrag(e, l.id, {
                              path: delay.path,
                              min: delay.min,
                              max: delay.max,
                              step: 0.01,
                              start: Number(getAtPath(project, delay.path)),
                              label: (v) => `atraso ${v.toFixed(2)}s`,
                            });
                          }
                        }}
                      >
                        {c.durationInFrames * px > 60 ? c.label ?? l.label : ''}
                      </div>
                    );
                  })}
                  {row.layer.markers.map((m, i) => (
                    <div key={i} className={`tl-marker ${m.kind}`} style={{ left: m.frame * px }} title={m.label} />
                  ))}
                </div>
              ),
            )}

            {timeline.scenes.slice(1).map((s) => (
              <div key={s.id} className="tl-scene-boundary" style={{ left: s.from * px }} />
            ))}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 0, height: RULER_H + SCENES_H + rows.reduce((a, r) => a + (r.type === 'group' ? GROUP_H : ROW_H), 0) }} />
            <Playhead px={px} />
          </div>
        </div>
      </div>
      {tip && <Tooltip {...tip} />}
    </section>
  );
};
