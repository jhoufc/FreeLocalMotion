import { SECTION_LABELS, analyzeIdea, analyzeTheme, type IdeaAnalysis, type SpeechTheme } from './analysis';
import { OPENS_ITEM, SELF_CONTAINED, canSplit, groupIdeas, type GroupOptions, type IdeaSpan } from './ideas';
import { norm } from './text';
import type { SceneFill, ScenePlanning, SpeechContext } from './planning';
import type { Lang } from './text';
import type { Transcript, Word } from './transcript';

/** What the planner needs to know about a scene type. */
export interface PlannableSceneType {
  id: string;
  name: string;
  duration: { min: number; max: number };
  planning?: ScenePlanning;
}

export interface PlanAlternative {
  type: string;
  score: number;
  reason: string;
  fill: SceneFill;
}

export interface PlannedScene {
  /** Index into `plan.ideas` (the analysis of the words this scene covers). */
  idea: number;
  /** Index of the speech idea it belongs to (several scenes may share one long idea). */
  origin: number;
  /** 0 for the first scene of an idea, 1+ for the scenes that continue it. */
  part: number;
  /** Seconds on the audio clock. */
  start: number;
  duration: number;
  type: string;
  fill: SceneFill;
  score: number;
  /** Why this scene (section, data, signal, context) — shown in the Studio. */
  reasons: string[];
  alternatives: PlanAlternative[];
}

export interface SpeechPlan {
  version: 1;
  language: Lang;
  duration: number;
  timed: boolean;
  /** One analysis per scene, in scene order. */
  ideas: IdeaAnalysis[];
  theme: SpeechTheme;
  scenes: PlannedScene[];
  warnings: string[];
}

export interface PlanOptions extends GroupOptions {
  /** Seconds the scene starts before its first word (the visual leads the voice slightly). */
  lead?: number;
  /** Scenes shorter than this are merged with a neighbour (seconds). */
  minScene?: number;
  /** Longer spans are split into parts before planning (seconds). */
  maxScene?: number;
  /** Per-idea forced scene type (user overrides), by idea (`origin`) index. */
  force?: Record<number, string>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Frames are rounded later: keep 0.05 s inside every duration limit. */
const MARGIN = 0.05;
/** Seconds the end card may hold after the last word. */
const TAIL = 1.5;
/** Seconds a scene may hand its trailing pause to the next scene (which then starts early). */
const SHIFT = 1.5;
/** Shortest scene for a self-contained short idea (Energy and Impact hold 2.4 s). */
const SHORT_SCENE = 2.5;

/* ------------------------------------------------------------------ */
/* Fidelity: no number on screen that was not said                     */
/* ------------------------------------------------------------------ */

/** Numbers written anywhere in a fill (texts and data props, recursively). */
export const numbersInFill = (fill: SceneFill): number[] => {
  const out: number[] = [];
  const walk = (v: unknown, key = '') => {
    if (typeof v === 'number') {
      // Layout/timing props are not data; `max` is a chart scale.
      if (/^(value|to|from)$/.test(key) && !(key === 'from' && v === 0)) out.push(v);
    } else if (typeof v === 'string') {
      for (const m of v.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(Number(m[0].replace(',', '.')));
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(fill.texts);
  walk(fill.props ?? {});
  return out;
};

/** Every number said, in all the forms a scene may display it. */
export const spokenNumberForms = (ideas: readonly IdeaAnalysis[]): Set<number> => {
  const set = new Set<number>();
  for (const idea of ideas) {
    for (const n of idea.numbers) {
      set.add(n.value);
      for (const k of [1e3, 1e6, 1e9]) if (n.value >= k) set.add(Math.round((n.value / k) * 100) / 100);
    }
    for (const m of idea.text.matchAll(/\d+(?:[.,]\d+)?/g)) set.add(Number(m[0].replace(',', '.')));
  }
  return set;
};

/** List chapter numbers ("01 / 05") are structure, not data. */
const listNumber = (n: number, theme: SpeechTheme) => Number.isInteger(n) && n >= 1 && n <= Math.max(theme.promise?.n ?? 0, theme.items.length);

export const inventedNumbers = (fill: SceneFill, said: Set<number>, theme: SpeechTheme): number[] => numbersInFill(fill).filter((n) => !said.has(n) && !listNumber(n, theme));

/* ------------------------------------------------------------------ */
/* Segments (the words one scene covers)                               */
/* ------------------------------------------------------------------ */

interface Segment {
  words: Word[];
  /** Scene start/end on the audio clock (start leads the first word slightly). */
  start: number;
  end: number;
  origin: number;
  part: number;
}

const textOf = (ws: Word[]) => ws.map((w) => w.text + w.punct).join(' ');
const ideaOf = (seg: Segment): IdeaSpan => ({ words: seg.words, text: textOf(seg.words), start: seg.words[0]?.start ?? seg.start, end: seg.words[seg.words.length - 1]?.end ?? seg.end });

/**
 * Best scene boundary between words inside [lo, hi] (seconds): long pauses and
 * punctuation first, later boundaries slightly preferred. Returns the word index the
 * second part starts with, or -1.
 */
const bestCut = (seg: Segment, lo: number, hi: number, lead: number, strict = false): number => {
  let best = -1;
  let bestScore = -Infinity;
  for (let k = 1; k < seg.words.length; k++) {
    const b = seg.words[k]!.start - lead;
    if (b < lo || b > hi) continue;
    const pause = seg.words[k]!.start - seg.words[k - 1]!.end;
    const p = seg.words[k - 1]!.punct;
    // A scene that takes only the start of an idea ends on punctuation, and what is left
    // must be a phrase of its own — never "os detalhes." or "e organizado.".
    if (strict && (!p || seg.words.length - k < 4 || !canSplit(seg.words, k - 1))) continue;
    const score = pause * 3 + (p === '.' || p === '?' || p === '!' ? 1.5 : p ? 0.8 : 0) + ((b - lo) / Math.max(0.1, hi - lo)) * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return best;
};

const splitAt = (seg: Segment, k: number, lead: number): [Segment, Segment] => {
  const b = seg.words[k]!.start - lead;
  return [
    { ...seg, words: seg.words.slice(0, k), end: b },
    { ...seg, words: seg.words.slice(k), start: b, part: seg.part + 1 },
  ];
};

/** Scene boundaries on the audio clock: back to back, covering the whole audio. */
const segmentsFor = (ideas: IdeaSpan[], duration: number, o: { lead: number; minScene: number; maxScene: number }): { ideas: IdeaSpan[]; segments: Segment[] } => {
  const list = [...ideas];
  // Merge ideas whose scene would be too short to read.
  for (let guard = 0; guard < 500 && list.length > 1; guard++) {
    const starts = list.map((x, i) => (i === 0 ? 0 : Math.max(0, x.start - o.lead)));
    const spanOf = (i: number) => (i + 1 < list.length ? starts[i + 1]! : duration) - starts[i]!;
    // A self-contained short idea ("Não é mágica, é método.") may be as short as Energy/Impact allow.
    const minOf = (i: number) => (SELF_CONTAINED.test(norm(list[i]!.text)) ? SHORT_SCENE : o.minScene);
    const short = list.findIndex((_, i) => spanOf(i) < minOf(i));
    if (short < 0) break;
    // List item openers merge forward (they start their item); the rest merge backward.
    const j = short === 0 || (short + 1 < list.length && OPENS_ITEM.test(norm(list[short]!.text))) ? short : short - 1;
    if (j + 1 >= list.length) break;
    const a = list[j]!;
    const b = list[j + 1]!;
    list.splice(j, 2, { words: [...a.words, ...b.words], text: `${a.text} ${b.text}`, start: a.start, end: b.end });
  }
  const segments: Segment[] = [];
  list.forEach((x, i) => {
    let seg: Segment = { words: x.words, start: i === 0 ? 0 : Math.max(0, x.start - o.lead), end: i + 1 < list.length ? Math.max(0, list[i + 1]!.start - o.lead) : duration, origin: i, part: 0 };
    // Very long ideas (no punctuation in a monologue) are cut at their best pauses first.
    while (seg.end - seg.start > o.maxScene) {
      const k = bestCut(seg, seg.start + o.minScene, Math.min(seg.start + o.maxScene, seg.end - o.minScene), o.lead);
      if (k < 0) break;
      const [a, b] = splitAt(seg, k, o.lead);
      segments.push(a);
      seg = b;
    }
    segments.push(seg);
  });
  return { ideas: list, segments };
};

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */

interface Candidate {
  type: PlannableSceneType;
  fill: SceneFill;
  score: number;
  reasons: string[];
  /** Word index where the scene stops when it takes only the start of the segment. */
  cut: number;
  /** Scene length (may exceed the segment for the end card). */
  span: number;
}

const staticScore = (p: ScenePlanning, ctx: SpeechContext): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  if (p.sections.includes(ctx.section)) {
    score += 2;
    reasons.push(`cabe na seção ${SECTION_LABELS[ctx.section]}`);
  } else {
    score -= 1;
    reasons.push(`fora da seção ideal (${SECTION_LABELS[ctx.section]})`);
  }
  const diff = Math.abs(p.energy - ctx.energy);
  score -= 0.6 * diff;
  if (diff <= 1) reasons.push(`energia ${p.energy}≈${ctx.energy}`);
  const specific = p.needs.filter((d) => d !== 'phrase' && d !== 'word');
  if (specific.length) {
    score += 0.8;
    reasons.push(`a fala tem ${specific.join('/')}`);
  }
  return { score, reasons };
};

const contextScore = (c: Candidate, history: PlannableSceneType[], total: number, genericCount: number): { score: number; reasons: string[]; ok: boolean } => {
  const p = c.type.planning!;
  let score = 0;
  const reasons: string[] = [];
  // List items repeat their chapter scene on purpose (EditorReels: "capítulo repetido de propósito").
  const n = c.fill.chapter ? 0 : history.filter((h) => h.id === c.type.id).length;
  if (n && n >= (p.maxPerVideo ?? 99)) return { score: -99, reasons, ok: false };
  if (n && history.slice(-3).some((h) => h.id === c.type.id)) {
    score -= 3;
    reasons.push('usada há pouco');
  }
  if (p.generic && !c.fill.chapter && genericCount + 1 > Math.max(1, 0.25 * total)) {
    score -= 3;
    reasons.push('teto de cenas genéricas');
  }
  if (!p.generic && n) {
    score -= 1.5 * n;
    reasons.push(`${n + 1}ª vez no vídeo`);
  }
  score -= 0.6 * n;
  const prev = history[history.length - 1];
  if (prev?.planning) {
    if (prev.planning.avoids?.includes(c.type.id) || p.avoids?.includes(prev.id)) score -= 2.5;
    if (prev.planning.combinesWith?.includes(c.type.id) || p.combinesWith?.includes(prev.id)) {
      score += 0.7;
      reasons.push(`combina com ${prev.name} antes`);
    }
    if (prev.planning.visual === p.visual) score -= 0.5;
  }
  return { score, reasons, ok: true };
};

/**
 * Plans a video from speech (EditorReels Plano v2, adapted to full-screen scenes):
 * 1. ideas are grouped by meaning; each gets a segment of the audio clock;
 * 2. every scene type whose planning card accepts the idea proposes its content;
 * 3. scores combine the card (section, energy, data, signal strength) with the video so
 *    far (repetition, generic cap, combinations, visual family);
 * 4. a strong scene that is shorter than a long idea takes its start; the remaining words
 *    become a new segment, analysed and planned on their own.
 */
export const planSpeech = (transcript: Transcript, types: readonly PlannableSceneType[], opts: PlanOptions = {}): SpeechPlan => {
  const o = { lead: opts.lead ?? 0.12, minScene: opts.minScene ?? 3.2, maxScene: opts.maxScene ?? 12 };
  const plannable = types.filter((t) => t.planning);
  const warnings: string[] = [];
  if (!transcript.timed) warnings.push('Transcrição sem tempos: as cenas seguem uma estimativa de ~2,6 palavras/s. Envie o áudio (ou SRT/VTT) para sincronizar com a fala.');
  const lang = transcript.language;
  const grouped = groupIdeas(transcript.words, opts);
  const { ideas: merged, segments } = segmentsFor(grouped, transcript.duration, o);
  const theme = analyzeTheme(merged, transcript.duration);
  // Chapters belong to the first segment of their idea; continuations are not list items.
  const analyze = (seg: Segment) => analyzeIdea(ideaOf(seg), seg.part === 0 ? seg.origin : -1, transcript.duration, lang, theme);
  const said = spokenNumberForms(merged.map((m, i) => analyzeIdea(m, i, transcript.duration, lang, theme)));
  const total = segments.length;

  const history: PlannableSceneType[] = [];
  const ideas: IdeaAnalysis[] = [];
  const scenes: PlannedScene[] = [];
  let genericCount = 0;
  /** Numbers on screen in the current idea (continuations must not repeat them). */
  const shown = new Set<number>();
  const queue = [...segments];
  /** Analysis + ranked candidates of a segment, in the context of the video planned so far. */
  const rankSegment = (seg: Segment) => {
    const idea = { ...analyze(seg), index: ideas.length };
    if (seg.part > 0 && shown.size) {
      // The continuation of an idea does not show again a number its first scene showed.
      idea.numbers = idea.numbers.filter((n) => !shown.has(n.value));
      const kept = idea.numbers.filter((n) => !n.rhetorical);
      const drop = new Set(['number', 'percent', 'time', 'money'].filter((k) => !(k === 'number' ? kept.length : k === 'percent' ? kept.some((n) => n.unit === '%') : k === 'money' ? kept.some((n) => n.prefix) : kept.some((n) => ['s', 'min', 'h', 'd'].includes(n.unit)))));
      idea.data = idea.data.filter((d) => !drop.has(d));
    }
    const span = seg.end - seg.start;
    const base: SpeechContext = {
      ...idea,
      lang,
      prev: ideas[ideas.length - 1] ?? null,
      next: queue[0] ? analyze(queue[0]) : null,
      count: total,
      isFirst: scenes.length === 0,
      isLast: seg.end >= transcript.duration - 0.01,
      theme,
      span,
    };
    const cands: Candidate[] = [];
    for (const type of plannable) {
      const p = type.planning!;
      if (p.needs.some((d) => !idea.data.includes(d))) continue;
      let cut = -1;
      let sceneSpan = span;
      const speechEnd = (seg.words[seg.words.length - 1]?.end ?? seg.start) + 0.25;
      const want = type.duration.max - MARGIN;
      if (span > want && queue.length && speechEnd - seg.start <= want && span - want <= SHIFT) {
        // The words fit: the pause after them goes to the next scene, which starts a little
        // before its first word (the visual anticipates the voice).
        sceneSpan = want;
      } else if (span > want) {
        // Take the start of the idea; the rest must still make a readable scene.
        cut = bestCut(seg, seg.start + Math.max(type.duration.min, o.minScene) + MARGIN, Math.min(seg.start + type.duration.max - MARGIN, seg.end - o.minScene), o.lead, true);
        if (cut < 0) continue;
        sceneSpan = seg.words[cut]!.start - o.lead - seg.start;
      } else if (span < type.duration.min + MARGIN) {
        // The closing scene may hold up to TAIL seconds past the last word (an end card).
        if (!(base.isLast && type.duration.min + MARGIN - span <= TAIL)) continue;
        sceneSpan = type.duration.min + MARGIN;
      }
      // A scene that takes only the start of the idea shows only what is said in that start
      // (a CTA said at the end must not appear seconds early).
      const head = cut >= 0 ? { ...analyze(splitAt(seg, cut, o.lead)[0]), index: idea.index } : idea;
      if (cut >= 0 && p.needs.some((d) => !head.data.includes(d))) continue;
      const ctx = { ...base, ...head, span: sceneSpan, isLast: cut < 0 && base.isLast };
      const fill = p.fill(ctx);
      if (!fill) continue;
      const fake = inventedNumbers(fill, said, theme);
      if (fake.length) {
        const w = `Cena "${type.name}" descartada em «${idea.title}»: mostraria ${fake.join(', ')}, que não foi dito.`;
        if (!warnings.includes(w)) warnings.push(w);
        continue;
      }
      const st = staticScore(p, ctx);
      let score = st.score + fill.strength;
      const reasons = [fill.reason, ...st.reasons];
      if (ctx.isLast && (p.role === 'close' || p.role === 'call')) {
        score += 1.5;
        reasons.push('encerra o vídeo');
      }
      if (cut >= 0) {
        score -= 0.3;
        reasons.push('ocupa o começo da ideia; o resto vira outra cena');
      }
      if (seg.part > 0 && p.generic) score += 0.5;
      cands.push({ type, fill, score, reasons, cut, span: sceneSpan });
    }
    const forced = seg.part === 0 ? opts.force?.[seg.origin] : undefined;
    const ranked = cands
      .map((c) => {
        const cx = contextScore(c, history, total, genericCount);
        return { ...c, score: c.score + cx.score + (forced === c.type.id ? 100 : 0), reasons: [...c.reasons, ...cx.reasons], ok: cx.ok || forced === c.type.id };
      })
      .filter((c) => c.ok)
      .sort((a, b) => b.score - a.score || a.type.id.localeCompare(b.type.id));
    return { idea, span, ranked, forced };
  };

  /**
   * Two sentences with signals of their own ("O nome é LocalMotion. Hoje são mais de 10 mil
   * vídeos.") make two scenes when each half alone gets a better scene than the whole.
   */
  const betterSplit = (seg: Segment, wholeScore: number): [Segment, Segment] | null => {
    let best: { parts: [Segment, Segment]; score: number } | null = null;
    for (let k = 1; k < seg.words.length; k++) {
      const p = seg.words[k - 1]!.punct;
      if (p !== '.' && p !== '!' && p !== '?') continue;
      const parts = splitAt(seg, k, o.lead);
      const [a, b] = parts;
      // Each half only needs to fit the scene chosen for it (ranking enforces every type's own minimum).
      if (a.end - a.start < SHORT_SCENE || b.end - b.start < SHORT_SCENE) continue;
      const ha = rankSegment(a).ranked[0];
      const hb = rankSegment(b).ranked[0];
      if (!ha || !hb || ha.type.id === hb.type.id || ha.cut >= 0) continue;
      const score = Math.min(ha.score, hb.score);
      // Better alone than together, or two strong signals of their own (a name to reveal and a
      // number to count) that one scene could only show one of.
      const twoSignals = ha.fill.strength >= 2.5 && hb.fill.strength >= 2.5 && score >= wholeScore - 1;
      if ((score > wholeScore + 0.5 || twoSignals) && (!best || score > best.score)) best = { parts, score };
    }
    return best?.parts ?? null;
  };

  while (queue.length) {
    const seg = queue.shift()!;
    if (seg.part === 0) shown.clear();
    const { idea, span, ranked, forced } = rankSegment(seg);
    if (!forced && ranked[0]) {
      const split = betterSplit(seg, ranked[0].score);
      if (split) {
        queue.unshift(split[0], split[1]);
        continue;
      }
    }
    const best = ranked[0];
    if (!best) {
      // Nothing fits this length: split the segment at its best pause and plan both halves.
      const k = bestCut(seg, seg.start + o.minScene, seg.end - o.minScene, o.lead);
      if (k > 0) {
        queue.unshift(...splitAt(seg, k, o.lead));
        continue;
      }
      throw new Error(`Nenhuma cena cabe em «${idea.title}» (${r2(span)} s): a biblioteca precisa de uma cena genérica para essa duração.`);
    }
    let end = best.cut < 0 && best.span < seg.end - seg.start ? seg.start + best.span : Math.max(seg.end, seg.start + best.span);
    if (best.cut < 0 && end < seg.end && queue[0]) queue[0] = { ...queue[0], start: end };
    if (best.cut >= 0) {
      const [head, rest] = splitAt(seg, best.cut, o.lead);
      end = head.end;
      queue.unshift(rest);
      // The saved analysis describes only the words this scene covers (swaps in the editor
      // must not see the numbers of the sentence that follows).
      Object.assign(idea, analyze(head), { index: idea.index });
    }
    history.push(best.type);
    for (const n of numbersInFill(best.fill)) shown.add(n);
    if (best.type.planning!.generic && !best.fill.chapter) genericCount++;
    ideas.push(idea);
    scenes.push({
      idea: idea.index,
      origin: seg.origin,
      part: seg.part,
      start: r2(seg.start),
      duration: r2(end - seg.start),
      type: best.type.id,
      fill: best.fill,
      score: r2(best.score),
      reasons: [SECTION_LABELS[idea.section], ...best.reasons],
      alternatives: ranked
        .filter((c) => c.cut === best.cut && Math.abs(c.span - best.span) < 0.01)
        .slice(1, 5)
        .map((c) => ({ type: c.type.id, score: r2(c.score), reason: c.reasons[0] ?? '', fill: c.fill })),
    });
  }
  const last = scenes[scenes.length - 1];
  const duration = last ? Math.max(transcript.duration, r2(last.start + last.duration)) : transcript.duration;
  return { version: 1, language: lang, duration, timed: transcript.timed, ideas, theme, scenes, warnings };
};

/** Context of a planned scene (to re-fill it with another type in the editor). */
export const contextOf = (plan: SpeechPlan, sceneIndex: number): SpeechContext => {
  const s = plan.scenes[sceneIndex]!;
  const idea = plan.ideas[s.idea]!;
  return {
    ...idea,
    lang: plan.language,
    prev: plan.ideas[s.idea - 1] ?? null,
    next: plan.ideas[s.idea + 1] ?? null,
    count: plan.scenes.length,
    isFirst: sceneIndex === 0,
    isLast: sceneIndex === plan.scenes.length - 1,
    theme: plan.theme,
    span: s.duration,
  };
};

/** What a project created from speech keeps next to it (`projects/<id>/speech.json`). */
export interface SpeechRecord {
  version: 1;
  plan: SpeechPlan;
  score: { total: number; parts: Record<string, number>; notes: string[] };
  transcript: Pick<Transcript, 'words' | 'duration' | 'language' | 'timed' | 'source'>;
  uploadId: string | null;
}
