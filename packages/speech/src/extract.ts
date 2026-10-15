/**
 * Facts extracted from one idea's text. Every scene filler builds its content from these —
 * never from defaults — so whatever appears on screen was said (numbers included).
 * Lessons ported from EditorReels' docs/comparativo_planos.md are noted inline.
 */
import { NUMBER_WORDS, capitalize, clean, isStopword, norm, tokens, type Lang } from './text';

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

export interface SpokenNumber {
  /** As said ("30%", "R$ 49,90", "10 mil"). */
  raw: string;
  value: number;
  /** '%', 'R$', '$', 'x', 'k', 'M', 's', 'min', 'h' or ''. */
  unit: string;
  prefix: string;
  /** Up to three meaningful words after the number ("mais econômico"). */
  label: string;
  /** Words before the number, back to the previous clause ("o modelo A"). */
  subject: string;
  /** Decimal places as said. */
  decimals: number;
  /** "100% automático" is a manner of speaking, not a measurement. */
  rhetorical: boolean;
  /** "mais de 10 mil" — shown as "10.000+". */
  atLeast?: boolean;
}

const MULT: Record<string, number> = { mil: 1e3, k: 1e3, thousand: 1e3, milhao: 1e6, milhoes: 1e6, million: 1e6, millions: 1e6, mi: 1e6, bilhao: 1e9, bilhoes: 1e9, billion: 1e9, bi: 1e9 };
const TIME_UNIT: Record<string, string> = { segundo: 's', segundos: 's', seconds: 's', second: 's', minuto: 'min', minutos: 'min', minutes: 'min', minute: 'min', hora: 'h', horas: 'h', hours: 'h', hour: 'h', dia: 'd', dias: 'd', days: 'd' };
const LABEL_SKIP = /^(de|do|da|dos|das|e|que|em|no|na|of|the|and|in|on|a|o|as|os)$/;
const ADJ = /(vel|tico|tica|ado|ada|ido|ida|ivo|iva|ito|ita|al|ente|eiro|eira|or|ful|less|ive)$/;

const parseNumber = (digits: string, lang: Lang): { value: number; decimals: number } => {
  let s = digits;
  if (lang === 'pt') {
    // "1.500" (thousands) vs "2,5" (decimal); "1.500,75".
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
  } else {
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  }
  const value = Number(s);
  const decimals = s.includes('.') ? Math.min(2, s.split('.')[1]!.length) : 0;
  return { value, decimals };
};

/** Numbers said in the idea, in order. Dates ("dia 15 de setembro") and years are not metrics. */
export const extractNumbers = (text: string, lang: Lang): SpokenNumber[] => {
  const out: SpokenNumber[] = [];
  const rx = /(R\$|US\$|\$|€)?\s?(\d+(?:[.,]\d+)*)\s*(%|por cento|percent|x\b|k\b|mil\b|milh(?:ão|ões|ao|oes)\b|bilh(?:ão|ões|ao|oes)\b|mi\b|bi\b|million\b|billion\b|thousand\b)?/gi;
  for (const m of text.matchAll(rx)) {
    const before = text.slice(0, m.index);
    const nb = norm(before);
    if (/\b(dia|dias?\s+\d+\s+de|em|de|no ano de|ano)\s*$/.test(nb) && !m[3] && !m[1] && /^\d{4}$/.test(m[2]!)) continue; // year
    if (/\bdia\s*$/.test(nb) && !m[3]) continue; // "dia 15"
    if (/\b(numero|n[o.]|item|parte|dica|passo|capitulo|top)\s*$/.test(nb) && !m[3] && !m[1]) continue; // "número 2"
    const after = text.slice(m.index! + m[0].length);
    if (/^\s*de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i.test(after)) continue;
    const { value, decimals } = parseNumber(m[2]!, lang);
    if (!Number.isFinite(value)) continue;
    const suffix = norm(m[3] ?? '').trim();
    let unit = '';
    let v = value;
    if (suffix === '%' || suffix === 'por cento' || suffix === 'percent') unit = '%';
    else if (suffix === 'x') unit = 'x';
    else if (suffix in MULT) {
      v = value * MULT[suffix]!;
      unit = '';
    }
    const prefix = m[1] ? (m[1] === 'US$' ? '$' : m[1]) : '';
    const words = after.split(/[,.;:!?]/)[0]!.trim().split(/\s+/).filter(Boolean);
    const tu = TIME_UNIT[norm(words[0] ?? '')];
    if (tu && !unit) unit = tu;
    const labelWords = words.filter((w, i) => !(i === 0 && tu)).filter((w) => !LABEL_SKIP.test(norm(w))).slice(0, 3);
    // "…o modelo B, que é 50%": skip the relative "que é" (and its comma) to reach the name.
    const head = before
      .replace(/(?:^|\s)(?:mais de|menos de|cerca de|quase|até|over|about|nearly|more than)\s*$/i, '')
      .replace(/(?:,\s*)?(?:(?:^|\s)(?:que|which|that))?(?:(?:^|\s)(?:é|e|são|sao|foi|era|tem|fica|is|are|was))?\s*$/i, '');
    const subject = head.split(/[,;:!?]|\.(?!\d)/).pop()!.trim().split(/\s+/).slice(-3).join(' ');
    // "100% automático", "100% na tela": a manner of speaking. "100% dos usuários" is a measure.
    const rhetorical = unit === '%' && v === 100 && !/^\s*(dos|das|de todos|de todas|of)\b/i.test(after);
    out.push({ raw: m[0].trim(), value: v, unit: unit || (prefix ? prefix : ''), prefix, label: labelWords.join(' '), subject, decimals, rhetorical, atLeast: /(?:^|\s)(mais de|over|more than)\s*$/i.test(before) });
  }
  // Spoken numerals ("dez mil usuários") when there are no digits.
  if (!out.length) {
    const ws = text.split(/\s+/);
    for (let i = 0; i < ws.length; i++) {
      const n = NUMBER_WORDS[norm(ws[i]!.replace(/[^\p{L}]/gu, ''))];
      if (n === undefined || n < 2) continue; // "um", "uma" are articles
      let v = n;
      let raw = ws[i]!;
      const nx = norm(ws[i + 1] ?? '').replace(/[^a-z]/g, '');
      if (nx in MULT) {
        v *= MULT[nx]!;
        raw += ' ' + ws[i + 1];
        i++;
      }
      // "número dois" / "erro número um" name a list item, not a quantity.
      if (/^(numero|item|parte|dica|passo)$/.test(norm(ws[i - 1] ?? '').replace(/[^a-z]/g, ''))) continue;
      let unit = '';
      if (norm(ws[i + 1] ?? '') === 'por' && /^cento/.test(norm(ws[i + 2] ?? ''))) {
        unit = '%';
        raw += ` ${ws[i + 1]} ${ws[i + 2]!.replace(/[^\p{L}]/gu, '')}`;
        i += 2;
      }
      const rest = ws.slice(i + 1, i + 5).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter((w) => w && !LABEL_SKIP.test(norm(w)));
      const tu = unit ? undefined : TIME_UNIT[norm(rest[0] ?? '')];
      out.push({ raw: clean(raw), value: v, unit: unit || (tu ?? ''), prefix: '', label: rest.slice(tu ? 1 : 0, 3).join(' '), subject: '', decimals: 0, rhetorical: false });
    }
  }
  return out;
};

/** Number formatted for display, as the speaker would write it. */
export const formatSpoken = (n: SpokenNumber, lang: Lang): string => {
  const v = n.value;
  const compact = v >= 1e9 ? `${trim(v / 1e9)} ${lang === 'pt' ? 'bi' : 'B'}` : v >= 1e6 ? `${trim(v / 1e6)} ${lang === 'pt' ? 'mi' : 'M'}` : v >= 1e4 ? `${trim(v / 1e3)} ${lang === 'pt' ? 'mil' : 'K'}` : trim(v, n.decimals, lang);
  if (n.unit === '%') return `${trim(v, n.decimals, lang)}%`;
  if (n.prefix) return `${n.prefix} ${trim(v, n.decimals || (v % 1 ? 2 : 0), lang)}`;
  if (n.unit === 'x') return `${trim(v, n.decimals, lang)}x`;
  if (n.unit && TIME_UNIT_LABEL[n.unit]) return `${trim(v, n.decimals, lang)} ${n.unit}`;
  return compact;
};
const TIME_UNIT_LABEL: Record<string, true> = { s: true, min: true, h: true, d: true };
const trim = (v: number, decimals = 1, lang: Lang = 'pt') => {
  const s = Number.isInteger(v) ? String(v) : v.toFixed(Math.max(1, decimals)).replace(/\.?0+$/, '');
  return lang === 'pt' ? s.replace('.', ',') : s;
};

/* ------------------------------------------------------------------ */
/* Brands, lists, contrasts                                            */
/* ------------------------------------------------------------------ */

const KNOWN_BRANDS = [
  'ChatGPT', 'OpenAI', 'Claude', 'Anthropic', 'Gemini', 'Google', 'YouTube', 'WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'Twitter', 'Threads',
  'Apple', 'iPhone', 'Android', 'Microsoft', 'Excel', 'Word', 'Notion', 'Canva', 'CapCut', 'Figma', 'Photoshop', 'Premiere', 'Remotion', 'Midjourney',
  'Copilot', 'Perplexity', 'DeepSeek', 'Grok', 'Netflix', 'Spotify', 'Amazon', 'Shopify', 'Hotmart', 'Pix', 'Nubank', 'Python', 'JavaScript', 'n8n', 'Zapier', 'Make',
];
const KNOWN = new Map(KNOWN_BRANDS.map((b) => [norm(b), b]));

const COMMON_CAPS = /^(ia|ai|ok|eu|tv|pc|api|app|vc|ps|pq)$/;

/**
 * Proper names said in the idea: known brands plus capitalized words that don't open a
 * sentence; consecutive names join ("Claude Code", "Notion AI"). "IA" alone is a common noun.
 */
export const extractBrands = (text: string, lang: Lang): string[] => {
  const out: string[] = [];
  for (const part of text.split(/(?<=[.!?:])\s+/)) {
    const ws = part.split(/\s+/);
    let run: string[] = [];
    const flush = () => {
      if (run.length && !(run.length === 1 && COMMON_CAPS.test(norm(run[0]!)))) out.push(run.join(' '));
      run = [];
    };
    ws.forEach((raw, i) => {
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const isName =
        !!w &&
        (KNOWN.has(norm(w)) ||
          (i > 0 && /^\p{Lu}[\p{L}\p{N}]+$/u.test(w) && !/^\p{Lu}+$/u.test(w) && w.length > 2 && !isStopword(w, lang)) ||
          (/^[A-Z]{2,6}$/.test(w) && (run.length > 0 || !COMMON_CAPS.test(norm(w)))));
      if (isName) run.push(KNOWN.get(norm(w)) ?? w);
      else flush();
      if (/[,;:.!?]$/.test(raw)) flush();
    });
    flush();
  }
  return [...new Set(out)];
};

const LIST_SPLIT = /,\s*|\s+(?:e|and|ou|or)\s+(?:até\s+|tambem\s+)?/i;

/**
 * Enumerations: "rápido, bonito e barato" / "criar a conta, validar o número e configurar o webhook"
 * — three or more short parts. Lead-ins ("você consegue …", "dá pra …") are dropped.
 */
export const extractItems = (text: string, opts: { maxWords?: number } = {}): string[] => {
  const maxWords = opts.maxWords ?? 5;
  // "…organizar ideias: pesquisa, escrita e revisão" — the list follows the colon.
  const colon = /:\s*([^.!?]+)/.exec(text);
  const body = colon && colon[1]!.includes(',') ? colon[1]! : text.split(/\b(?:consegue|consigo|pode|posso|podemos|precisa|vai|deve|tem que|basta|dá pra|da pra|inclui|tem|são|sao|like|can|includes)\s+/i).pop()!;
  // "O produto é leve, gelado, intenso": the list starts after the linking verb.
  const clauses = body.split(/[.!?;:]/)[0]!.replace(/^[^,]*?\s(?:é|são|sao|fica|ficou|foi|was|is|are)\s+(?=[^,]+,)/i, '');
  if (!clauses.includes(',')) return [];
  const parts = clauses.split(LIST_SPLIT).map(clean).filter(Boolean);
  if (parts.length < 3) return [];
  // "a quarta é o X, que pesquisa…" is a description, not a list.
  if (parts.some((p) => /^(que|qual|onde|quando|which|who|that)\b/i.test(p) || /(^|\s)(é|são|is|are)(\s|$)/i.test(p))) return [];
  const short = parts.filter((p) => p.split(' ').length <= maxWords);
  if (short.length < 3 || short.length < parts.length - 1) return [];
  return short.map(capitalize).slice(0, 6);
};

/** "gravei…, analisou…, cortou… e decidiu…" — three or more actions in the past, in order. */
export const extractActions = (text: string): string[] => {
  const parts = text.split(/,\s*|\s+e\s+|\s+and\s+/).map(clean).filter(Boolean);
  const acts: string[] = [];
  for (const p of parts) {
    let ws = p.split(' ');
    if (ws.length > 8) continue;
    if (ws.slice(0, 3).some((w) => /(ou|ei|iu|eu|ed)$/.test(norm(w)) && norm(w).length > 3)) {
      while (ws.length && /^(eu|simplesmente|so|entao|ai|o|a|ele|ela|i|he|she|it|then)$/.test(norm(ws[0]!))) ws = ws.slice(1);
      if (ws.length) acts.push(capitalize(ws.slice(0, 6).join(' ')));
    }
  }
  return acts.length >= 3 ? acts.slice(0, 5) : [];
};

const IMPERATIVE = /^(digite|selecione|clique|clica|abra|abre|escolha|copie|copia|cole|cola|toque|arraste|crie|cria|acesse|instale|instala|v[aá]|entre|baixe|baixa|conecte|configure|ative|adicione|escreva|pe[cç]a|click|open|select|type|choose|copy|paste|tap|drag|create|go|install|add|connect|write)$/;

/** "primeiro…, depois…, por fim…" — ordered steps; or two+ sentences that are instructions ("Digite… Selecione…"). */
export const extractSteps = (text: string): string[] => {
  const sentences = text.split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
  const imperative = sentences.filter((s) => IMPERATIVE.test(norm(s.split(' ')[0] ?? '')));
  if (imperative.length >= 2 && imperative.length === sentences.length) return imperative.map((s) => capitalize(s)).slice(0, 5);
  const rx = /\b(primeiro|primeira|segundo|depois|em seguida|ent[aã]o|por fim|finalmente|first|then|next|finally)\b[,\s]*/gi;
  const marks = [...text.matchAll(rx)];
  if (marks.length < 2) return [];
  const steps: string[] = [];
  marks.forEach((m, i) => {
    const s = text.slice(m.index! + m[0].length, marks[i + 1]?.index ?? text.length);
    const c = clean(s.split(/[.!?]/)[0]!);
    if (c) steps.push(capitalize(c));
  });
  return steps.length >= 2 ? steps.slice(0, 5) : [];
};

export interface Contrast {
  /** What is denied / before. */
  x: string;
  /** What is affirmed / now. */
  y: string;
  kind: 'not-but' | 'before-now' | 'less-more' | 'ended';
  /** The negation as said ("Não é", "Não precisa") for not-but contrasts. */
  neg?: string;
}

/** "Não é X, é Y" / "antes X, agora Y" / "menos X, mais Y" / "acabou X. Agora Y". */
export const extractContrast = (text: string): Contrast | null => {
  const t = text.replace(/\s+/g, ' ');
  // The Y needs its own "mas / e sim / é": "não é de uma edição robusta, sofisticada" is a
  // list of adjectives, not a contrast (EditorReels shipped that wrong Y).
  let m = /\bn[ãa]o\s+(é|e|são|sao|foi|era|precisa(?:\s+de)?)\s+(?:só\s+|apenas\s+)?([^,.;!?]{2,48})[,;.]\s*(?:mas\s+sim\s+|mas\s+(?:(?:é|e|são|sao|foi|era)\s+)?|e sim\s+|(?:é|são|sao|foi|era)\s+)(?:só\s+|simplesmente\s+|apenas\s+)?([^,.;!?]{2,48})/i.exec(t);
  if (m && !/^\s*(\d|dois|duas|tr[eê]s|quatro|cinco)\b/i.test(m[3]!)) return { x: clean(m[2]!), y: clean(m[3]!), kind: 'not-but', neg: negation(m[1]!) };
  m = /\b(?:it'?s|is)\s+not\s+([^,.;!?]{2,48})[,;.]\s*(?:but\s+|it'?s\s+)?([^,.;!?]{2,48})/i.exec(t);
  if (m) return { x: clean(m[1]!), y: clean(m[2]!), kind: 'not-but' };
  m = /\b(?:antes|manualmente|na m[ãa]o|before)\b,?\s*([^.;!?]{3,60}?)[,;.]?\s*\b(?:agora|hoje|depois|now|today)\b,?\s*([^.;!?]{3,60})/i.exec(t);
  if (m) return { x: clean(m[1]!), y: clean(m[2]!), kind: 'before-now' };
  m = /\bmenos\s+([^,.;!?]{2,30})[,;.]?\s*(?:e\s+)?mais\s+([^,.;!?]{2,30})|\bless\s+([^,.;!?]{2,30})[,;.]?\s*(?:and\s+)?more\s+([^,.;!?]{2,30})/i.exec(t);
  if (m) return { x: clean(m[1] ?? m[3]!), y: clean(m[2] ?? m[4]!), kind: 'less-more' };
  m = /^\s*(?:acabou|acabaram|chega de|esquece|esqueça|forget)\s+(?:(?:o|os|a|as|com|de|the)\s+)?([^.,!?]{3,40})[.,!]\s*(?:agora\s+|now\s+)?([^.!?]{3,60})/i.exec(t);
  if (m) return { x: clean(m[1]!), y: clean(m[2]!), kind: 'ended' };
  return null;
};

/** "não é X." with no Y in the same idea: the Y may open the next idea. */
export const danglingNot = (text: string): { neg: string; x: string } | null => {
  const m = /\bn[ãa]o\s+(é|são|precisa(?:\s+de)?)\s+(?:de\s+)?([^.,?!]{3,40})[^.?!]*[.?!]?\s*$/i.exec(text);
  return m && !extractContrast(text) ? { neg: negation(m[1]!), x: clean(m[2]!) } : null;
};

/** The speaker's own negation ("não precisa", "não são") — never rewritten as "não é". */
const negation = (verb: string) => `Não ${verb.toLowerCase().replace(/^e$/, 'é').replace(/^sao$/, 'são').replace(/\s+de$/, '')}`;

/* ------------------------------------------------------------------ */
/* Intent: CTA, question, reveal, behaviour words                      */
/* ------------------------------------------------------------------ */

export type CtaKind = 'follow' | 'comment' | 'save' | 'share' | 'link' | 'subscribe';

/** "Comente aí o YouTube que eu te mando…" → { word: "YouTube", rest: "que eu te mando…" }. */
export const commentWord = (text: string): { word: string; rest: string } | null => {
  const m = /\bcoment\p{L}*\s+(?:a[ií]\s+|aqui\s+)?(?:a palavra\s+)?(?:(?:o|a|os|as)\s+)?["“']?([\p{L}\p{N}]{2,20})["”']?(.*)$/iu.exec(text);
  if (!m || /^(que|eu|se|isso|aqui|ai|embaixo|abaixo|sobre)$/i.test(norm(m[1]!))) return null;
  return { word: m[1]!, rest: clean(m[2]!.split(/[.!?]/)[0]!) };
};

export const extractCta = (text: string): { kind: CtaKind; text: string } | null => {
  const n = ` ${norm(text)} `;
  const table: [CtaKind, RegExp][] = [
    ['comment', / (comenta\w*|comente|nos comentarios|me conta\w*|conta (aqui|pra mim)|comment\w*) /],
    ['follow', / (me segue|me siga|segue o perfil|segue (para|pra)|siga (para|pra)|sigam|follow( me)?) |^ segue /],
    ['save', / (salva\w*|guarda esse|save this) /],
    ['share', / (compartilh\w*|manda (pra|para) (alguem|um amigo)|share) /],
    ['link', / (link na bio|link (\w+ ){0,4}(dm|direct|bio)|te mando|te envio|no direct|in bio) /],
    ['subscribe', / (inscrev\w*|ativa o sininho|subscribe) /],
  ];
  for (const [kind, rx] of table) if (rx.test(n)) return { kind, text: clean(text.split(/(?<=[.!?])\s+/).find((s) => rx.test(` ${norm(s)} `)) ?? text) };
  return null;
};

export const isQuestion = (text: string) => {
  const q = text.trim();
  return q.endsWith('?') && !/\b(n[ée]|ok|t[áa]|entendeu|certo|sabe|beleza|right)\?$/i.test(q) && q.split(/\s+/).length >= 3;
};

/** "o nome é X", "apresento X", "chegou o X", "olha isso" → what to reveal. */
export const extractReveal = (text: string, brands: string[]): { label: string; name: string } | null => {
  // `\b` does not see accented letters: "software é" needs an explicit space.
  let m = /\bnome\b.{0,30}?\s(?:é|e|se chama)\s+([^.,!?]{2,30})/i.exec(text) ?? /\b(?:it'?s called|the name is)\s+([^.,!?]{2,30})/i.exec(text);
  if (m) return { label: 'name', name: clean(m[1]!) };
  m = /\b(apresento|conhe[cç]a|chegou|lan[cç]ou|lan[cç]amento|meet|introducing)\b\s*(?:o|a|os|as|the)?\s*([^.,!?]{2,40})?/i.exec(text);
  if (m) return { label: norm(m[1]!), name: clean(m[2] ?? brands[0] ?? '') };
  m = /\b(olha (s[oó] )?(isso|esse|essa)|d[aá] uma olhada|vou (te )?mostrar|look at this|let me show you)\b/i.exec(text);
  if (m) return { label: 'look', name: brands[0] ?? '' };
  return null;
};

export type WordBehaviour = 'explode' | 'fast' | 'shake' | 'focus' | 'grow' | 'rise' | 'spin' | 'connect';

/** Words whose meaning maps to a motion (semantic kinetic words). */
export const BEHAVIOURS: [WordBehaviour, RegExp][] = [
  ['explode', /^(explod\w*|bomb\w*|insan\w*|absurd\w*|loucura|surreal|bizarr\w*|incrivel|chocante|insane|crazy|explosive|mind-?blowing)$/],
  ['fast', /^(rapid\w*|instant\w*|segundos|voando|veloz\w*|ligeir\w*|fast|quick\w*|instant\w*|seconds)$/],
  ['shake', /^(problema\w*|erro\w*|trava\w*|cuidado|perig\w*|chato|incomod\w*|caro|caos|medo|problem\w*|error\w*|danger\w*|careful|broken)$/],
  ['focus', /^(foco|focar|atencao|detalhe\w*|exatamente|precisao|segredo|essencial|focus|detail\w*|exactly|secret)$/],
  ['grow', /^(cresc\w*|aument\w*|escal\w*|gigante|enorme|viral\w*|dobr\w*|evolu\w*|grow\w*|scale\w*|huge|double\w*)$/],
  ['rise', /^(melhor\w*|sucesso|resultado\w*|subi\w*|top|revolu\w*|lucro\w*|ganh\w*|better|best|success|win\w*|profit\w*)$/],
  ['spin', /^(gir\w*|mud\w*|virada|transform\w*|roda\w*|ciclo|spin\w*|chang\w*|turn\w*|twist\w*)$/],
  ['connect', /^(conect\w*|junt\w*|integr\w*|liga\w*|uni\w*|parceri\w*|connect\w*|together|integrat\w*|link\w*)$/],
];

export const behaviourWords = (text: string): { word: string; behaviour: WordBehaviour }[] => {
  const out: { word: string; behaviour: WordBehaviour }[] = [];
  for (const w of tokens(text)) {
    const n = norm(w);
    const hit = BEHAVIOURS.find(([, rx]) => rx.test(n));
    if (hit && !out.some((o) => norm(o.word) === n)) out.push({ word: w, behaviour: hit[0] });
  }
  return out;
};

const INTENSE = /^(insan\w*|absurd\w*|incrivel|surreal|bizarr\w*|loucura|nunca|sempre|todos?|tudo|segredo|gratis|gratuit\w*|zero|ilimitad\w*|perfeit\w*|melhor|pior|unico|insane|never|always|everything|free|secret|best|worst|only)$/;

/** The strongest word of the idea (intense words, names, long content words). */
export const keyword = (text: string, lang: Lang, brands: string[] = []): string => {
  let best = '';
  let score = -Infinity;
  tokens(text).forEach((w, i) => {
    const n = norm(w);
    if (isStopword(w, lang) || n.length < 3 || /^\d/.test(n)) return;
    let s = Math.min(n.length, 10) * 0.25 + i * 0.02;
    if (INTENSE.test(n)) s += 3;
    if (brands.some((b) => norm(b) === n)) s += 2;
    if (BEHAVIOURS.some(([, rx]) => rx.test(n))) s += 1.5;
    if (/(mente|ando|endo|indo)$/.test(n)) s -= 1; // adverbs/gerunds read weak alone
    if (s > score) {
      score = s;
      best = w;
    }
  });
  return best;
};

const WEAK_END = /^(que|de|do|da|dos|das|o|a|os|as|um|uma|e|ou|para|pra|com|em|no|na|por|se|eu|ele|ela|voce|seu|sua|meu|minha|esse|essa|isso|ta|foi|vai|vou|esta|estou|estao|sao|era|tem|ter|the|a|an|of|to|and|or|with|for|in|on|that|is|my|your|i|we|you|will|are)$/;

const FILLER_START = /^(e|entao|olha|so|mas|ah|tipo|cara|eu|ai|bom|gente|pessoal|galera|sabe|basicamente|enfim|que|and|so|but|well|like|look|ok|okay|now|basically|that)$/;
/** Multi-word fillers ("ou seja", "na verdade") that never open a headline. */
const FILLER_PHRASE = /^((ou seja|na verdade|quer dizer|tipo assim|de fato|olha s[oó]|in fact|i mean|you know)[,\s]+|(entendeu|n[ée]|sabe|t[áa]|certo|ok|right)\?\s*)+/i;

/** A short, speakable title: first clause, filler words dropped, up to `k` words. */
export const shortTitle = (text: string, k = 6): string => {
  let ws = text.trim().replace(FILLER_PHRASE, '').split(/[.!?;:]/)[0]!.split(/\s+/).map((w) => w.replace(/[,]+$/, '')).filter(Boolean);
  while (ws.length > 1 && FILLER_START.test(norm(ws[0]!))) ws = ws.slice(1);
  const out = ws.slice(0, k);
  // "Cinco ferramentas de IA que" → "Cinco ferramentas de IA".
  while (out.length > 2 && WEAK_END.test(norm(out[out.length - 1]!))) out.pop();
  return capitalize(clean(out.join(' ')));
};

/** Text after the first clause (the "rest" of the idea), for secondary lines. */
export const restOf = (text: string, title: string): string => {
  const t = clean(text);
  const i = norm(t).indexOf(norm(title));
  let rest = clean(i >= 0 ? t.slice(i + title.length) : t);
  // Drop connectors the cut leaves at the start ("que vão economizar…" → "Vão economizar…").
  while (/^(que|e|mas|de|do|da|and|that|but)\s/i.test(rest)) rest = rest.replace(/^\S+\s+/, '');
  return capitalize(rest);
};

/** "@fulano" or "arroba fulano". */
export const extractHandle = (text: string): string | null => {
  const m = /@([a-z0-9_.]{2,30})|\barroba\s+([a-z0-9_.]{2,30})/i.exec(text);
  return m ? `@${(m[1] ?? m[2])!.toLowerCase()}` : null;
};

/** "eu sou a Marina", "meu nome é Marina Costa", "I'm Marina". */
export const extractSelfName = (text: string): string | null => {
  const m = /\b(?:eu sou (?:o |a )?|meu nome [ée] |me chamo |i'?m |my name is )(\p{Lu}[\p{L}]+(?:\s+\p{Lu}[\p{L}]+)?)/u.exec(text);
  return m ? m[1]! : null;
};

/** Role after the name: "…, designer de motion" / "sou designer". */
export const extractRole = (text: string): string | null => {
  const m = /\b(?:sou|trabalho (?:como|com)|i'?m an?|i work as an?)\s+((?:designer|desenvolvedor\w*|dev|editor\w*|criador\w*|fot[oó]graf\w*|m[eé]dic\w*|advogad\w*|professor\w*|engenheir\w*|empres[aá]ri\w*|programador\w*|developer|creator|founder|fundador\w*|ceo|consultor\w*|nutricionista|personal|coach)[^.,!?]{0,40})/i.exec(text);
  return m ? capitalize(clean(m[1]!)) : null;
};

/**
 * Strong claims said like a stamp (EditorReels' "carimbo"): "zero tokens", "sem
 * mensalidade", "100% editável", "de graça", "sem limite". Returned as said, uppercased.
 */
export const extractClaim = (text: string): string | null => {
  const up = (s: string) => clean(s).toLocaleUpperCase();
  let m = /\b(zero|sem|nenhum|nenhuma|no|without)\s+((?:\p{L}+\s+){0,2}(?:custo|tokens?|mensalidade|assinatura|limites?|an[uú]ncios?|taxas?|c[oó]digo|cost|fees?|limits?|code|subscription))\b/iu.exec(text);
  if (m) return up(`${m[1]} ${m[2]}`);
  m = /\b100\s*%\s+(?:(?:no|na|de|do|da)\s+)?(\p{L}{4,})/iu.exec(text);
  // "100% automático/editável/local" — an adjective; "100% na tela" is not a claim.
  if (m && (ADJ.test(norm(m[1]!)) || /^(local|gratis|online|offline|seguro|real)$/.test(norm(m[1]!)))) return up(`100% ${m[1]}`);
  m = /\b(de gra[cç]a|gr[aá]tis|gratuit\p{L}*|for free|free)\b/iu.exec(text);
  if (m) return up(m[1]!);
  m = /\b(ilimitad\p{L}*|sem limite|quantas vezes (?:voc[eê] )?quiser|unlimited)\b/iu.exec(text);
  if (m) return up(/quantas/i.test(m[1]!) ? 'Sem limite' : m[1]!);
  m = /\b(roda(?:ndo)? local(?:mente)?|na sua m[aá]quina|no seu computador|runs? locally)\b/iu.exec(text);
  if (m) return up(m[1]!);
  return null;
};
