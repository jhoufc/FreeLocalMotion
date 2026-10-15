import { NUMBER_WORDS, norm } from './text';
import type { Word } from './transcript';

/** A run of words that carries one idea: the unit that becomes one scene. */
export interface IdeaSpan {
  words: Word[];
  text: string;
  /** First word start / last word end (seconds). */
  start: number;
  end: number;
}

export interface GroupOptions {
  /** Sentences longer than this split at the comma nearest the middle (seconds). */
  maxSeconds?: number;
  /** Ideas shorter than this join a neighbour (scene types need ~3 s to read). */
  minSeconds?: number;
  /** Hard ceiling: longer ideas are cut at the best pause (scene types top out at 6–12 s). */
  hardMaxSeconds?: number;
}

const NUMERIC = new RegExp(`\\d|%|\\b(${Object.keys(NUMBER_WORDS).filter((w) => !/^(um|uma|one|zero|nenhum|nenhuma)$/.test(w)).join('|')})\\b`);
const OPENS_CONTRAST = /^(acabou|acabaram|chega de|esquece|antes|nao (e|sao|foi|era)|before|it'?s not|forget)\b/;
const CLOSES_CONTRAST = /^(agora|hoje|so que|mas|e sim|e so|sao|now|today|but|it'?s)\b/;

const STRONG = /\bnome\b.*\b(e|se chama)\b|\d|%|\b(segue|siga|comenta|salva|link|conheca|apresento|chegou|olha isso|follow|comment|meet)\b/;

/** Opens an item of a list ("A terceira é…", "Erro número dois…", "Por último…"): never trails the previous item. */
export const OPENS_ITEM = /^(e )?((a|o) )?(primeir|segund|terceir|quart|quint|sext)\w*\b|^(e )?por (ultimo|fim)\b|^(\w+ )?numero (um|dois|tres|quatro|cinco|seis|\d)\b|^(first|second|third|fourth|fifth|finally)\b/;
/** A short sentence that is a whole idea on its own ("Não é mágica, é método.", "Zero custo."). */
export const SELF_CONTAINED = /\bnao (e|sao|foi|precisa)\b[^.]*,\s*(mas |e sim |e |sao )|^(zero|sem|nenhum) \w+[.!]?$|\bnot\b[^.]*,\s*(but |it'?s )/;

const textOf = (g: Word[]) => g.map((w) => w.text + w.punct).join(' ');
const dur = (g: Word[]) => (g.length ? g[g.length - 1]!.end - g[0]!.start : 0);
const span = (g: Word[]): IdeaSpan => ({ words: g, text: textOf(g), start: g[0]!.start, end: g[g.length - 1]!.end });

/**
 * Splitting after word k would separate one idea? Two numbers of the same comparison,
 * a "não é X" from its "é Y" (EditorReels lesson: 30% × 50% ended in different scenes).
 */
export const canSplit = (g: Word[], k: number): boolean => {
  const a = norm(textOf(g.slice(0, k + 1)));
  const b = norm(textOf(g.slice(k + 1)));
  if (NUMERIC.test(a) && NUMERIC.test(b)) return false;
  if (/\bnao (e|sao|foi|era|precisa)\b/.test(a) && !/\bnao (e|sao|foi|era|precisa)\b.*\b(e|mas|sao)\b/.test(a)) return false;
  return true;
};

const splitLong = (g: Word[], max: number, min: number): Word[][] => {
  const commas = g.slice(0, -1).flatMap((w, k) => (w.punct === ',' || w.punct === ';' || w.punct === ':' ? [k] : []));
  const items = commas.length + (` ${norm(textOf(g))} `.match(/ e | and /g)?.length ?? 0);
  if (dur(g) <= max || (commas.length >= 2 && items >= 3 && dur(g) <= 11)) return [g];
  const mid = g[0]!.start + dur(g) / 2;
  for (const k of [...commas].sort((a, b) => Math.abs(g[a]!.end - mid) - Math.abs(g[b]!.end - mid))) {
    if (dur(g.slice(0, k + 1)) >= min && dur(g.slice(k + 1)) >= min && canSplit(g, k)) return [...splitLong(g.slice(0, k + 1), max, min), ...splitLong(g.slice(k + 1), max, min)];
  }
  return [g];
};

/** Cuts an over-long idea at the longest pause near its middle (no punctuation to help). */
const hardSplit = (g: Word[], hardMax: number, min: number): Word[][] => {
  if (dur(g) <= hardMax || g.length < 4) return [g];
  const mid = g[0]!.start + dur(g) / 2;
  let best = -1;
  let bestScore = -Infinity;
  for (let k = 1; k < g.length - 2; k++) {
    if (dur(g.slice(0, k + 1)) < min || dur(g.slice(k + 1)) < min) continue;
    const pause = g[k + 1]!.start - g[k]!.end;
    const score = pause * 4 + (g[k]!.punct ? 1 : 0) - Math.abs(g[k]!.end - mid) / dur(g) + (canSplit(g, k) ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  if (best < 0) return [g];
  return [...hardSplit(g.slice(0, best + 1), hardMax, min), ...hardSplit(g.slice(best + 1), hardMax, min)];
};

/**
 * Ideas from timed words:
 * - every sentence is an idea; long sentences split at a comma that does not separate a
 *   comparison/contrast; enumerations stay whole;
 * - "Acabou X. Agora Y." / "Não é X. É Y." / "Antes X. Hoje Y." join into one idea;
 * - short questions join the answer that follows; other short pieces join the previous idea;
 * - an idea longer than the hard ceiling is cut at its best pause.
 */
export const groupIdeas = (words: readonly Word[], opts: GroupOptions = {}): IdeaSpan[] => {
  const max = opts.maxSeconds ?? 7.5;
  const min = opts.minSeconds ?? 3;
  const hardMax = opts.hardMaxSeconds ?? 11.5;
  const sentences: Word[][] = [];
  let g: Word[] = [];
  words.forEach((w, k) => {
    g.push(w);
    const pause = k + 1 < words.length ? words[k + 1]!.start - w.end : 9;
    if (w.punct === '.' || w.punct === '?' || w.punct === '!' || pause > 0.9) {
      sentences.push(g);
      g = [];
    }
  });
  if (g.length) sentences.push(g);

  const parts = sentences.flatMap((s) => splitLong(s, max, min));
  const out: Word[][] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const prev = out[out.length - 1];
    const question = p[p.length - 1]!.punct === '?';
    const next = parts[i + 1];
    if (next && dur([...p, ...next]) <= max + 2 && OPENS_CONTRAST.test(norm(textOf(p))) && CLOSES_CONTRAST.test(norm(textOf(next)))) {
      parts[i + 1] = [...p, ...next];
      continue;
    }
    if (dur(p) < min && question && next) {
      parts[i + 1] = [...p, ...next];
      continue;
    }
    if (prev && prev[prev.length - 1]!.punct === '?' && question && dur([...prev, ...p]) <= 6.5) {
      out[out.length - 1] = [...prev, ...p];
      continue;
    }
    if (prev && dur([...prev, ...p]) <= max + 2 && OPENS_CONTRAST.test(norm(textOf(prev))) && CLOSES_CONTRAST.test(norm(textOf(p)))) {
      out[out.length - 1] = [...prev, ...p];
      continue;
    }
    const pn = norm(textOf(p));
    // A short whole idea ("Não é mágica, é método.") stays a scene of its own (Energy/Impact hold 2.4 s).
    if (prev && dur(p) < min && dur(p) >= 1.5 && SELF_CONTAINED.test(pn)) {
      out.push(p);
      continue;
    }
    // A short list item opener goes with what follows, never with the previous item.
    if (prev && dur(p) < min && next && OPENS_ITEM.test(pn) && !OPENS_ITEM.test(norm(textOf(next)))) {
      parts[i + 1] = [...p, ...next];
      continue;
    }
    // A short sentence carrying a strong signal ("O nome é X.", a number, a CTA) opens the
    // next idea instead of trailing the previous one: its scene then starts as it is said.
    if (prev && dur(p) < min && next && STRONG.test(pn) && dur([...p, ...next]) <= max + 2) {
      parts[i + 1] = [...p, ...next];
      continue;
    }
    if (prev && dur(p) < min) {
      out[out.length - 1] = [...prev, ...p];
      continue;
    }
    if (!prev && dur(p) < min && next) {
      parts[i + 1] = [...p, ...next];
      continue;
    }
    out.push(p);
  }
  return out.flatMap((x) => hardSplit(x, hardMax, min)).map(span);
};
