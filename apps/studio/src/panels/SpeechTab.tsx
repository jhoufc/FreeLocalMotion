import { useMemo } from 'react';
import { AudioLines } from 'lucide-react';
import type { MotionProject } from '@lms/shared';
import { SECTION_LABELS } from '@lms/speech';
import { refillScene, sceneDefinitions } from '@lms/catalog/definitions';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';
import type { ProjectModel } from '../editor/useProjectModel';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Projects created from speech: every idea, the scene that tells it and why — and a way
 * to swap it for another scene filled from the same words (one undo step).
 */
export const SpeechTab = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const record = useEditor((s) => s.speech);
  const select = useEditor((s) => s.select);
  const swapScene = useEditor((s) => s.swapScene);
  const seek = usePlayback((s) => s.seek);

  const rows = useMemo(() => {
    if (!record) return [];
    return record.plan.scenes.map((planned, i) => {
      const prefix = `s${String(i + 1).padStart(2, '0')}-`;
      const scene = project.scenes.find((s) => s.id.startsWith(prefix)) ?? null;
      const range = scene ? model.ranges.find((r) => r.id === scene.id) : undefined;
      // Every scene type that the same words can fill and whose limits hold this duration.
      const options = scene
        ? sceneDefinitions
            .list()
            .filter((t) => scene.duration >= t.duration.min && scene.duration <= t.duration.max)
            .map((t) => ({ type: t.id, name: t.name, fill: t.id === scene.type ? null : refillScene(record.plan, i, t.id) }))
            .filter((o) => o.type === scene.type || o.fill)
        : [];
      const ranked = new Map([planned.type, ...planned.alternatives.map((a) => a.type)].map((t, k) => [t, k]));
      options.sort((a, b) => (ranked.get(a.type) ?? 99) - (ranked.get(b.type) ?? 99) || a.name.localeCompare(b.name));
      return { i, planned, idea: record.plan.ideas[planned.idea]!, scene, range, options };
    });
  }, [record, project.scenes, model.ranges]);

  if (!record) {
    return (
      <div className="empty-state">
        <AudioLines size={20} />
        <b>Projeto sem fala</b>
        <span>Crie em “Nova criação → A partir da fala” para planejar as cenas pelo que você diz.</span>
      </div>
    );
  }

  return (
    <div className="scroll">
      <div className="section-title">
        <span>Plano da fala</span>
        <span className="mono" style={{ letterSpacing: 0 }}>
          nota {record.score.total} · {record.transcript.timed ? 'sincronizado' : 'tempo estimado'}
        </span>
      </div>
      {rows.map(({ i, planned, idea, scene, range, options }) => {
        const changed = scene && scene.type !== planned.type;
        return (
          <div
            key={i}
            className={`speech-row ${scene ? '' : 'missing'}`}
            onClick={() => {
              if (!scene) return;
              select(scene.id);
              if (range) seek(range.from);
            }}
          >
            <div className="speech-row-head">
              <span className="mono muted">{clock(planned.start)}</span>
              <span className="type-badge quiet">{SECTION_LABELS[idea.section]}</span>
              {scene ? (
                <select
                  className="select"
                  value={scene.type}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const o = options.find((x) => x.type === e.target.value);
                    if (o?.fill) swapScene(scene.id, o.type, o.fill);
                  }}
                >
                  {options.map((o) => (
                    <option key={o.type} value={o.type}>
                      {o.name}
                      {o.type === planned.type ? ' · sugerida' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="muted">cena removida</span>
              )}
            </div>
            <div className="speech-quote">“{idea.text}”</div>
            <div className="field-hint">{changed ? 'Trocada por você.' : planned.reasons.slice(1, 3).join(' · ')}</div>
          </div>
        );
      })}
    </div>
  );
};
