/**
 * Planning cards of the Studio Premium scenes (see `@lms/speech`). Texts come from the
 * speech; numbers only from numbers that were said; anything missing is hidden.
 */
import {
  chapterTag,
  ctaDetail,
  ctaHeadline,
  headline,
  fit,
  hasWord,
  headlineLines,
  isImpactNumber,
  kickerOf,
  label,
  measured,
  numberLabel,
  numberText,
  secondary,
  shortItems,
  restOf,
  shortTitle,
  twoLines,
  type ScenePlanning,
} from '@lms/speech';

/**
 * Kinetic Type is drawn for two or three giant words ("Break the grid"): a spoken sentence
 * keeps its first words as the headline and continues in the subheadline
 * ("Legenda sincronizada" + "com cada palavra").
 */
const kineticLines = (sentence: string): { headline: string; sub: string | null } => {
  const head = fit(shortTitle(sentence, 3), 24);
  const rest = restOf(sentence, head);
  return { headline: twoLines(head, 12), sub: rest.split(' ').length >= 2 ? fit(rest, 90) : null };
};

export const PREMIUM_PLANNING: Record<string, ScenePlanning> = {
  'kinetic-type': {
    role: 'emphasize',
    sections: ['hook', 'twist', 'explain', 'context'],
    energy: 4,
    needs: ['phrase'],
    visual: 'type',
    generic: true,
    combinesWith: ['glass-panels', 'number-impact', 'floating-phone'],
    use: 'Headline gigante construída por blocos: frase-tese, abertura ou item de uma lista (“01 / 05”).',
    avoid: 'Só repete o texto da fala: quando houver dado, marca ou lista, prefira a cena que mostra isso.',
    fill: (ctx) => {
      if (ctx.chapter) {
        return {
          texts: { tag: `/// ${chapterTag(ctx)}`, ...kineticLines(ctx.chapter.label) },
          strength: 6,
          chapter: true,
          reason: `item ${ctx.chapter.n}${ctx.chapter.total ? ` de ${ctx.chapter.total}` : ''} da lista`,
        };
      }
      const promise = ctx.theme.promise?.idea === ctx.index;
      const tag = kickerOf(ctx, 36);
      // A question to the audience ("Onde vão os seus tokens?") is the headline itself.
      const question = ctx.question ? ctx.text.split(/(?<=[.!?])\s+/).find((s) => s.trim().endsWith('?') && s.split(' ').length >= 3) : null;
      if (question && !promise && question.length <= 44) {
        return { texts: { tag: tag ? `/// ${tag}` : null, headline: twoLines(question.trim(), 22), sub: secondary(ctx, 90) }, strength: 2.2, reason: 'pergunta ao público' };
      }
      if (ctx.claim && !promise) {
        return { texts: { tag: tag ? `/// ${tag}` : null, headline: twoLines(fit(ctx.claim, 40), 20), sub: fit(ctx.title, 90) }, strength: 2.6, reason: `afirmação forte (${ctx.claim})` };
      }
      return {
        texts: { tag: tag ? `/// ${tag}` : null, ...kineticLines(ctx.text.split(/(?<=[.!?])\s+/)[0] ?? ctx.text) },
        strength: promise ? 3 : ctx.isFirst ? 1 : 0,
        reason: promise ? `promessa da lista (${ctx.theme.promise!.n} ${ctx.theme.promise!.noun})` : ctx.isFirst ? 'gancho de abertura' : 'frase forte em destaque',
      };
    },
  },
  'glass-panels': {
    role: 'prove',
    sections: ['proof', 'explain', 'context'],
    energy: 3,
    needs: ['number'],
    visual: 'card',
    avoids: ['infographic'],
    use: 'Painéis de vidro com dois ou três números e seus rótulos — resultados, recursos com valor, métricas lado a lado.',
    avoid: 'Só com números ditos; um único número fica melhor no Number Impact.',
    fill: (ctx) => {
      const nums = measured(ctx).slice(0, 3);
      if (nums.length < 2 || !nums.some(isImpactNumber)) return null;
      return {
        texts: { title: headlineLines(ctx, 48), subtitle: null },
        props: { panels: nums.map((n) => ({ label: numberLabel(n, 24), value: fit(numberText(ctx, n), 18), assetId: null })) },
        strength: 3.2,
        reason: `${nums.length} números com rótulo (${nums.map((n) => n.raw).join(', ')})`,
      };
    },
  },
  'number-impact': {
    role: 'prove',
    sections: ['proof', 'hook', 'twist', 'explain'],
    energy: 4,
    needs: ['number'],
    visual: 'data',
    maxPerVideo: 2,
    combinesWith: ['kinetic-type', 'morph-line'],
    avoids: ['infographic', 'glass-panels'],
    use: 'Um número grande contando até o valor dito (usuários, preço, porcentagem, “10x”).',
    avoid: 'Números pequenos ou ditos de passagem (“um”, “dois minutos”) não sustentam a cena.',
    fill: (ctx) => {
      const nums = measured(ctx).filter(isImpactNumber);
      const n = nums[0];
      if (!n) return null;
      const suffix = (n.unit === '%' ? '%' : n.unit === 'x' ? 'x' : ['s', 'min', 'h', 'd'].includes(n.unit) ? ` ${n.unit}` : '') + (n.atLeast ? '+' : '');
      return {
        texts: { kicker: fit(numberLabel(n, 40) || ctx.title, 40), caption: fit(ctx.text, 100) },
        props: { from: 0, to: n.value, decimals: Math.min(2, n.decimals), prefix: n.prefix, suffix, separator: ctx.lang === 'pt' ? 'dot' : 'comma' },
        strength: nums.length === 1 ? 4 : 1.5,
        reason: `número dito (${n.raw})`,
      };
    },
  },
  'orbital-data': {
    role: 'explain',
    sections: ['explain', 'context', 'proof'],
    energy: 3,
    needs: ['brands'],
    visual: 'brand',
    maxPerVideo: 1,
    use: 'Núcleo com as ferramentas/marcas citadas orbitando — integrações, “conecta com tudo”.',
    avoid: 'Precisa de três ou mais nomes citados.',
    fill: (ctx) => {
      const nodes = ctx.brands.slice(0, 8);
      if (nodes.length < 3) return null;
      return {
        texts: { headline: headlineLines(ctx, 48), sub: secondary(ctx, 90) },
        props: { nodes: nodes.map((b) => ({ label: fit(b, 16), value: '' })) },
        strength: 4,
        reason: `${nodes.length} ferramentas citadas (${nodes.join(', ')})`,
      };
    },
  },
  'product-reveal': {
    role: 'reveal',
    sections: ['hook', 'twist', 'context'],
    energy: 4,
    needs: ['product'],
    visual: 'product',
    maxPerVideo: 1,
    avoids: ['product-hero'],
    use: 'Revelação cinematográfica de um produto físico (“chegou”, “apresento”). Envie a foto do produto.',
    avoid: 'Só para produto físico; para app ou software use as cenas de interface.',
    fill: (ctx) => {
      const name = ctx.reveal?.name || ctx.brands[0];
      if (!name) return null;
      return {
        texts: { headline: twoLines(fit(name, 40), 20), sub: fit(ctx.text, 90) },
        strength: ctx.reveal ? 4 : 2.5,
        reason: `revelação do produto (${name})`,
      };
    },
  },
  'grid-breakdown': {
    role: 'explain',
    sections: ['explain', 'twist', 'context'],
    energy: 3,
    needs: ['phrase'],
    visual: 'abstract',
    combinesWith: ['kinetic-type'],
    use: 'Formas que se reorganizam: transformação, organização, sistema, estrutura.',
    avoid: 'Sem ideia de ordem/transformação na fala, vira enfeite.',
    fill: (ctx) => {
      if (!hasWord(ctx, / (transform\w*|reorganiz\w*|estrutur\w*|organiz\w*|sistema\w*|muda tudo|quebr\w*|ordem|caos|system\w*|organi[sz]\w*|structure\w*|chaos) /)) return null;
      return { texts: { headline: headlineLines(ctx, 36, 5), sub: secondary(ctx, 90, 5) }, strength: 2.5, reason: 'transformação/estrutura na fala' };
    },
  },
  'editorial-split': {
    role: 'compare',
    sections: ['twist', 'explain', 'proof'],
    energy: 3,
    needs: ['phrase'],
    visual: 'card',
    combinesWith: ['number-impact'],
    avoids: ['energy'],
    use: 'Dois blocos lado a lado: antes × agora, menos × mais, A × B (duas marcas comparadas).',
    avoid: 'Precisa de dois lados ditos na fala.',
    fill: (ctx) => {
      const c = ctx.contrast;
      if (c && c.kind !== 'not-but') {
        const [a, b] = c.kind === 'before-now' ? [label(ctx, 'before'), label(ctx, 'now')] : c.kind === 'less-more' ? [label(ctx, 'less'), label(ctx, 'more')] : [label(ctx, 'ended'), label(ctx, 'now')];
        return {
          texts: { blockA: twoLines(fit(`${a} ${c.x}`, 32), 16), blockB: twoLines(fit(`${b} ${c.y}`, 32), 16), aux: null },
          strength: 4.5,
          reason: `dois lados: ${c.x} × ${c.y}`,
        };
      }
      if (ctx.brands.length === 2 && hasWord(ctx, / (ou|versus|vs|contra|compar\w*|melhor que|or|than) /)) {
        return { texts: { blockA: fit(ctx.brands[0]!, 32), blockB: fit(ctx.brands[1]!, 32), aux: fit(ctx.title, 60) }, strength: 3.5, reason: `${ctx.brands[0]} × ${ctx.brands[1]}` };
      }
      return null;
    },
  },
  'cinematic-outro': {
    role: 'close',
    sections: ['cta'],
    energy: 2,
    needs: ['phrase'],
    visual: 'cta',
    maxPerVideo: 1,
    combinesWith: ['brand-reveal'],
    use: 'Encerramento com headline final e assinatura (@ ou marca) — a última ideia ou a chamada para ação.',
    avoid: 'No meio do vídeo quebra o ritmo.',
    fill: (ctx) => {
      if (!ctx.isLast && !ctx.cta) return null;
      const items = shortItems(ctx.items, 20);
      return {
        texts: {
          headline: twoLines(ctaHeadline(ctx, 40) ?? headline(ctx, 40), 20),
          sub: items ? fit(items.join(' · '), 60) : (ctaDetail(ctx, 60) ?? (ctx.cta ? null : secondary(ctx, 60))),
          signature: ctx.person.handle ?? (ctx.brands[0] ? fit(ctx.brands[0], 48) : null),
        },
        strength: ctx.isLast ? (ctx.cta ? 3.5 : 2.5) : 1.5,
        reason: ctx.cta ? `chamada para ação (${ctx.cta.kind})` : 'última ideia do vídeo',
      };
    },
  },
};
