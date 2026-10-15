/**
 * Text utilities shared by the transcript parser, the analysis and the scene fillers.
 * Portuguese first (the Studio's main audience), with English cues where cheap.
 */

export type Lang = 'pt' | 'en';

/** Lowercase, no accents: the form every regex in this package matches against. */
export const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const STOPWORDS: Record<Lang, ReadonlySet<string>> = {
  pt: new Set(
    'a o as os um uma uns umas de do da dos das no na nos nas em por para pra pro com sem que e ou mas se nao sim ja so tambem muito mais menos ele ela eles elas eu voce voces vc nos me te se lhe isso isto esse essa este esta aquele aquela aqui ai la entao tipo cara ne ta foi e era ser ter tem tinha vai vou esta estou estao sao seu sua seus suas meu minha meus minhas como quando onde porque pq qual quais quem tudo todo toda todos todas algo alguma algum cada outro outra mesmo mesma bem agora hoje gente coisa coisas pode posso fazer faz fez da dar deu ao aos ate sobre entre depois antes ainda sempre nunca'.split(' '),
  ),
  en: new Set(
    'a an the of to in on at for from with without and or but if not no yes so also very more less he she it they we you i me my your his her its our their this that these those here there then like just is are was were be been have has had will would can could do does did as when where why how what which who all every each other same now today'.split(' '),
  ),
};

export const isStopword = (w: string, lang: Lang) => STOPWORDS[lang].has(norm(w));

/** Spoken numbers that count as data (fidelity checks treat them like digits). */
export const NUMBER_WORDS: Record<string, number> = {
  zero: 0, nenhum: 0, nenhuma: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quinhentos: 500, mil: 1000,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, fifty: 50, hundred: 100, thousand: 1000,
};

/** Pt/En detection from stopword hits (whole transcript). */
export const detectLanguage = (text: string): Lang => {
  const ws = norm(text).split(/[^a-z]+/).filter(Boolean);
  let pt = 0;
  let en = 0;
  for (const w of ws) {
    if (/^(nao|voce|que|uma|para|com|isso|mais|tem|como|esse|essa|muito|entao)$/.test(w)) pt++;
    if (/^(the|you|that|with|this|have|what|your|just|and|is|are|it)$/.test(w)) en++;
  }
  return en > pt * 1.2 ? 'en' : 'pt';
};

export const capitalize = (s: string) => (s ? s[0]!.toLocaleUpperCase() + s.slice(1) : s);

/** Removes leading/trailing punctuation and quotes. */
export const clean = (s: string) => s.replace(/^[\s"'“”‘’(«\-–—,.;:?!]+|[\s"'“”‘’)»\-–—,;:]+$/g, '').replace(/\s+/g, ' ').trim();

const TRAILING_WEAK = /^(de|do|da|dos|das|e|ou|o|a|os|as|um|uma|que|com|para|pra|em|no|na|of|the|a|an|and|or|to|with|for|in|on)$/i;

/**
 * Shortens to `max` characters at a word boundary, dropping dangling connectors
 * ("…de", "…and"). Never cuts inside a word; a single overlong word is truncated.
 */
export const fit = (text: string, max: number): string => {
  const t = clean(text);
  if (t.length <= max) return t;
  const words = t.split(' ');
  const out: string[] = [];
  for (const w of words) {
    if ([...out, w].join(' ').length > max) break;
    out.push(w);
  }
  while (out.length > 1 && TRAILING_WEAK.test(norm(out[out.length - 1]!))) out.pop();
  if (!out.length) return t.slice(0, max);
  return clean(out.join(' '));
};

/** Splits a short phrase in two balanced lines ("Seu dinheiro\nfinalmente claro"). */
export const twoLines = (text: string, maxLine = 20): string => {
  const words = clean(text).split(' ');
  if (words.length < 2 || text.length <= maxLine * 0.7) return clean(text);
  let best = 1;
  let bestDiff = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ');
    const b = words.slice(k).join(' ');
    const diff = Math.abs(a.length - b.length) + (TRAILING_WEAK.test(norm(words[k - 1]!)) ? 6 : 0);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = k;
    }
  }
  return `${words.slice(0, best).join(' ')}\n${words.slice(best).join(' ')}`;
};

/** Words of a text (punctuation stripped), keeping the original casing. */
export const tokens = (s: string): string[] =>
  s
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}@#$%+]+|[^\p{L}\p{N}%+]+$/gu, ''))
    .filter(Boolean);
