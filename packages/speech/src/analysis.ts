import {
  behaviourWords,
  danglingNot,
  extractActions,
  extractBrands,
  extractClaim,
  extractContrast,
  extractCta,
  extractHandle,
  extractItems,
  extractNumbers,
  extractReveal,
  extractRole,
  extractSelfName,
  extractSteps,
  isQuestion,
  keyword,
  shortTitle,
  type Contrast,
  type CtaKind,
  type SpokenNumber,
  type WordBehaviour,
} from './extract';
import type { IdeaSpan } from './ideas';
import { NUMBER_WORDS, norm, type Lang } from './text';

/** Script sections (where an idea sits in the narrative). */
export const SECTIONS = ['hook', 'context', 'problem', 'explain', 'demo', 'proof', 'twist', 'cta'] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  hook: 'Gancho',
  context: 'Contexto',
  problem: 'Problema',
  explain: 'Explicação',
  demo: 'Demonstração',
  proof: 'Prova',
  twist: 'Virada',
  cta: 'CTA',
};

/** Kinds of data an idea contains; scene fichas say which ones they need. */
export const DATA_KINDS = ['phrase', 'word', 'number', 'percent', 'time', 'money', 'brand', 'brands', 'items', 'steps', 'question', 'contrast', 'cta', 'person', 'reveal', 'app', 'product', 'interface', 'claim'] as const;
export type DataKind = (typeof DATA_KINDS)[number];

export interface IdeaAnalysis {
  index: number;
  text: string;
  start: number;
  end: number;
  section: Section;
  /** 1 (calm) … 5 (explosive). */
  energy: number;
  /** Signals found in the text (section cues). */
  signals: string[];
  data: DataKind[];
  numbers: SpokenNumber[];
  brands: string[];
  items: string[];
  steps: string[];
  actions: string[];
  contrast: Contrast | null;
  /** "não é X." whose Y opens the next idea. */
  dangling: { neg: string; x: string } | null;
  cta: { kind: CtaKind; text: string } | null;
  question: boolean;
  reveal: { label: string; name: string } | null;
  behaviours: { word: string; behaviour: WordBehaviour }[];
  keyword: string;
  title: string;
  person: { name: string | null; role: string | null; handle: string | null };
  /** Item of a list video ("primeira dica…"): number and total. */
  chapter: { n: number; total: number | null; label: string } | null;
  /** Strong claim said as a stamp: "zero tokens", "100% editável", "sem limite", "de graça". */
  claim: string | null;
}

export interface SpeechTheme {
  /** "3 ferramentas…" promised near the start. */
  promise: { n: number; noun: string; idea: number } | null;
  /** Ideas that open a list item. */
  items: { idea: number; n: number }[];
}

const SIGNALS: Record<string, RegExp> = {
  cta: /\b(comenta\w*|comente|me segue|me siga|segue o perfil|segue (para|pra) \w+|siga (para|pra) \w+|salva\w*|compartilh\w*|link na bio|no direct|te mando|te envio|inscrev\w*|follow|subscribe|comment|share|save this)\b/,
  twist: /^(mas|porem|so que|na verdade|e ai|agora|but|actually|now)\b|\bnao (e|sao|foi) .* (e|mas|e sim)\b|\b(segredo|revel\w*|surpres\w*|ninguem (te )?conta|de graca|gratis|gratuit\w*|secret|free)\b|\bantes\b.*\b(agora|hoje)\b/,
  problem: /\b(problema\w*|erro\w*|dificil|caro|cara|perde\w*|cuidado|risco\w*|chato|demora\w*|limite\w*|trava\w*|ruim|pior|cansad\w*|sofr\w*|problem\w*|mistake\w*|hard|expensive|slow|worst)\b/,
  demo: /\b(clica\w*|clique|abre|abra|abri|digit\w*|pedi|pede|mandei|manda|escrevi|instal\w*|comando\w*|prompt\w*|passo|primeiro|depois|seleciona\w*|cola\w*|arrasta\w*|click\w*|type|open|install\w*|step)\b/,
  proof: /\b(\d+[.,]?\d*\s*%|por cento|resultado\w*|cresc\w*|aument\w*|dobr\w*|economi\w*|milh\w*|bilh\w*|mil|vezes|result\w*|grew|growth|doubled|million|percent)\b/,
  context: /\b(hoje|recentemente|essa semana|lanc\w*|anunci\w*|novidade|chegou|existe|tem uma|today|recently|launched|announced|new)\b/,
};
const INTENSE = /\b(insan\w*|absurd\w*|incrivel|surreal|bizarr\w*|loucura|muito|demais|nunca|sempre|todos?|tudo|insane|crazy|never|always|everything)\b/;
const SECTION_ENERGY: Record<Section, number> = { hook: 4, context: 2, problem: 3, explain: 2, demo: 3, proof: 4, twist: 5, cta: 3 };

const APP = /\b(app|aplicativo|celular|smartphone|iphone|android|baixa\w*|download|mobile|notifica\w*)\b/;
const PRODUCT = /\b(produto|garrafa|embalagem|tenis|perfume|cafe|bebida|lata|caixa|cosmetico|creme|roupa|camiseta|bolsa|relogio|fone|product|bottle|package|sneaker|drink)\b/;
// "ferramenta", "sistema", "tela" are too common in speech to mean a UI on screen.
const INTERFACE = /\b(painel|dashboard|botao|menu|aba|plataforma|software|site|interface|funcionalidade|configuracoes|button|platform|feature|website)\b/;

const ORDINALS: [RegExp, number][] = [
  [/\b(primeir[oa]|n[uú]mero um|first|number one)\b/, 1],
  [/\b(segund[oa]|n[uú]mero dois|second|number two)\b/, 2],
  [/\b(terceir[oa]|n[uú]mero tr[eê]s|third|number three)\b/, 3],
  [/\b(quart[oa]|n[uú]mero quatro|fourth)\b/, 4],
  [/\b(quint[oa]|n[uú]mero cinco|fifth)\b/, 5],
  [/\b(sext[oa]|sixth)\b/, 6],
];

const ORDINAL_HEAD =
  /^\W*(?:(?:a|o|e|the)\s+)?(?:por (?:[uú]ltimo|fim),?\s*|(?:\p{L}+\s+)?n[uú]mero\s+\p{L}+\s*|(?:primeir|segund|terceir|quart|quint|sext)\p{L}*\s*|(?:first|second|third|fourth|fifth|finally)\s*)(?:(?:dica|ferramenta|erro|passo|motivo|forma|jeito|tip|tool|step|mistake)\p{L}*\s*)?[:,\-–]?\s*(?:(?:é|e|is|foi)\s+)?(?:(?:o|a|os|as|the)\s+)?/iu;

/** "Erro número um: começar com bom dia" → "Começar com bom dia"; "A primeira é o Notion AI, que…" → "Notion AI". */
export const chapterLabel = (text: string): string => {
  const colon = text.indexOf(':');
  const body = (colon > 0 && colon < 40 ? text.slice(colon + 1) : text.replace(ORDINAL_HEAD, '')).replace(/^\s*(?:e\s+)?(?:tem|temos|existe|h[aá]|there'?s|there are)\s+(?:(?:o|a|os|as|um|uma|the|a|an)\s+)?/i, '');
  return shortTitle(body.split(/[,;.!?]/)[0]!, 6);
};

/** "3 ferramentas que…" / "cinco dicas" in the first quarter of the video. */
const findPromise = (ideas: IdeaSpan[], duration: number): SpeechTheme['promise'] => {
  for (let i = 0; i < ideas.length && ideas[i]!.start < duration * 0.3; i++) {
    const n = norm(ideas[i]!.text);
    const m = /\b(\d|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|three|four|five|six|seven|ten)\s+(dicas?|ferramentas?|formas?|jeitos?|maneiras?|passos?|erros?|motivos?|razoes|apps?|aplicativos?|segredos?|coisas?|ideias?|truques?|sites?|atalhos?|recursos?|funcoes|funcionalidades|habitos?|regras?|hacks?|estrategias?|perguntas?|licoes|tips?|tools?|ways?|steps?|mistakes?|reasons?|things?|ideas?|tricks?|shortcuts?|features?|habits?|rules?|lessons?)\b/.exec(n);
    if (m) {
      const k = /^\d$/.test(m[1]!) ? Number(m[1]) : NUMBER_WORDS[m[1]!] ?? 0;
      if (k >= 2 && k <= 10) return { n: k, noun: m[2]!, idea: i };
    }
  }
  return null;
};

export const analyzeTheme = (ideas: IdeaSpan[], duration: number): SpeechTheme => {
  const promise = findPromise(ideas, duration);
  const items: SpeechTheme['items'] = [];
  ideas.forEach((idea, i) => {
    if (promise && i === promise.idea) return;
    const head = norm(idea.text.split(/\s+/).slice(0, 6).join(' '));
    // "no dia 15 de setembro" is a date, not a chapter.
    if (/\bdia \d+ de\b/.test(head)) return;
    for (const [rx, n] of ORDINALS) {
      if (rx.test(head) && (promise || /\b(dica|ferramenta|passo|erro|motivo|tip|tool|step)\b/.test(head))) {
        if (!items.some((x) => x.n === n)) items.push({ idea: i, n });
        return;
      }
    }
    // "E por último, o Claude…" closes the list.
    if (promise && items.length && /^(e )?(por (ultimo|fim)|finalmente|and finally|finally|last but)/.test(head)) items.push({ idea: i, n: items.length + 1 });
  });
  // Ordinals that do not form 1, 2, … are ordinary words ("o primeiro passo é…" once).
  const valid = items.length >= 2 && items.every((x, k) => x.n === k + 1);
  if (valid) return { promise, items };
  // Implicit list: "três atalhos… Tem o corte…, Tem a legenda…, E tem os modelos…" — the
  // ideas after the promise that open with the same word are its items.
  if (promise) {
    const head = (i: number) => norm(ideas[i]!.text).replace(/^(e|and)\s+/, '').split(/\s+/)[0] ?? '';
    const after = ideas.map((_, i) => i).filter((i) => i > promise.idea);
    for (const i of after) {
      const h = head(i);
      if (h.length < 2) continue;
      const run = after.filter((j) => j >= i && head(j) === h);
      if (run.length >= Math.min(promise.n, 3) && run.length <= promise.n) return { promise, items: run.map((j, k) => ({ idea: j, n: k + 1 })) };
    }
  }
  return { promise, items: [] };
};

/**
 * Reads the whole speech before any scene is chosen: section, energy and the facts of
 * every idea (EditorReels' `analisar`, plus extraction used by the scene fillers).
 */
export const analyzeIdeas = (ideas: IdeaSpan[], duration: number, lang: Lang): { ideas: IdeaAnalysis[]; theme: SpeechTheme } => {
  const theme = analyzeTheme(ideas, duration);
  const out = ideas.map((idea, k) => analyzeIdea(idea, k, duration, lang, theme));
  // Rhythm: three calm ideas in a row lift the third (avoids a flat video).
  for (let i = 2; i < out.length; i++) if (out[i - 2]!.energy <= 2 && out[i - 1]!.energy <= 2 && out[i]!.energy <= 2) out[i]!.energy += 1;
  return { ideas: out, theme };
};

/** Analysis of one idea (also used for the remainder of an idea split across scenes). */
export const analyzeIdea = (idea: IdeaSpan, k: number, duration: number, lang: Lang, theme: SpeechTheme): IdeaAnalysis => {
    const text = idea.text;
    const n = norm(text);
    const signals = Object.entries(SIGNALS)
      .filter(([, rx]) => rx.test(n))
      .map(([s]) => s);
    const cta = extractCta(text);
    let section: Section;
    if (k === 0 || idea.start < 3) section = 'hook';
    else if (cta && idea.start >= 0.55 * duration) section = 'cta';
    else section = (['twist', 'problem', 'proof', 'demo'] as const).find((s) => signals.includes(s)) ?? (idea.start < 0.25 * duration && signals.includes('context') ? 'context' : 'explain');
    const energy = Math.max(1, Math.min(5, SECTION_ENERGY[section] + (text.includes('!') || INTENSE.test(n) ? 1 : 0)));

    const numbers = extractNumbers(text, lang);
    const brands = extractBrands(text, lang);
    const items = extractItems(text);
    const steps = extractSteps(text);
    const actions = extractActions(text);
    const contrast = extractContrast(text);
    const reveal = extractReveal(text, brands);
    const person = { name: extractSelfName(text), role: extractRole(text), handle: extractHandle(text) };
    const claim = extractClaim(text);
    const data = new Set<DataKind>(['phrase', 'word']);
    const measured = numbers.filter((x) => !x.rhetorical);
    if (measured.length) data.add('number');
    if (measured.some((x) => x.unit === '%')) data.add('percent');
    if (measured.some((x) => ['s', 'min', 'h', 'd'].includes(x.unit))) data.add('time');
    if (measured.some((x) => x.prefix)) data.add('money');
    if (brands.length) data.add('brand');
    if (brands.length >= 2) data.add('brands');
    if (items.length >= 3 || actions.length >= 3) data.add('items');
    if (steps.length >= 2) data.add('steps');
    if (isQuestion(text)) data.add('question');
    if (contrast) data.add('contrast');
    if (cta) data.add('cta');
    if (person.name || person.handle) data.add('person');
    if (reveal) data.add('reveal');
    if (APP.test(n)) data.add('app');
    if (PRODUCT.test(n)) data.add('product');
    if (INTERFACE.test(n)) data.add('interface');
    if (claim) data.add('claim');
    const chapterOf = theme.items.find((x) => x.idea === k);
    return {
      index: k,
      text,
      start: idea.start,
      end: idea.end,
      section,
      energy,
      signals,
      data: [...data],
      numbers,
      brands,
      items,
      steps,
      actions,
      contrast,
      dangling: danglingNot(text),
      cta,
      question: data.has('question'),
      reveal,
      behaviours: behaviourWords(text),
      keyword: keyword(text, lang, brands),
      title: shortTitle(text),
      person,
      chapter: chapterOf ? { n: chapterOf.n, total: theme.promise?.n ?? null, label: chapterLabel(text) } : null,
      claim,
    };
};
