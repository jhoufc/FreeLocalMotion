/** Planning cards of the Signature / 001 scenes (see `@lms/speech`). */
import { capitalize, chapterTag, ctaDetail, ctaHeadline, fit, headline, kickerOf, label, secondary, shortTitle, threeWords, type ScenePlanning, type SpeechContext } from '@lms/speech';
import type { SceneType } from './schema';

/** Splits a short phrase into two headline lines of ≤ max chars each. */
const lines = (text: string, max: number): [string, string] | null => {
  const ws = text.split(' ');
  if (ws.length < 2) return ws[0] && ws[0].length <= max ? [ws[0], ''] : null;
  let best: [string, string] | null = null;
  for (let k = 1; k < ws.length; k++) {
    const a = ws.slice(0, k).join(' ');
    const b = ws.slice(k).join(' ');
    if (a.length <= max && b.length <= max && (!best || Math.abs(a.length - b.length) < Math.abs(best[0].length - best[1].length))) best = [a, b];
  }
  return best;
};

/** "Você só precisa de uma legenda…" → "Uma legenda…": the answer without its lead-in. */
const answer = (text: string) =>
  shortTitle(text.split(/[,;.!?]/)[0]!.replace(/^\s*(?:e\s+|mas\s+)?(?:voc[eê]\s+|vc\s+)?(?:s[oó]\s+)?(?:precisa(?:\s+de)?|basta|tem que|passa a ter|vai ter|consegue|only need|just need)\s+/i, ''), 5);

const contrastOf = (ctx: SpeechContext): { neg: string; x: string; y: string } | null => {
  const c = ctx.contrast;
  if (c?.kind === 'not-but') return { neg: c.neg ?? label(ctx, 'not'), x: c.x, y: c.y };
  if (c?.kind === 'ended') return { neg: label(ctx, 'ended'), x: c.x, y: c.y };
  // "Não precisa X." + the Y that opens the next idea.
  if (ctx.dangling && ctx.next) return { neg: ctx.dangling.neg, x: ctx.dangling.x, y: answer(ctx.next.text) };
  return null;
};

export const SIGNATURE_PLANNING: Record<SceneType, ScenePlanning> = {
  impact: {
    role: 'emphasize',
    sections: ['hook', 'twist'],
    energy: 5,
    needs: ['phrase'],
    visual: 'type',
    generic: true,
    maxPerVideo: 2,
    avoids: ['bouncing-ball'],
    use: 'Headline monumental em duas linhas: o gancho do vídeo, uma revelação ou a promessa de uma lista.',
    avoid: 'Perde força em frase comum; no máximo duas vezes por vídeo.',
    fill: (ctx) => {
      const promise = ctx.theme.promise?.idea === ctx.index;
      if (ctx.claim && !ctx.chapter) {
        const cl = lines(fit(ctx.claim, 56), 28);
        if (cl) return { texts: { kicker: kickerOf(ctx, 32), lineA: cl[0], lineB: cl[1] || null }, strength: 3, reason: `afirmação forte (${ctx.claim})` };
      }
      const ab = lines(headline(ctx, 56, 5), 28);
      if (!ab) return null;
      if (ctx.chapter) {
        const ch = lines(fit(ctx.chapter.label, 56), 28);
        if (ch) return { texts: { kicker: chapterTag(ctx), lineA: ch[0], lineB: ch[1] || null }, strength: 5.5, chapter: true, reason: `item ${ctx.chapter.n}${ctx.chapter.total ? ` de ${ctx.chapter.total}` : ''} da lista` };
      }
      return {
        texts: { kicker: kickerOf(ctx, 32), lineA: ab[0], lineB: ab[1] || null },
        strength: promise ? 3.2 : ctx.isFirst ? 1.5 : ctx.section === 'twist' ? 1 : 0,
        reason: promise ? `promessa da lista (${ctx.theme.promise!.n} ${ctx.theme.promise!.noun})` : ctx.isFirst ? 'gancho de abertura' : 'virada em destaque',
      };
    },
  },
  energy: {
    role: 'compare',
    sections: ['twist', 'explain', 'problem'],
    energy: 4,
    needs: ['phrase'],
    visual: 'type',
    maxPerVideo: 2,
    avoids: ['editorial-split'],
    use: '“Não é X — é Y.”: corrige uma ideia do público com um lead e uma palavra de impacto.',
    avoid: 'Só com a estrutura “não é X, é Y” (ou “acabou X, agora Y”).',
    fill: (ctx) => {
      const c = contrastOf(ctx);
      if (!c) return null;
      const lead = fit(`${c.neg} ${c.x}`, 24);
      const head = capitalize(fit(c.y, 22));
      if (lead.length < 5 || head.length < 2) return null;
      return { texts: { lead, headline: head }, strength: ctx.contrast ? 4.5 : 3.5, reason: ctx.contrast ? `${c.neg.toLowerCase()} ${c.x}, é ${c.y}` : `${c.neg.toLowerCase()} ${c.x} → o “${c.y}” vem na frase seguinte` };
    },
  },
  transformation: {
    role: 'list',
    sections: ['explain', 'hook', 'proof', 'cta'],
    energy: 3,
    needs: ['phrase'],
    visual: 'type',
    use: 'Três palavras que se transformam uma na outra (“Criar. Animar. Publicar.”): três etapas, ações ou itens narrados.',
    avoid: 'Precisa de exatamente três itens narrados.',
    fill: (ctx) => {
      const words = threeWords(ctx, 13);
      if (!words) return null;
      return { texts: { word1: `${words[0]}.`, word2: `${words[1]}.`, word3: `${words[2]}.` }, strength: 4, reason: `três etapas/itens (${words.join(', ')})` };
    },
  },
  signature: {
    role: 'call',
    sections: ['cta'],
    energy: 3,
    needs: ['phrase'],
    visual: 'cta',
    maxPerVideo: 1,
    combinesWith: ['brand-reveal'],
    use: 'Assinatura final com headline e subtítulo — chamada para seguir, comentar, salvar.',
    avoid: 'No meio do vídeo; prefira quando há CTA dito.',
    fill: (ctx) => {
      if (!ctx.cta && !ctx.isLast) return null;
      const head = ctaHeadline(ctx, 48) ?? headline(ctx, 48);
      return {
        texts: { headline: head, subtitle: ctx.person.handle ?? ctaDetail(ctx, 80) ?? (ctx.cta ? null : secondary(ctx, 80)) },
        props: { highlightWord: Math.min(head.split(' ').length - 1, 2) },
        strength: ctx.cta ? 3.5 : 1.5,
        reason: ctx.cta ? `chamada para ação (${ctx.cta.kind})` : 'última ideia do vídeo',
      };
    },
  },
};
