import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, FileText, Loader2, Monitor, Smartphone, Sparkles, Wand2 } from 'lucide-react';
import type { Format, SpeechCapabilities, SpeechSource, SpeechUpload } from '@lms/shared';
import { SECTION_LABELS, type SpeechPlan, type SpeechRecord } from '@lms/speech';
import { sceneDefinitions } from '@lms/catalog/definitions';
import { api } from '../api/client';
import { useEditor } from '../stores/editor';
import { Dialog } from './ui';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const typeName = (id: string) => sceneDefinitions.find(id)?.name ?? id;

/**
 * "Nova criação → A partir da fala": the speaker's audio/video (transcribed on this
 * computer) or a transcript becomes a composition whose scenes follow what is said. The
 * plan is shown before anything is created — every choice with its reason — and any scene
 * can be swapped for one of its alternatives.
 */
export const SpeechDialog = ({ onClose }: { onClose: () => void }) => {
  const starters = useEditor((s) => s.starters);
  const createFromSpeech = useEditor((s) => s.createFromSpeech);
  const [caps, setCaps] = useState<SpeechCapabilities | null>(null);
  const [upload, setUpload] = useState<SpeechUpload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('pt');
  const [format, setFormat] = useState<Format>('portrait');
  const [themeId, setThemeId] = useState('');
  const [name, setName] = useState('');
  const [force, setForce] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<{ plan: SpeechPlan; score: SpeechRecord['score'] } | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.speechCapabilities().then(setCaps, () => setCaps(null));
  }, []);

  // Poll the local transcription.
  useEffect(() => {
    if (upload?.status !== 'transcribing') return;
    const timer = setInterval(() => {
      void api.speechUpload(upload.id).then((u) => {
        setUpload(u);
        if (u.status === 'transcribed' && u.text) setText(u.text);
        if (u.status === 'error') setError(u.error);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [upload?.id, upload?.status]);

  const source = (f = force): SpeechSource | null => {
    const t = text.trim();
    const src: SpeechSource = {};
    if (upload) src.uploadId = upload.id;
    if (upload?.status === 'transcribed') {
      if (t && t !== (upload.text ?? '').trim()) src.editedText = t;
    } else if (t) src.transcript = t;
    if (!src.transcript && upload?.status !== 'transcribed') return null;
    if (Object.keys(f).length) src.force = f;
    if (themeId) src.themeId = themeId;
    return src;
  };

  const runPlan = async (f = force) => {
    const src = source(f);
    if (!src) return;
    setPlanning(true);
    setError(null);
    try {
      setPlan(await api.planSpeech(src));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPlanning(false);
    }
  };

  const onMedia = async (file: File) => {
    setUploading(true);
    setError(null);
    setPlan(null);
    try {
      const up = await api.uploadSpeech(file);
      setUpload(up);
      if (!name) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
      // The capability check may still be running when a file is dropped right away.
      const c = caps ?? (await api.speechCapabilities().catch(() => null));
      if (c && !caps) setCaps(c);
      if (c?.transcription && !text.trim()) setUpload(await api.transcribeSpeech(up.id, language));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const onTextFile = async (file: File) => {
    setText(await file.text());
    setPlan(null);
  };

  const create = async () => {
    const src = source();
    if (!src) return;
    setBusy(true);
    const ok = await createFromSpeech(src, name.trim() || undefined, format);
    setBusy(false);
    if (ok) onClose();
  };

  const transcribing = upload?.status === 'transcribing';
  const ready = Boolean(source());
  const scenes = plan?.plan.scenes ?? [];
  const total = useMemo(() => (plan ? plan.plan.duration : 0), [plan]);

  return (
    <Dialog
      wide
      title="Nova criação · a partir da fala"
      onClose={onClose}
      footer={
        <>
          <span className="muted" style={{ marginRight: 'auto', fontSize: 11.5 }}>
            Tudo roda neste computador: o áudio não é enviado para nenhum serviço.
          </span>
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!ready || planning || transcribing} onClick={() => void runPlan()}>
            {planning ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />} {plan ? 'Replanejar' : 'Planejar cenas'}
          </button>
          <button className="btn primary" disabled={!plan || busy || planning} onClick={() => void create()}>
            {busy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />} Criar composição
          </button>
        </>
      }
    >
      <div className="speech-grid">
        <div className="speech-source">
          <div
            className="dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void onMedia(f);
            }}
          >
            {uploading ? <Loader2 size={18} className="spin" /> : <AudioLines size={18} />}
            <b>{upload ? upload.originalName : 'Áudio ou vídeo da sua fala'}</b>
            <span>{upload ? `${clock(upload.duration)} · vira a trilha do vídeo` : 'MP3, WAV, M4A, MP4, MOV… — arraste ou clique'}</span>
          </div>
          <input ref={fileRef} type="file" accept="audio/*,video/*" hidden onChange={(e) => e.target.files?.[0] && void onMedia(e.target.files[0])} />

          {upload && (
            <div className="field-row">
              <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: 130 }} disabled={transcribing}>
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="auto">Detectar idioma</option>
              </select>
              <button className="btn sm" disabled={!caps?.transcription || transcribing || upload.status === 'transcribed'} onClick={() => void api.transcribeSpeech(upload.id, language).then(setUpload)}>
                {transcribing ? `Transcrevendo… ${Math.round(upload.progress * 100)}%` : upload.status === 'transcribed' ? 'Transcrito ✓' : 'Transcrever no computador'}
              </button>
            </div>
          )}
          {transcribing && (
            <div className="progress">
              <div style={{ width: `${Math.round(upload!.progress * 100)}%` }} />
            </div>
          )}
          {caps && !caps.transcription && <div className="field-hint">{caps.detail}</div>}

          <div className="field">
            <div className="field-label">
              <span>Transcrição</span>
              <button className="btn ghost sm" onClick={() => textRef.current?.click()}>
                <FileText size={12} /> Abrir .txt / .srt / .vtt
              </button>
            </div>
            <textarea
              className="textarea speech-text"
              placeholder={upload ? 'A transcrição aparece aqui — ou cole a sua (texto, SRT ou VTT).' : 'Cole o texto da fala, um SRT/VTT, ou envie o áudio acima.'}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPlan(null);
              }}
            />
            <div className="field-hint">
              {upload?.status === 'transcribed'
                ? 'Corrija palavras à vontade: os tempos do áudio são mantidos.'
                : upload
                  ? 'Texto colado + áudio: o plano é esticado para a duração do áudio.'
                  : 'Só texto: os tempos são estimados (~2,6 palavras/s). Com o áudio a sincronia é exata.'}
            </div>
          </div>
          <input ref={textRef} type="file" accept=".txt,.srt,.vtt,.json,text/plain" hidden onChange={(e) => e.target.files?.[0] && void onTextFile(e.target.files[0])} />

          <div className="field">
            <div className="field-label">Nome</div>
            <input className="input" value={name} placeholder="Gerado da primeira frase" maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="segmented" style={{ flex: 1 }}>
              <button className={format === 'portrait' ? 'on' : ''} onClick={() => setFormat('portrait')}>
                <Smartphone size={12} style={{ verticalAlign: -2, marginRight: 6 }} />
                9:16
              </button>
              <button className={format === 'landscape' ? 'on' : ''} onClick={() => setFormat('landscape')}>
                <Monitor size={12} style={{ verticalAlign: -2, marginRight: 6 }} />
                16:9
              </button>
            </div>
            <select className="select" value={themeId} onChange={(e) => setThemeId(e.target.value)} style={{ flex: 1 }} title="Paleta">
              <option value="">Paleta padrão</option>
              {starters.map((s) => (
                <option key={s.id} value={s.id}>
                  Paleta {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="speech-plan">
          {!plan && (
            <div className="empty-state">
              <Wand2 size={20} />
              <b>O plano aparece aqui</b>
              <span>Cada ideia da fala vira uma cena escolhida pelo que é dito: números viram gráficos, listas ganham capítulos, “não é X, é Y” vira contraste, nomes são revelados, a chamada final fecha o vídeo.</span>
            </div>
          )}
          {error && <div className="callout danger">{error}</div>}
          {plan && (
            <>
              <div className="speech-plan-head">
                <b>
                  {scenes.length} cenas · {clock(total)}
                </b>
                <span className="badge" title={plan.score.notes.join('\n') || 'Sem observações'}>
                  nota {plan.score.total}
                </span>
              </div>
              {plan.plan.warnings.slice(0, 3).map((w) => (
                <div key={w} className="field-hint">
                  {w}
                </div>
              ))}
              <div className="speech-rows">
                {scenes.map((s, i) => {
                  const idea = plan.plan.ideas[s.idea]!;
                  const options = [s.type, ...s.alternatives.map((a) => a.type)];
                  return (
                    <div key={i} className="speech-row">
                      <div className="speech-row-head">
                        <span className="mono muted">
                          {clock(s.start)}–{clock(s.start + s.duration)}
                        </span>
                        <span className="type-badge quiet">{SECTION_LABELS[idea.section]}</span>
                        <select
                          className="select"
                          value={s.type}
                          disabled={s.part > 0 || planning}
                          title={s.part > 0 ? 'Continuação da ideia anterior' : 'Trocar a cena desta ideia'}
                          onChange={(e) => {
                            const f = { ...force, [String(s.origin)]: e.target.value };
                            setForce(f);
                            void runPlan(f);
                          }}
                        >
                          {options.map((t) => (
                            <option key={t} value={t}>
                              {typeName(t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="speech-quote">“{idea.text}”</div>
                      <div className="field-hint">{s.reasons.slice(1, 3).join(' · ')}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
