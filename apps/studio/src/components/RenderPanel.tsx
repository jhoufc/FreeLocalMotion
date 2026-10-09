import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, FolderOpen, Loader2, X } from 'lucide-react';
import { FORMAT_SPECS, type Format, type RenderJob } from '@lms/shared';
import { api } from '../api/client';
import { useEditor } from '../stores/editor';
import { useDismiss } from './ui';

const STAGE_LABEL: Record<RenderJob['stage'], string> = {
  queued: 'Na fila',
  validating: 'Validando projeto',
  snapshot: 'Congelando snapshot',
  assets: 'Verificando assets',
  bundling: 'Preparando composição (bundle)',
  composition: 'Resolvendo composição',
  rendering: 'Renderizando frames',
  encoding: 'Codificando H.264',
  saving: 'Salvando MP4',
  done: 'Concluído',
};
const STATUS_LABEL: Record<RenderJob['status'], string> = {
  queued: 'na fila',
  running: 'renderizando',
  succeeded: 'pronto',
  failed: 'falhou',
  cancelled: 'cancelado',
};

const active = (j: RenderJob) => j.status === 'queued' || j.status === 'running';

export const RenderButton = () => {
  const project = useEditor((s) => s.project);
  const save = useEditor((s) => s.save);
  const toast = useEditor((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<'current' | Format | 'both'>('current');
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const btnRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, btnRef, popRef);

  const refresh = useCallback(async () => {
    try {
      setJobs(await api.renders());
    } catch {
      /* server offline: keep last state */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const running = jobs.some(active);
  useEffect(() => {
    if (!running && !open) return;
    const id = setInterval(() => void refresh(), running ? 600 : 3000);
    return () => clearInterval(id);
  }, [running, open, refresh]);

  // Notify when a job finishes.
  const prev = useRef<Map<string, RenderJob['status']>>(new Map());
  useEffect(() => {
    for (const j of jobs) {
      const before = prev.current.get(j.id);
      if (before && before !== j.status) {
        if (j.status === 'succeeded') toast('success', `MP4 pronto: ${j.outputFileName}`);
        if (j.status === 'failed') toast('error', `Render falhou: ${j.error ?? ''}`);
      }
      prev.current.set(j.id, j.status);
    }
  }, [jobs, toast]);

  const start = async () => {
    if (!project) return;
    await save();
    const formats: Format[] = choice === 'both' ? ['portrait', 'landscape'] : [choice === 'current' ? project.format : choice];
    try {
      for (const format of formats) await api.render({ projectId: project.id, format, project });
      await refresh();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : String(err));
    }
  };

  const activeJob = jobs.find((j) => j.status === 'running');

  return (
    <>
      <div ref={btnRef}>
        <button className="btn primary" onClick={() => setOpen((o) => !o)}>
          {activeJob ? <Loader2 size={14} className="spin" /> : <Clapperboard size={14} />}
          {activeJob ? <span className="render-btn-progress">{Math.round(activeJob.progress * 100)}%</span> : 'Renderizar MP4'}
        </button>
      </div>
      {open && (
        <div className="popover render-pop" ref={popRef}>
          <div className="head">
            <b>Exportar MP4</b>
            <span className="muted">H.264 · yuv420p · CRF 16 · Full HD · {project?.fps ?? 30} fps · AAC quando houver trilha</span>
            <div className="segmented">
              <button className={choice === 'current' ? 'on' : ''} onClick={() => setChoice('current')}>
                Atual ({project?.format === 'portrait' ? '9:16' : '16:9'})
              </button>
              <button className={choice === 'portrait' ? 'on' : ''} onClick={() => setChoice('portrait')}>
                9:16
              </button>
              <button className={choice === 'landscape' ? 'on' : ''} onClick={() => setChoice('landscape')}>
                16:9
              </button>
              <button className={choice === 'both' ? 'on' : ''} onClick={() => setChoice('both')}>
                Ambos
              </button>
            </div>
            <button className="btn primary" style={{ justifyContent: 'center' }} onClick={() => void start()} disabled={!project}>
              <Clapperboard size={14} /> Iniciar renderização
            </button>
          </div>
          <div className="jobs">
            {jobs.length === 0 && <div className="empty">Nenhuma exportação ainda.</div>}
            {jobs.slice(0, 20).map((j) => (
              <div key={j.id} className="job">
                <div className="job-top">
                  <b title={j.projectName}>{j.projectName}</b>
                  <span className="tag">
                    {FORMAT_SPECS[j.format].ratio} · {j.width}×{j.height}
                  </span>
                  <span className={`badge ${j.status}`}>{STATUS_LABEL[j.status]}</span>
                </div>
                {active(j) && (
                  <>
                    <div className="progress">
                      <div style={{ width: `${Math.round(j.progress * 100)}%` }} />
                    </div>
                    <div className="field-row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">
                        {STAGE_LABEL[j.stage]}
                        {j.stage === 'rendering' || j.stage === 'encoding' ? ` · ${j.renderedFrames}/${j.durationInFrames} frames` : ''}
                      </span>
                      <span className="mono">{Math.round(j.progress * 100)}%</span>
                    </div>
                    <button className="btn sm danger" style={{ justifySelf: 'start' }} onClick={() => void api.cancelRender(j.id).then(refresh)}>
                      <X size={12} /> Cancelar
                    </button>
                  </>
                )}
                {j.status === 'failed' && <div className="err">{j.error}</div>}
                {j.status === 'succeeded' && (
                  <>
                    <div className="path">{j.outputPath}</div>
                    <div className="field-row">
                      <a className="btn sm primary" href={api.renderFileUrl(j.id)}>
                        <Download size={12} /> Baixar MP4
                      </a>
                      <a className="btn sm" href={api.renderFileUrl(j.id, false)} target="_blank" rel="noreferrer">
                        Assistir
                      </a>
                      <button className="btn sm" onClick={() => void api.revealRender(j.id)}>
                        <FolderOpen size={12} /> Mostrar na pasta
                      </button>
                      <span className="muted mono" style={{ marginLeft: 'auto', fontSize: 10.5 }}>
                        {((j.outputSize ?? 0) / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
