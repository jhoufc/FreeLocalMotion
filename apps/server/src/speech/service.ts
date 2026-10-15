import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createId, type SpeechCapabilities, type SpeechSource, type SpeechUpload } from '@lms/shared';
import { parseTranscript, realignText, transcriptText, type Transcript } from '@lms/speech';
import { exists, readJson, safeJoin, writeJsonAtomic } from '../storage/files';
import { HttpError } from '../projects/store';

export interface SpeechConfig {
  /** Where uploads, extracted audio and transcriptions live (`speech/<id>/`). */
  dir: string;
  python: string;
  /** faster-whisper model (tiny, base, small, medium, large-v3). */
  model: string;
  /** Spoken language ("pt", "en") or "auto". */
  language: string;
  ffmpeg: string;
  ffprobe: string;
  /** Script that runs faster-whisper. */
  script: string;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const run = (cmd: string, args: string[], onLine?: (line: string) => void): Promise<RunResult> =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch (err) {
      resolve({ code: -1, stdout, stderr: String(err) });
      return;
    }
    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString();
      stdout += s;
      if (onLine) for (const line of s.split(/\r?\n/)) if (line.trim()) onLine(line.trim());
    });
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: stderr + String(err) }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });

const META = 'upload.json';
const SOURCE = 'source';
/** 16 kHz mono for the transcriber. */
const WAV = 'speech.wav';
/** AAC track that becomes the project soundtrack. */
export const SPEECH_AUDIO = 'speech-audio.m4a';
const WORDS = 'words.json';

/**
 * Speech uploads: audio or video in, the audio track out (ffmpeg), transcribed locally
 * with word timings (faster-whisper in a child process). Nothing leaves the machine.
 */
export class SpeechService {
  private readonly uploads = new Map<string, SpeechUpload>();
  private caps: Promise<SpeechCapabilities> | null = null;

  constructor(readonly cfg: SpeechConfig) {}

  private dir(id: string) {
    if (!/^s-[a-z0-9-]{6,64}$/.test(id)) throw new HttpError(400, 'Invalid speech upload id');
    return safeJoin(this.cfg.dir, id);
  }

  capabilities(): Promise<SpeechCapabilities> {
    this.caps ??= (async () => {
      const ff = await run(this.cfg.ffmpeg, ['-version']);
      const py = await run(this.cfg.python, ['-c', 'import faster_whisper; print(faster_whisper.__version__)']);
      const transcription = py.code === 0;
      return {
        media: ff.code === 0,
        transcription,
        model: this.cfg.model,
        detail: transcription
          ? `faster-whisper ${py.stdout.trim()} (${this.cfg.model})`
          : `Transcrição local indisponível: instale com "pip install faster-whisper" (python: ${this.cfg.python}). Você ainda pode colar a transcrição.`,
      };
    })();
    return this.caps;
  }

  /** Stores an audio/video file and extracts its audio track. */
  async upload(data: Buffer, originalName: string): Promise<SpeechUpload> {
    const caps = await this.capabilities();
    if (!caps.media) throw new HttpError(503, 'ffmpeg não encontrado: necessário para ler áudio/vídeo.');
    const id = createId('s-');
    const dir = this.dir(id);
    await fs.mkdir(dir, { recursive: true });
    const ext = (/\.([a-z0-9]{2,5})$/i.exec(originalName)?.[1] ?? 'bin').toLowerCase();
    const source = path.join(dir, `${SOURCE}.${ext}`);
    await fs.writeFile(source, data);
    const wav = await run(this.cfg.ffmpeg, ['-y', '-v', 'error', '-i', source, '-vn', '-ac', '1', '-ar', '16000', path.join(dir, WAV)]);
    const aac = wav.code === 0 ? await run(this.cfg.ffmpeg, ['-y', '-v', 'error', '-i', source, '-vn', '-c:a', 'aac', '-b:a', '160k', path.join(dir, SPEECH_AUDIO)]) : wav;
    if (wav.code !== 0 || aac.code !== 0) {
      await fs.rm(dir, { recursive: true, force: true });
      throw new HttpError(415, `Não foi possível ler o áudio deste arquivo (${(wav.stderr || aac.stderr).split('\n')[0]?.slice(0, 160) ?? 'erro do ffmpeg'}).`);
    }
    await fs.rm(source, { force: true }); // keep only the audio we need
    const probe = await run(this.cfg.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path.join(dir, SPEECH_AUDIO)]);
    const duration = Number(probe.stdout.trim());
    if (!Number.isFinite(duration) || duration < 1) throw new HttpError(422, 'Áudio vazio ou curto demais.');
    if (duration > 600) throw new HttpError(422, 'Áudio longo demais (máximo 10 minutos).');
    const up: SpeechUpload = { id, originalName: originalName.slice(0, 200), duration: Math.round(duration * 1000) / 1000, status: 'uploaded', progress: 0, error: null, text: null, language: null };
    await this.save(up);
    return up;
  }

  private async save(up: SpeechUpload) {
    this.uploads.set(up.id, up);
    await writeJsonAtomic(path.join(this.dir(up.id), META), { ...up, status: up.status === 'transcribing' ? 'uploaded' : up.status });
  }

  async get(id: string): Promise<SpeechUpload> {
    const live = this.uploads.get(id);
    if (live) return live;
    const file = path.join(this.dir(id), META);
    if (!(await exists(file))) throw new HttpError(404, 'Áudio não encontrado');
    const up = (await readJson(file)) as SpeechUpload;
    this.uploads.set(id, up);
    return up;
  }

  /** Starts (or returns) the local transcription of an upload. */
  async transcribe(id: string, language?: string): Promise<SpeechUpload> {
    const up = await this.get(id);
    if (up.status === 'transcribing' || up.status === 'transcribed') return up;
    const caps = await this.capabilities();
    if (!caps.transcription) throw new HttpError(503, caps.detail ?? 'Transcrição indisponível');
    const lang = language && /^(auto|[a-z]{2})$/.test(language) ? language : this.cfg.language;
    Object.assign(up, { status: 'transcribing', progress: 0, error: null });
    const dir = this.dir(id);
    void run(this.cfg.python, [this.cfg.script, path.join(dir, WAV), path.join(dir, WORDS), this.cfg.model, lang], (line) => {
      const m = /^PROGRESS ([\d.]+)/.exec(line);
      if (m) up.progress = Math.min(0.99, Number(m[1]));
    }).then(async (r) => {
      if (r.code !== 0 || !(await exists(path.join(dir, WORDS)))) {
        Object.assign(up, { status: 'error', error: `Falha na transcrição: ${r.stderr.trim().split('\n').pop()?.slice(0, 240) ?? r.code}` });
      } else {
        const out = (await readJson(path.join(dir, WORDS))) as { language: string; words: unknown[] };
        const t = parseTranscript(JSON.stringify(out.words), { duration: up.duration });
        Object.assign(up, { status: 'transcribed', progress: 1, language: out.language, text: transcriptText(t.words) });
      }
      await this.save(up);
    });
    return up;
  }

  /** Path of the AAC soundtrack of an upload. */
  audioPath(id: string) {
    return path.join(this.dir(id), SPEECH_AUDIO);
  }

  /**
   * The transcript to plan from. A pasted transcript wins (stretched to the audio length
   * when there is an upload); otherwise the local transcription. User corrections keep
   * the audio clock (realigned word by word).
   */
  async resolve(src: SpeechSource): Promise<{ transcript: Transcript; upload: SpeechUpload | null }> {
    const upload = src.uploadId ? await this.get(src.uploadId) : null;
    let transcript: Transcript;
    if (src.transcript) {
      transcript = parseTranscript(src.transcript, upload ? { duration: upload.duration } : {});
    } else {
      if (!upload || upload.status !== 'transcribed') throw new HttpError(409, 'A transcrição do áudio ainda não terminou.');
      const out = (await readJson(path.join(this.dir(upload.id), WORDS))) as { words: unknown[] };
      transcript = parseTranscript(JSON.stringify(out.words), { duration: upload.duration });
    }
    if (src.editedText && transcript.timed) {
      const words = realignText(src.editedText, transcript.words);
      if (words.length) transcript = { ...transcript, words };
    } else if (src.editedText) {
      transcript = parseTranscript(src.editedText, upload ? { duration: upload.duration } : {});
    }
    if (upload) transcript = { ...transcript, duration: Math.max(transcript.duration, upload.duration) };
    return { transcript, upload };
  }
}
