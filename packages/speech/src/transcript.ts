import { detectLanguage, norm, type Lang } from './text';

/** One spoken word. `text` has no trailing punctuation; `punct` keeps it (".", ",", "?"…). */
export interface Word {
  text: string;
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  punct: string;
}

export type TranscriptSource = 'words' | 'srt' | 'vtt' | 'text';

export interface Transcript {
  words: Word[];
  /** Seconds covered by the speech (audio length when known). */
  duration: number;
  source: TranscriptSource;
  language: Lang;
  /** False when timings were estimated from plain text (no audio clock). */
  timed: boolean;
}

export class TranscriptError extends Error {}

const PUNCT = /([.,!?;:…]+)["'”’)]*$/;

const splitToken = (raw: string): { text: string; punct: string } | null => {
  const t = raw.trim();
  if (!t) return null;
  const m = PUNCT.exec(t);
  const punct = m ? m[1]!.replace('…', '.').slice(-1) : '';
  const text = (m ? t.slice(0, m.index) : t).replace(/^["'“‘(«]+/, '');
  if (!text) return null;
  return { text, punct };
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Distributes a text over [t0, t1] weighting each word by its length (longer words take longer). */
const spread = (text: string, t0: number, t1: number): Word[] => {
  const toks = text.split(/\s+/).map(splitToken).filter((x): x is { text: string; punct: string } => x !== null);
  if (!toks.length) return [];
  const weights = toks.map((w) => w.text.length + 2 + (w.punct && w.punct !== ',' ? 3 : w.punct ? 1 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = t0;
  return toks.map((w, i) => {
    const d = ((t1 - t0) * weights[i]!) / total;
    const word = { ...w, start: round(t), end: round(t + d * 0.92) };
    t += d;
    return word;
  });
};

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

const TIME = /(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;
const toSeconds = (s: string): number => {
  const m = TIME.exec(s);
  if (!m) return NaN;
  const h = m[1] ? Number(m[1].slice(0, -1)) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]!.padEnd(3, '0')) / 1000;
};

const parseCues = (input: string): { t0: number; t1: number; text: string }[] => {
  const cues: { t0: number; t1: number; text: string }[] = [];
  for (const block of input.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue;
    const [a, b] = lines[at]!.split('-->');
    const t0 = toSeconds(a ?? '');
    const t1 = toSeconds(b ?? '');
    const text = lines
      .slice(at + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\{[^}]+\}/g, '')
      .trim();
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0 && text) cues.push({ t0, t1, text });
  }
  return cues;
};

type RawWord = { w?: string; word?: string; t?: string; text?: string; s?: number; start?: number; e?: number; end?: number; p?: string };

const fromWordJson = (data: unknown): Word[] => {
  const list: unknown = Array.isArray(data) ? data : (data as { words?: unknown; segments?: unknown })?.words ?? (data as { segments?: { words?: unknown[] }[] })?.segments?.flatMap((s) => s.words ?? []);
  if (!Array.isArray(list)) throw new TranscriptError('JSON sem lista de palavras (esperado [{word|w|t, start|s, end|e}])');
  const out: Word[] = [];
  for (const item of list as RawWord[]) {
    const raw = String(item.w ?? item.word ?? item.t ?? item.text ?? '').trim();
    const start = Number(item.s ?? item.start);
    const end = Number(item.e ?? item.end);
    const tok = splitToken(raw + (item.p ?? ''));
    if (!tok || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    out.push({ ...tok, start: round(start), end: round(Math.max(start, end)) });
  }
  return out;
};

/**
 * Plain text with no clock: ~2.6 words/s with pauses after sentences. When the audio
 * length is known (`duration`), the estimate is stretched to fit it.
 */
export const estimateTimings = (text: string, opts: { duration?: number; wordsPerSecond?: number } = {}): Word[] => {
  const wps = opts.wordsPerSecond ?? 2.6;
  const toks = text.split(/\s+/).map(splitToken).filter((x): x is { text: string; punct: string } => x !== null);
  const words: Word[] = [];
  let t = 0.2;
  for (const w of toks) {
    const d = (0.55 + Math.min(w.text.length, 14) * 0.035) / (wps / 2.6) / 1.3;
    words.push({ ...w, start: round(t), end: round(t + d) });
    t += d + (w.punct === '.' || w.punct === '!' || w.punct === '?' ? 0.45 : w.punct ? 0.18 : 0.04);
  }
  const last = words[words.length - 1];
  if (last && opts.duration && opts.duration > 1) {
    const k = (opts.duration - 0.4) / last.end;
    for (const w of words) {
      w.start = round(w.start * k);
      w.end = round(w.end * k);
    }
  }
  return words;
};

/** Accepts word-timed JSON (Whisper and similar), SRT, WebVTT or plain text. */
export const parseTranscript = (input: string, opts: { duration?: number } = {}): Transcript => {
  const text = input.replace(/^﻿/, '').trim();
  if (!text) throw new TranscriptError('Transcrição vazia');
  let words: Word[];
  let source: TranscriptSource;
  if (text.startsWith('[') || text.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new TranscriptError('JSON inválido');
    }
    words = fromWordJson(data);
    source = 'words';
  } else if (/-->/.test(text)) {
    source = /^WEBVTT/.test(text) ? 'vtt' : 'srt';
    words = parseCues(text).flatMap((c) => spread(c.text, c.t0, c.t1));
  } else {
    words = estimateTimings(text, opts);
    source = 'text';
  }
  if (!words.length) throw new TranscriptError('Nenhuma palavra reconhecida na transcrição');
  words.sort((a, b) => a.start - b.start);
  const lastEnd = words[words.length - 1]!.end;
  const duration = round(Math.max(opts.duration ?? 0, lastEnd + 0.6));
  return { words, duration, source, language: detectLanguage(words.map((w) => w.text).join(' ')), timed: source !== 'text' };
};

export const transcriptText = (words: readonly Word[]): string => words.map((w) => w.text + w.punct).join(' ');

/**
 * Keeps the audio clock after the user corrects the transcript: words that still match
 * (LCS on normalized tokens) keep their timings; edited/new words are interpolated
 * between their matched neighbours.
 */
export const realignText = (edited: string, original: readonly Word[]): Word[] => {
  const toks = edited.split(/\s+/).map(splitToken).filter((x): x is { text: string; punct: string } => x !== null);
  const a = toks.map((t) => norm(t.text));
  const b = original.map((w) => norm(w.text));
  const n = a.length;
  const m = b.length;
  // LCS table (transcripts of a reel are a few hundred words: O(n·m) is fine).
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const match: (number | null)[] = new Array(n).fill(null);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) {
      match[i] = j;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  const out: Word[] = toks.map((t, i) => {
    const j = match[i];
    return j !== null && j !== undefined ? { ...t, start: original[j]!.start, end: original[j]!.end } : { ...t, start: NaN, end: NaN };
  });
  // Interpolate runs of unmatched words between their anchors.
  const end = original.length ? original[original.length - 1]!.end : 0;
  for (let i = 0; i < out.length; ) {
    if (Number.isFinite(out[i]!.start)) {
      i++;
      continue;
    }
    let k = i;
    while (k < out.length && !Number.isFinite(out[k]!.start)) k++;
    const t0 = i > 0 ? out[i - 1]!.end : original[0]?.start ?? 0;
    const t1 = k < out.length ? out[k]!.start : Math.max(t0 + 0.4 * (k - i), end);
    const step = (t1 - t0) / (k - i);
    for (let x = i; x < k; x++) {
      out[x]!.start = round(t0 + step * (x - i));
      out[x]!.end = round(t0 + step * (x - i + 0.9));
    }
    i = k;
  }
  return out;
};
