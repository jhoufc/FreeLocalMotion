/**
 * Small building blocks for scene fillers. Fillers live with their scene types (each
 * family's `planning.ts`); these helpers keep the wording and the number rules shared.
 */
import { commentWord, formatSpoken, restOf, shortTitle, type SpokenNumber } from './extract';
import type { SpeechContext } from './planning';
import { capitalize, clean, fit, norm, twoLines } from './text';

const LABELS = {
  pt: { look: 'OLHA ISSO', name: 'O NOME É', meet: 'CONHEÇA', new: 'CHEGOU', launch: 'LANÇAMENTO', not: 'Não é', before: 'Antes', now: 'Agora', less: 'Menos', more: 'Mais', ended: 'Acabou', hi: 'Oi, eu sou' },
  en: { look: 'LOOK AT THIS', name: 'IT’S CALLED', meet: 'MEET', new: 'JUST LANDED', launch: 'LAUNCH', not: 'Not', before: 'Before', now: 'Now', less: 'Less', more: 'More', ended: 'No more', hi: 'Hi, I’m' },
};
export type LabelKey = keyof (typeof LABELS)['pt'];
export const label = (ctx: Pick<SpeechContext, 'lang'>, key: LabelKey) => LABELS[ctx.lang][key];

const firstSentence = (text: string) => clean((text.split(/(?<=[.!?])\s+/)[0] ?? text).replace(/[.!?]+$/, ''));

/**
 * The idea's headline: the whole first sentence (or clause) when it is short enough —
 * "O Claude acabou de matar o YouTube" is never cut into "O Claude acabou de matar" —
 * otherwise its first k words.
 */
export const headline = (ctx: SpeechContext, max: number, k = 6): string => {
  const sentence = firstSentence(ctx.text);
  for (const cand of [sentence, sentence.split(/[,;:]/)[0]!]) {
    const t = shortTitle(cand, 9);
    if (t.length <= max && t.split(' ').length <= Math.max(k + 2, 6) && t.split(' ').length >= 2) return t;
  }
  // Long sentence: the longest opening that fits ("Esse vídeo que você está assistindo", not "Esse vídeo").
  for (let n = k + 2; n >= 3; n--) {
    const t = shortTitle(ctx.text, n);
    if (t.length <= max && t.split(' ').length >= 3) return t;
  }
  return fit(shortTitle(ctx.text, k), max);
};

/** What follows the headline (rest of its sentence, else the next sentence); null when nothing meaningful is left. */
export const secondary = (ctx: SpeechContext, max: number, k = 6): string | null => {
  const rest = restOf(ctx.text, headline(ctx, 999, k));
  const sentence = firstSentence(rest);
  const t = fit(sentence, max);
  return t.split(' ').length >= 3 ? capitalize(t) : null;
};
/** Headline split in two balanced lines. */
export const headlineLines = (ctx: SpeechContext, max: number, k = 5) => twoLines(headline(ctx, max, k), Math.ceil(max / 2));

/** "01 / 05" for list items. */
export const chapterTag = (ctx: SpeechContext): string | null => {
  if (!ctx.chapter) return null;
  const n = String(ctx.chapter.n).padStart(2, '0');
  return ctx.chapter.total ? `${n} / ${String(ctx.chapter.total).padStart(2, '0')}` : n;
};

/** Numbers that are measurements (not "100% automático"). */
export const measured = (ctx: SpeechContext): SpokenNumber[] => ctx.numbers.filter((n) => !n.rhetorical);

/** A number worth a full-screen count-up: big, a percentage, money or a multiplier. */
export const isImpactNumber = (n: SpokenNumber) => n.value >= 10 || n.unit === '%' || !!n.prefix || n.unit === 'x';

export const numberText = (ctx: SpeechContext, n: SpokenNumber) => formatSpoken(n, ctx.lang);

/** A short label for a number: what follows it ("mais econômico") or what precedes it ("modelo A"). */
export const numberLabel = (n: SpokenNumber, max: number): string => {
  // "dois minutos eu tinha…": a pronoun right after the number is not a label.
  if (/^(eu|ele|ela|voce|nos|eles|elas|que|i|he|she|we|they|you)(\s|$)/.test(norm(n.label))) n = { ...n, label: '' };
  const subject = clean(n.subject.replace(/(^|\s)(é|e|foi|são|sao|tem|que|com|reúne|tinha|is|are|was)\s*$/i, '').replace(/^((e|mas|que|o|a|os|as|the|eu|ele|ela|and|but)\s+)+/i, ''));
  const parts = [subject, n.label].filter((x) => x && x.split(' ').length <= 4);
  return fit(capitalize(parts.join(' · ') || n.label || subject), max);
};

/** Proper noun or strongest word, for kickers. */
export const kickerOf = (ctx: SpeechContext, max: number): string | null => {
  if (ctx.chapter) return chapterTag(ctx);
  const b = ctx.brands[0];
  return b ? fit(b.toUpperCase(), max) : null;
};

export const hasWord = (ctx: SpeechContext, rx: RegExp) => rx.test(` ${norm(ctx.text)} `);

/** Short items only (each ≤ max chars), or null. */
export const shortItems = (items: string[], max: number, count?: { min: number; max: number }): string[] | null => {
  const ok = items.map((i) => fit(i, max)).filter((i) => i.length >= 2 && i.length <= max);
  if (ok.length !== items.length) return null;
  if (count && (ok.length < count.min || ok.length > count.max)) return null;
  return ok;
};

/** CTA headline: `Comente “YouTube”` when a word to comment is said, else the CTA sentence. */
export const ctaHeadline = (ctx: SpeechContext, max: number): string | null => {
  if (!ctx.cta) return null;
  const c = ctx.cta.kind === 'comment' ? commentWord(ctx.text) : null;
  // Built directly: `fit`/`clean` would strip the closing quote.
  if (c) return `${ctx.lang === 'pt' ? 'Comente' : 'Comment'} “${fit(c.word, Math.max(4, max - 11))}”`;
  const whole = shortTitle(ctx.cta.text, 12);
  return whole.length <= max ? whole : fit(shortTitle(ctx.cta.text, 6), max);
};

/** What the speaker promises after the CTA ("que eu te mando o tutorial completo"). */
export const ctaDetail = (ctx: SpeechContext, max: number): string | null => {
  const c = ctx.cta?.kind === 'comment' ? commentWord(ctx.text) : null;
  return c && c.rest.split(' ').length >= 3 ? capitalize(fit(c.rest.replace(/^(que|e|and|that)\s+/i, ''), max)) : null;
};

const PAST = /(ou|eu|iu|ei|ed)$/;

/**
 * Three short words for a three-beat scene: three steps ("Organize. Conecte. Revise."),
 * actions or items. Long items shrink to their verb (first word that looks like one).
 */
export const threeWords = (ctx: SpeechContext, max: number): string[] | null => {
  for (const src of [ctx.steps, ctx.items, ctx.actions]) {
    if (src.length !== 3) continue;
    const words = src.map((item) => {
      const t = clean(item);
      if (t.length <= max) return capitalize(t);
      const ws = t.split(' ').filter((w) => !/^(o|a|os|as|e|eu|ele|ela|se|que|the|i)$/i.test(w));
      // "O programa analisou minha fala" -> "Analisou"; imperatives ("Organize a ideia") open with the verb.
      const verb = ws.find((w) => PAST.test(norm(w)) && w.length > 3) ?? ws[0] ?? '';
      return capitalize(verb.replace(/[^\p{L}\p{N}]/gu, ''));
    });
    if (words.every((w) => w.length >= 2 && w.length <= max) && new Set(words.map(norm)).size === 3) return words;
  }
  return null;
};
