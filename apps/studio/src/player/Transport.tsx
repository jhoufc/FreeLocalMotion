import { Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SceneRange } from '@lms/template-sdk';
import { usePlayback } from '../stores/playback';
import { formatTime, sceneAtFrame } from '../editor/useProjectModel';

export const Transport = ({
  fps,
  durationInFrames,
  ranges,
  sceneNames,
}: {
  fps: number;
  durationInFrames: number;
  ranges: SceneRange[];
  sceneNames: string[];
}) => {
  const frame = usePlayback((s) => s.frame);
  const playing = usePlayback((s) => s.playing);
  const loop = usePlayback((s) => s.loop);
  const { toggle, replay, seek, setLoop } = usePlayback.getState();
  const scene = sceneAtFrame(ranges, frame);
  const prevScene = () => {
    const idx = ranges.findIndex((r) => r.id === scene?.id);
    const cur = ranges[idx];
    if (!cur) return;
    seek(frame > cur.from + 2 || idx === 0 ? cur.from : ranges[idx - 1]!.from);
  };
  const nextScene = () => {
    const idx = ranges.findIndex((r) => r.id === scene?.id);
    const next = ranges[idx + 1];
    seek(next ? next.from : durationInFrames - 1);
  };

  return (
    <div className="transport">
      <button className="icon-btn" onClick={prevScene} title="Cena anterior">
        <SkipBack size={15} />
      </button>
      <button className="icon-btn" onClick={() => seek(Math.max(0, frame - 1))} title="Frame anterior (←)">
        <ChevronLeft size={16} />
      </button>
      <button className="play-btn" onClick={toggle} title="Play / Pause (Espaço)">
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <button className="icon-btn" onClick={() => seek(Math.min(durationInFrames - 1, frame + 1))} title="Próximo frame (→)">
        <ChevronRight size={16} />
      </button>
      <button className="icon-btn" onClick={nextScene} title="Próxima cena">
        <SkipForward size={15} />
      </button>
      <button className="icon-btn" onClick={replay} title="Replay">
        <RotateCcw size={15} />
      </button>
      <button className={`icon-btn ${loop ? 'active' : ''}`} onClick={() => setLoop(!loop)} title="Loop">
        <Repeat size={15} />
      </button>
      <div className="timecode">
        <span>{formatTime(frame, fps)}</span>
        <small>/ {formatTime(durationInFrames - 1, fps)}</small>
        <small>
          F {String(frame).padStart(3, '0')}/{durationInFrames - 1}
        </small>
      </div>
      <div className="spacer" />
      {scene && (
        <span className="muted" style={{ fontSize: 11.5 }}>
          Cena {scene.index + 1} · <b style={{ color: 'var(--text-0)', fontWeight: 600 }}>{sceneNames[scene.index]}</b>
        </span>
      )}
    </div>
  );
};
