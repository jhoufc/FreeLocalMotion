/**
 * Planning cards of the Studio Motion scenes: when each one fits a video and how it is
 * filled from speech (see `@lms/speech`). Every visible text and data field is set from
 * what was said; anything the speech does not provide is hidden — never a placeholder.
 */
import {
  chapterTag,
  fit,
  hasWord,
  headline,
  headlineLines,
  isImpactNumber,
  kickerOf,
  label,
  measured,
  norm,
  numberLabel,
  secondary,
  shortItems,
  twoLines,
  type ScenePlanning,
  type SpeechContext,
  type WordBehaviour,
} from '@lms/speech';

const screenFor = (ctx: SpeechContext, text = ctx.text): 'home' | 'stats' | 'chat' | 'profile' | 'checkout' => {
  const n = ` ${norm(text)} `;
  if (/ (chat|mensage\w*|conversa\w*|whatsapp|direct|dm|message\w*) /.test(n)) return 'chat';
  if (/ (dados|grafico\w*|resultado\w*|metrica\w*|relatorio\w*|analise\w*|stats|data|chart\w*|report\w*) /.test(n)) return 'stats';
  if (/ (pagar|pagamento|compr\w*|pix|cartao|checkout|carrinho|pay\w*|buy|cart) /.test(n)) return 'checkout';
  if (/ (perfil|seguidores|conta|profile|followers|account) /.test(n)) return 'profile';
  return 'home';
};

const CONCEPTS: [string, RegExp, string][] = [
  ['growth', / (cresc\w*|aument\w*|dobr\w*|escal\w*|subi\w*|evolu\w*|grow\w*|scale\w*|double\w*) /, 'crescimento'],
  ['love', / (amo|amor|ama|apaixon\w*|coracao|paixao|love\w*|heart) /, 'carinho'],
  ['success', / (consegui\w*|deu certo|pronto|sucesso|feito|aprovad\w*|conclu\w*|success\w*|done|ready|nailed) /, 'conquista'],
  ['orbit', / (conect\w*|integr\w*|ciclo|loop|sempre|ecossistema|connect\w*|cycle|ecosystem) /, 'conexão'],
];

const BEHAVIOUR_LABEL: Record<WordBehaviour, string> = { explode: 'explode', fast: 'atravessa', shake: 'treme', focus: 'ganha foco', grow: 'cresce', rise: 'sobe', spin: 'gira', connect: 'conecta' };

/** Benefit markers spread around the product (left/right alternating, top to bottom). */
const ANCHORS = [
  { anchorX: -0.3, anchorY: -0.3 },
  { anchorX: 0.3, anchorY: -0.12 },
  { anchorX: -0.28, anchorY: 0.12 },
  { anchorX: 0.28, anchorY: 0.3 },
  { anchorX: 0, anchorY: -0.44 },
];

export const MOTION_PLANNING: Record<string, ScenePlanning> = {
  'bouncing-ball': {
    role: 'emphasize',
    sections: ['hook', 'twist'],
    energy: 3,
    needs: ['word'],
    visual: 'type',
    generic: true,
    maxPerVideo: 1,
    combinesWith: ['morph-line', 'semantic-words'],
    avoids: ['impact'],
    use: 'Abertura leve e lúdica: uma bola quica e pousa sobre uma palavra curta. Boa para ganchos curtos ou uma palavra-chave.',
    avoid: 'Não carrega dado nem lista; uma vez por vídeo no máximo.',
    fill: (ctx) => {
      if (ctx.span > 6.5) return null;
      const word = fit((ctx.title.split(' ').length <= 3 ? ctx.title : ctx.keyword).toLowerCase(), 28);
      if (!word) return null;
      return {
        texts: { headline: word, sub: secondary(ctx, 80) },
        props: { landing: /i/.test(word) ? 'dot-i' : 'period' },
        strength: ctx.isFirst ? 1 : 0.3,
        reason: `palavra “${word}” com a bola pousando`,
      };
    },
  },
  'semantic-words': {
    role: 'emphasize',
    sections: ['hook', 'explain', 'twist', 'problem'],
    energy: 4,
    needs: ['word'],
    visual: 'type',
    generic: true,
    combinesWith: ['bouncing-ball', 'iris-reveal'],
    use: 'Cada palavra se move como o que significa: “absurdo” explode, “rápido” atravessa, “problema” treme, “cresceu” cresce.',
    avoid: 'Sem palavra com comportamento, vira só texto passando — prefira uma cena com o dado ou a marca citada.',
    fill: (ctx) => {
      const words = ctx.behaviours.filter((b) => b.word.length <= 16).slice(0, 4);
      if (!words.length) {
        // Fallback (EditorReels' "palavra"): the strongest words with calm, neutral motion.
        const keys = [ctx.keyword, ...ctx.brands].filter((w, i, a) => w && w.length <= 16 && a.indexOf(w) === i).slice(0, 2);
        if (!keys.length) return null;
        const presets: WordBehaviour[] = ['focus', 'rise'];
        return {
          texts: { caption: fit(ctx.title, 60) },
          props: { words: keys.map((text, i) => ({ text, preset: presets[i]! })), timing: 0.8 },
          strength: -0.5,
          reason: `palavra mais forte da frase (“${keys[0]}”)`,
        };
      }
      return {
        texts: { caption: fit(ctx.title, 60) },
        props: { words: words.map((w) => ({ text: w.word, preset: w.behaviour })), timing: 0.8 },
        strength: 1.5 + 0.6 * Math.min(words.length, 3),
        reason: `palavra${words.length > 1 ? 's' : ''} com comportamento: ${words.map((w) => `“${w.word}” (${BEHAVIOUR_LABEL[w.behaviour]})`).join(', ')}`,
      };
    },
  },
  'morph-line': {
    role: 'explain',
    sections: ['explain', 'context', 'proof'],
    energy: 2,
    needs: ['phrase'],
    visual: 'abstract',
    combinesWith: ['infographic', 'kinetic-type'],
    use: 'Uma linha que vira forma com significado: crescimento (gráfico), carinho (coração), conquista (check), conexão (órbita).',
    avoid: 'Só quando a fala tem esse conceito; não é ilustração genérica.',
    fill: (ctx) => {
      const hit = CONCEPTS.find(([, rx]) => hasWord(ctx, rx));
      if (!hit) return null;
      return {
        texts: { headline: headlineLines(ctx, 40), caption: secondary(ctx, 60) },
        props: { preset: hit[0] },
        strength: 2.5,
        reason: `conceito de ${hit[2]} na fala`,
      };
    },
  },
  'iris-reveal': {
    role: 'reveal',
    sections: ['hook', 'twist', 'context', 'explain'],
    energy: 4,
    needs: ['reveal'],
    visual: 'abstract',
    maxPerVideo: 2,
    combinesWith: ['floating-phone', 'product-hero', 'product-reveal'],
    use: 'Revela um nome, produto ou novidade atrás de uma máscara (“o nome é…”, “conheça…”, “olha isso”).',
    avoid: 'Sem algo a revelar, a máscara não tem sentido.',
    fill: (ctx) => {
      const r = ctx.reveal!;
      const cover = r.label === 'name' ? label(ctx, 'name') : /conhec|meet/.test(r.label) ? label(ctx, 'meet') : /chegou|lanc|introduc/.test(r.label) ? label(ctx, 'new') : label(ctx, 'look');
      const name = r.name ? fit(r.name, 40) : null;
      // Under the revealed name: another sentence of the idea, never the one that says the name.
      const other = name ? ctx.text.split(/(?<=[.!?])\s+/).find((s) => !s.includes(r.name) && s.split(' ').length >= 3) : null;
      return {
        texts: { cover: fit(cover, 16), headline: name ? twoLines(name, 20) : headlineLines(ctx, 40), sub: name ? (other ? fit(other, 80) : null) : secondary(ctx, 80) },
        props: { preset: r.label === 'name' ? 'iris' : 'liquid' },
        strength: r.label === 'name' ? 5 : name ? 3.5 : 2.5,
        reason: r.label === 'name' ? `revelação do nome (${r.name})` : `revelação (“${r.label}”)`,
      };
    },
  },
  'floating-phone': {
    role: 'demonstrate',
    sections: ['demo', 'explain', 'context', 'hook'],
    energy: 3,
    needs: ['app'],
    visual: 'interface',
    combinesWith: ['app-screens', 'ui-highlight', 'iris-reveal'],
    avoids: ['app-screens'],
    use: 'Smartphone 3D com a tela do app (screenshot enviado ou tela procedural de chat, dados, pagamento, perfil).',
    avoid: 'Só quando a fala é sobre um app/celular; troque a tela por um print real depois.',
    fill: (ctx) => ({
      texts: { kicker: kickerOf(ctx, 28), headline: headlineLines(ctx, 48), sub: secondary(ctx, 100) },
      props: { screenVariant: screenFor(ctx) },
      strength: 3.5,
      reason: `fala de app/celular (tela “${screenFor(ctx)}”)`,
    }),
  },
  'ui-highlight': {
    role: 'demonstrate',
    sections: ['demo', 'explain', 'proof'],
    energy: 3,
    needs: ['interface'],
    visual: 'interface',
    combinesWith: ['floating-phone', 'infographic'],
    use: 'Zoom numa região da interface com callouts — recurso, botão, painel, configuração.',
    avoid: 'Sem interface/ferramenta citada; envie o print real da tela para o zoom mostrar o recurso certo.',
    fill: (ctx) => {
      const items = shortItems(ctx.steps.length >= 2 ? ctx.steps : ctx.items, 32, { min: 1, max: 3 }) ?? (ctx.brands.length ? [fit(ctx.brands[0]!, 32)] : []);
      const sides = ['right', 'bottom', 'left'] as const;
      return {
        texts: { title: headlineLines(ctx, 48), benefit: secondary(ctx, 100) },
        props: { callouts: items.slice(0, 3).map((labelText, i) => ({ label: labelText, side: sides[i]! })), reveal: items.length ? 'zoom' : 'spotlight' },
        strength: 2.5 + (items.length ? 0.8 : 0),
        reason: `fala de interface/ferramenta${items.length ? ` (${items.length} destaque${items.length > 1 ? 's' : ''})` : ''}`,
      };
    },
  },
  'app-screens': {
    role: 'demonstrate',
    sections: ['demo', 'explain'],
    energy: 3,
    needs: ['phrase'],
    visual: 'interface',
    combinesWith: ['ui-highlight', 'kinetic-type'],
    avoids: ['floating-phone'],
    use: 'Passo a passo em telas: cada etapa dita (“primeiro…, depois…, por fim…” ou ações em sequência) vira uma tela com legenda.',
    avoid: 'Precisa de 2 a 5 etapas narradas; não use para uma ideia só.',
    fill: (ctx) => {
      const src = ctx.steps.length >= 2 ? ctx.steps : ctx.actions.length >= 3 ? ctx.actions : (hasWord(ctx, / (app|tela|aplicativo|screen) /) ? ctx.items : []);
      const caps = shortItems(src.slice(0, 5), 48, { min: 2, max: 5 });
      if (!caps) return null;
      return {
        texts: { title: headline(ctx, 40, 5) },
        props: { screens: caps.map((caption) => ({ assetId: null, variant: screenFor(ctx, caption), caption })) },
        strength: ctx.steps.length >= 2 ? 4.5 : 3.8,
        reason: `${caps.length} etapas narradas em sequência`,
      };
    },
  },
  'product-hero': {
    role: 'identify',
    sections: ['hook', 'context', 'explain', 'twist'],
    energy: 3,
    needs: ['product'],
    visual: 'product',
    maxPerVideo: 2,
    combinesWith: ['product-callouts', 'iris-reveal'],
    avoids: ['product-reveal'],
    use: 'Produto em destaque 2.5D com nome e descrição. Envie a foto PNG do produto.',
    avoid: 'Só para produto físico citado; para software use o smartphone ou a interface.',
    fill: (ctx) => {
      const name = ctx.reveal?.name || ctx.brands[0];
      if (!name) return null;
      return {
        texts: { kicker: chapterTag(ctx), name: twoLines(fit(name, 32), 16), description: fit(ctx.text, 110) },
        strength: 3.5,
        reason: `produto citado (${name})`,
      };
    },
  },
  'product-callouts': {
    role: 'list',
    sections: ['explain', 'proof', 'demo'],
    energy: 2,
    needs: ['product', 'items'],
    visual: 'product',
    combinesWith: ['product-hero'],
    use: 'Benefícios do produto apontados com linhas e marcadores (até 5 itens narrados).',
    avoid: 'Sem lista de características do produto na fala.',
    fill: (ctx) => {
      const items = shortItems(ctx.items, 28, { min: 2, max: 5 });
      if (!items) return null;
      return {
        texts: { headline: headlineLines(ctx, 48) },
        props: { benefits: items.map((l, i) => ({ label: l, detail: '', ...ANCHORS[i]! })) },
        strength: 4,
        reason: `${items.length} características do produto`,
      };
    },
  },
  'product-impact': {
    role: 'emphasize',
    sections: ['hook', 'twist', 'cta'],
    energy: 5,
    needs: ['product', 'items'],
    visual: 'product',
    maxPerVideo: 1,
    use: 'Três palavras de impacto em cortes rápidos com o produto e duas cores (“leve, gelado, intenso”).',
    avoid: 'Precisa de exatamente três palavras curtas sobre o produto.',
    fill: (ctx) => {
      const words = shortItems(ctx.items, 12, { min: 3, max: 3 });
      if (!words) return null;
      return {
        texts: { headline: headlineLines(ctx, 32, 4), sub: null },
        props: { words: words.map((text) => ({ text })) },
        strength: 4.5,
        reason: `três palavras de impacto (${words.join(', ')})`,
      };
    },
  },
  infographic: {
    role: 'prove',
    sections: ['proof', 'explain', 'twist'],
    energy: 3,
    needs: ['number'],
    visual: 'data',
    combinesWith: ['morph-line', 'ui-highlight'],
    avoids: ['number-impact', 'glass-panels'],
    use: 'Indicadores animados (contador, barra, anel) com os números ditos — ideal para duas ou mais medidas ou porcentagens comparadas.',
    avoid: 'Nunca com números que não foram ditos; para um único número grande prefira o Number Impact.',
    fill: (ctx) => {
      const nums = measured(ctx).slice(0, 4);
      // A lone small number ("dois segundos", "esses três") is said in passing, not data to chart.
      if (!nums.some(isImpactNumber) || (nums.length === 1 && !isImpactNumber(nums[0]!))) return null;
      const pcts = nums.filter((n) => n.unit === '%');
      const compare = pcts.length >= 2;
      const widgets = nums.map((n) => {
        const pct = n.unit === '%';
        const unit = pct ? '%' : n.prefix ? '' : ['s', 'min', 'h', 'd', 'x'].includes(n.unit) ? n.unit : '';
        return {
          kind: pct ? (compare ? 'bar' : 'ring') : 'counter',
          label: numberLabel(n, 28) || fit(ctx.title, 28),
          value: n.value,
          max: pct ? 100 : n.value,
          unit,
          decimals: Math.min(2, n.decimals),
          series: '',
        };
      });
      // Comparisons are titled by what is compared ("Modelo A × Modelo B"); otherwise the
      // headline — unless it would be cut through a number ("O modelo A é 30 % mais").
      const subjects = widgets.map((w) => w.label.split(' · ')[0]!).filter((s, i, a) => s && a.indexOf(s) === i);
      const versus = compare && subjects.length === widgets.length ? subjects.join(' × ') : '';
      const title = versus && versus.length <= 40 ? twoLines(versus, 20) : /\d/.test(headline(ctx, 40)) ? null : headlineLines(ctx, 40);
      return {
        texts: { title, note: null },
        props: { widgets, entry: 'stagger' },
        strength: compare ? 5 : nums.length >= 2 ? 3.8 : 1.2,
        reason: compare ? `${pcts.length} porcentagens comparadas (${pcts.map((p) => p.raw).join(' × ')})` : `${nums.length} medida${nums.length > 1 ? 's' : ''} dita${nums.length > 1 ? 's' : ''} (${nums.map((n) => n.raw).join(', ')})`,
      };
    },
  },
  'brand-reveal': {
    role: 'identify',
    sections: ['hook', 'context', 'cta'],
    energy: 3,
    needs: ['person'],
    visual: 'brand',
    maxPerVideo: 1,
    combinesWith: ['cinematic-outro', 'semantic-words'],
    use: 'Apresentação pessoal: foto (ou monograma), nome, cargo, @ e destaques numéricos — quando a pessoa diz quem é ou o seu @.',
    avoid: 'Só quando a fala apresenta alguém; os destaques usam apenas números ditos.',
    fill: (ctx) => {
      const p = ctx.person;
      const name = p.name ?? (p.handle ? p.handle.slice(1) : null);
      if (!name) return null;
      const highlights = measured(ctx)
        .filter(isImpactNumber)
        .slice(0, 3)
        .map((n) => ({ value: n.value, suffix: n.unit === '%' ? '%' : '', label: fit(n.label || n.subject, 20) }));
      return {
        texts: {
          headline: p.name ? label(ctx, 'hi') : null,
          name: twoLines(fit(name, 32), 16),
          role: p.role ? fit(p.role, 60) : null,
          handle: p.handle,
          cta: ctx.cta ? fit(ctx.cta.text, 32) : null,
        },
        props: { highlights },
        strength: 4.5,
        reason: p.name ? `apresentação (${p.name})` : `perfil citado (${p.handle})`,
      };
    },
  },
};
