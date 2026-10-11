import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { AddSceneDialog } from '../components/AddSceneDialog';
import { Loader2, Maximize, Monitor, Plus, ScanLine, Smartphone } from 'lucide-react';
import { SAFE_AREAS, type MotionProject } from '@lms/shared';
import { TemplateStage, type StageProps } from '@lms/catalog';
import { useEditor } from '../stores/editor';
import { usePlayback } from '../stores/playback';
import { sceneAtFrame, type ProjectModel } from '../editor/useProjectModel';
import { useElementSize } from '../components/ui';
import { Transport } from './Transport';

const ZOOMS = [0.25, 0.33, 0.5, 0.75, 1];

const cssEscape = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'));

export const StagePanel = ({ project, model }: { project: MotionProject; model: ProjectModel }) => {
  const playerRef = useRef<PlayerRef>(null);
  const [viewportRef, viewport] = useElementSize<HTMLDivElement>();
  const selected = useEditor((s) => s.selectedTargetId);
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.update);
  const { zoom, setZoom, loop, showSafeArea, toggleSafeArea, buffering } = usePlayback();
  const [hovered, setHovered] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [fontsLoading, setFontsLoading] = useState(() => document.fonts.status === 'loading');

  const { width: W, height: H, fps, durationInFrames } = model;
  const fitScale = viewport.width > 0 ? Math.min((viewport.width - 56) / W, (viewport.height - 40) / H) : 0.3;
  const scale = Math.max(0.05, zoom === 'fit' ? fitScale : zoom);

  // Same props object shape the renderer receives. Changing it re-renders the current
  // frame without remounting the Player or resetting playback.
  const inputProps = useMemo<StageProps>(() => ({ project, assetBaseUrl: '' }), [project]);

  useEffect(() => {
    const p = playerRef.current;
    const pb = usePlayback.getState();
    pb.setPlayer(p);
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => usePlayback.getState().setFrame(e.detail.frame);
    const onPlay = () => usePlayback.getState().setPlaying(true);
    const onPause = () => usePlayback.getState().setPlaying(false);
    const onWait = () => usePlayback.getState().setBuffering(true);
    const onResume = () => usePlayback.getState().setBuffering(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    p.addEventListener('waiting', onWait);
    p.addEventListener('resume', onResume);
    p.seekTo(Math.min(pb.frame, durationInFrames - 1));
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
      p.removeEventListener('waiting', onWait);
      p.removeEventListener('resume', onResume);
      usePlayback.getState().setPlayer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const done = () => setFontsLoading(false);
    void document.fonts.ready.then(done);
    const onLoading = () => setFontsLoading(true);
    document.fonts.addEventListener('loading', onLoading);
    document.fonts.addEventListener('loadingdone', done);
    return () => {
      document.fonts.removeEventListener('loading', onLoading);
      document.fonts.removeEventListener('loadingdone', done);
    };
  }, []);

  // Keep the playhead inside the composition when scenes get shorter.
  useEffect(() => {
    const { frame, seek } = usePlayback.getState();
    if (frame >= durationInFrames) seek(durationInFrames - 1);
  }, [durationInFrames]);

  const targetFromEvent = useCallback(
    (e: MouseEvent): string | null => {
      let el = e.target as Element | null;
      while (el && el !== e.currentTarget) {
        const id = el.getAttribute?.('data-lms-target');
        if (id && model.targetsById.has(id)) return id;
        el = el.parentElement;
      }
      return null;
    },
    [model.targetsById],
  );

  const onClick = (e: MouseEvent) => {
    const id = targetFromEvent(e);
    if (id) select(id);
    else {
      const scene = sceneAtFrame(model.ranges, usePlayback.getState().frame);
      if (scene) select(scene.id);
    }
  };

  const onMove = (e: MouseEvent) => {
    const id = targetFromEvent(e);
    if (id !== hovered) setHovered(id);
  };

  const outline = (id: string | null, style: 'solid' | 'dashed', color: string) => {
    if (!id || model.targetsById.get(id)?.kind === 'scene') return '';
    return `.stage-canvas [data-lms-target="${cssEscape(id)}"]{outline:${(1.5 / scale).toFixed(2)}px ${style} ${color};outline-offset:${(5 / scale).toFixed(2)}px;}`;
  };

  const safe = SAFE_AREAS[project.format];
  const canvasW = Math.round(W * scale);
  const canvasH = Math.round(H * scale);

  return (
    <div className="stage panel area-stage" style={{ background: undefined }}>
      <div className="stage-toolbar">
        <div className="segmented" style={{ width: 236 }}>
          <button className={project.format === 'portrait' ? 'on' : ''} onClick={() => update(['format'], 'portrait')} title="Vertical 1080×1920">
            <Smartphone size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
            9:16
          </button>
          <button className={project.format === 'landscape' ? 'on' : ''} onClick={() => update(['format'], 'landscape')} title="Horizontal 1920×1080">
            <Monitor size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
            16:9
          </button>
        </div>
        <span className="muted mono" style={{ fontSize: 11 }}>
          {W}×{H} · {fps} fps · {(durationInFrames / fps).toFixed(2)}s
        </span>
        <div className="spacer" />
        <button className={`icon-btn ${showSafeArea ? 'active' : ''}`} onClick={toggleSafeArea} title="Guias de margem segura">
          <ScanLine size={15} />
        </button>
        <button className={`icon-btn ${zoom === 'fit' ? 'active' : ''}`} onClick={() => setZoom('fit')} title="Ajustar à tela">
          <Maximize size={15} />
        </button>
        <select className="select" style={{ width: 92 }} value={zoom === 'fit' ? 'fit' : String(zoom)} onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>
          <option value="fit">Ajustar ({Math.round(fitScale * 100)}%)</option>
          {ZOOMS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
      </div>

      <div className="stage-viewport" ref={viewportRef}>
        {(buffering || fontsLoading) && (
          <div className="loading-chip">
            <Loader2 size={13} className="spin" /> Carregando assets…
          </div>
        )}
        <div className="stage-canvas" style={{ width: canvasW, height: canvasH }} onClick={onClick} onMouseMove={onMove} onMouseLeave={() => setHovered(null)}>
          <style>{outline(hovered !== selected ? hovered : null, 'dashed', 'rgba(255,255,255,0.7)') + outline(selected, 'solid', '#B8FF35')}</style>
          <Player
            ref={playerRef}
            component={TemplateStage}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            compositionWidth={W}
            compositionHeight={H}
            fps={fps}
            style={{ width: canvasW, height: canvasH }}
            controls={false}
            loop={loop}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            moveToBeginningWhenEnded={false}
            showPosterWhenPaused={false}
            errorFallback={({ error }) => (
              <div style={{ color: '#ff5c6c', padding: 24, fontSize: 14 / scale, fontFamily: 'monospace' }}>Erro na composição: {error.message}</div>
            )}
            acknowledgeRemotionLicense
          />
          {model.ranges.length === 0 && (
            <div className="stage-empty">
              <div>
                <b>{project.scenes.length ? 'Nenhuma cena ativa' : 'Composição vazia'}</b>
                <span>{project.scenes.length ? 'Inclua uma cena no vídeo ou adicione uma nova da biblioteca.' : 'Escolha cenas na biblioteca para montar o vídeo. A duração acompanha as cenas adicionadas.'}</span>
                <button className="btn primary" onClick={() => setAdding(true)}>
                  <Plus size={14} /> {project.scenes.length ? 'Adicionar cena' : 'Adicionar primeira cena'}
                </button>
              </div>
            </div>
          )}
          {showSafeArea && (
            <>
              <div
                className="safe-area"
                style={{ left: `${safe.left * 100}%`, right: `${safe.right * 100}%`, top: `${safe.top * 100}%`, bottom: `${safe.bottom * 100}%` }}
              >
                <span>margem segura {project.format === 'portrait' ? 'Reels/Shorts' : 'título 16:9'}</span>
              </div>
              <div className="center-guides" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
            </>
          )}
        </div>
      </div>

      <Transport fps={fps} durationInFrames={durationInFrames} ranges={model.ranges} sceneNames={project.scenes.map((s) => s.name)} />
      {adding && <AddSceneDialog project={project} atIndex={project.scenes.length} onClose={() => setAdding(false)} />}
    </div>
  );
};
