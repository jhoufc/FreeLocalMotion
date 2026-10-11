import type { Format, SceneCategory, StarterSummary, Theme } from '@lms/shared';
import { projectDurationInFrames } from '@lms/template-sdk';
import { sceneDefinitions } from './scenes';
import { compositionDefinition, compositionProjectSchema, type CompositionProject } from './composition/definition';

/**
 * Starter compositions: complete, art-directed videos made only of scene *instances* from
 * the global library. Creating a project from one yields an ordinary free composition —
 * every scene can be edited, duplicated, removed or reordered, and the result can be
 * saved as a user template. Nothing here is pre-rendered.
 */

type Scene = CompositionProject['scenes'][number];

const isPlain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
/** Deep merge for scene overrides. Arrays are replaced, objects merged. */
const merge = <T>(base: T, patch: unknown): T => {
  if (!isPlain(patch) || !isPlain(base)) return (patch === undefined ? base : patch) as T;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = merge((base as Record<string, unknown>)[k], v);
  return out as T;
};

/** A scene instance of `type` with overrides on top of its defaults. */
const scene = (type: string, id: string, name: string, patch: Record<string, unknown> = {}): Scene =>
  merge(sceneDefinitions.get(type).create({ id, name }), patch) as Scene;

/** Shorthand for text content overrides: { headline: 'Text' } -> { texts: { headline: { content } } }. */
const copy = (texts: Record<string, string>) => ({ texts: Object.fromEntries(Object.entries(texts).map(([k, content]) => [k, { content }])) });

export interface StarterComposition {
  id: string;
  name: string;
  description: string;
  category: SceneCategory;
  theme: Theme;
  scenes: () => Scene[];
}

export const STARTERS: readonly StarterComposition[] = [
  {
    id: 'app-launch',
    name: 'App Launch Cinematic',
    description: 'Lançamento de app: logotipo, revelação tipográfica, smartphone, telas, funcionalidade, benefícios e encerramento com tagline.',
    category: 'technology',
    theme: { background: '#06080F', foreground: '#F1F4FF', accent: '#62F0FF', secondary: '#8A5CFF', surface: '#121831' },
    scenes: () => [
      scene('iris-reveal', 'launch-open', 'Abertura — logo', merge(copy({ cover: 'Pulse', headline: 'Meet\nPulse', sub: 'Your money, finally clear.' }), { duration: 3.5, props: { preset: 'iris' } })),
      scene('kinetic-type', 'launch-type', 'Revelação tipográfica', merge(copy({ tag: '/// Personal finance', headline: 'Money,\nmade simple', sub: 'Budgets, goals and insights in one place.' }), { duration: 3.5, props: { direction: 'up' } })),
      scene('floating-phone', 'launch-phone', 'Smartphone', merge(copy({ kicker: 'iOS & Android', headline: 'Everything\nin your pocket', sub: 'Your whole financial life, beautifully organised.' }), { duration: 4.5, props: { screenVariant: 'home', model: 'midnight' } })),
      scene('ui-highlight', 'launch-feature', 'Destaque de funcionalidade', merge(copy({ title: 'Insights that make sense', benefit: 'See where every dollar goes — in real time.' }), { duration: 4, props: { reveal: 'spotlight' } })),
      scene('app-screens', 'launch-screens', 'Transição entre telas', merge(copy({ title: 'Built for every day' }), { duration: 5.5, props: { transition: 'parallax' } })),
      scene('infographic', 'launch-benefits', 'Benefícios', merge(copy({ title: 'Why people love Pulse', note: 'Figures from the Pulse beta, 2026.' }), {
        duration: 4.5,
        props: {
          widgets: [
            { kind: 'counter', label: 'Beta users', value: 12500, max: 20000, unit: '', decimals: 0, series: '' },
            { kind: 'ring', label: 'Hit their savings goal', value: 78, max: 100, unit: '%', decimals: 0, series: '' },
            { kind: 'bar', label: 'App store rating', value: 4.9, max: 5, unit: '★', decimals: 1, series: '' },
          ],
        },
      })),
      scene('cinematic-outro', 'launch-outro', 'Encerramento', merge(copy({ headline: 'Pulse', sub: 'Your money, finally clear.', signature: 'Download now · pulse.app' }), { duration: 4.5 })),
    ],
  },
  {
    id: 'motion-showreel',
    name: 'Motion Design Showreel',
    description: 'Showreel de princípios de motion: squash & stretch, palavras semânticas, morphing, máscaras, formas que se reorganizam e assinatura.',
    category: 'typography',
    theme: { background: '#0B0A10', foreground: '#F6F3FF', accent: '#FF5A36', secondary: '#5B6CFF', surface: '#18161F' },
    scenes: () => [
      scene('bouncing-ball', 'reel-ball', 'Squash & stretch', merge(copy({ headline: 'motion in action', sub: 'Principles, not presets.' }), { duration: 3.2, props: { bounces: 3 } })),
      scene('semantic-words', 'reel-words', 'Palavras semânticas', {
        duration: 3.4,
        texts: { caption: { content: 'Typography that behaves' } },
        props: { words: [{ text: 'Explode', preset: 'explode' }, { text: 'Fast', preset: 'fast' }, { text: 'Focus', preset: 'focus' }] },
      }),
      scene('morph-line', 'reel-morph', 'Linha vira gráfico', merge(copy({ headline: 'Lines become data', caption: 'Geometry with intent.' }), { duration: 3.2, props: { preset: 'growth', speed: 1.25 } })),
      scene('iris-reveal', 'reel-mask', 'Transição por máscara', merge(copy({ cover: 'Mask', headline: 'Reveal\nwith meaning', sub: 'Organic masks, exact timing.' }), { duration: 3, props: { preset: 'liquid' } })),
      scene('grid-breakdown', 'reel-grid', 'Formas se reorganizam', merge(copy({ headline: 'Order\nfrom chaos', sub: 'Shapes rearrange around the message.' }), { duration: 3.5 })),
      scene('cinematic-outro', 'reel-outro', 'Headline final + assinatura', merge(copy({ headline: 'Made to move.', sub: 'Local Motion Studio — showreel 2026', signature: 'motion · type · code' }), { duration: 4 })),
    ],
  },
  {
    id: 'digital-product',
    name: 'Digital Product Promo',
    description: 'SaaS e dashboards: headline, interface, zoom na funcionalidade, cards e indicadores, métricas, segunda funcionalidade, benefícios e CTA.',
    category: 'product',
    theme: { background: '#090B12', foreground: '#EEF1FA', accent: '#5CF2B0', secondary: '#5C7CFF', surface: '#131726' },
    scenes: () => [
      scene('kinetic-type', 'saas-open', 'Headline inicial', merge(copy({ tag: '/// Orbit Analytics', headline: 'Ship with\nconfidence', sub: 'Product analytics your whole team can read.' }), { duration: 3.5 })),
      scene('ui-highlight', 'saas-ui', 'Interface + zoom na funcionalidade', merge(copy({ title: 'Your product, live', benefit: 'Every KPI updates the moment your data changes.' }), { duration: 5, props: { reveal: 'zoom' } })),
      scene('glass-panels', 'saas-cards', 'Cards e indicadores', merge(copy({ title: 'Signals,\nnot noise', subtitle: 'Cards that surface what changed and why.' }), { duration: 4.5 })),
      scene('infographic', 'saas-metrics', 'Métricas animadas', merge(copy({ title: 'Results in the first 90 days', note: 'Median across Orbit customers, 2026.' }), {
        duration: 4.5,
        props: {
          widgets: [
            { kind: 'line', label: 'Weekly active teams', value: 940, max: 1000, unit: '', decimals: 0, series: '310, 420, 455, 560, 610, 730, 820, 940' },
            { kind: 'ring', label: 'Faster decisions', value: 64, max: 100, unit: '%', decimals: 0, series: '' },
            { kind: 'counter', label: 'Reports automated', value: 18400, max: 20000, unit: '', decimals: 0, series: '' },
          ],
        },
      })),
      scene('floating-phone', 'saas-mobile', 'Segunda funcionalidade', merge(copy({ kicker: 'Orbit mobile', headline: 'Alerts that\nfind you', sub: 'Get notified when a metric moves — wherever you are.' }), { duration: 4, props: { screenVariant: 'stats', model: 'silver', rotation: 16 } })),
      scene('editorial-split', 'saas-benefits', 'Benefícios', merge(copy({ blockA: 'Less\nguessing', blockB: 'More\nshipping.', aux: 'Orbit Analytics — built for product teams' }), { duration: 4 })),
      scene('cinematic-outro', 'saas-cta', 'CTA final', merge(copy({ headline: 'Start free today', sub: 'Orbit Analytics', signature: 'orbit.app · no credit card' }), { duration: 4 })),
    ],
  },
  {
    id: 'product-commercial',
    name: 'Product Commercial',
    description: 'Anúncio de produto: elemento gráfico explode, produto revelado, benefícios, transição tipográfica com impacto e marca com tagline.',
    category: 'product',
    theme: { background: '#0D0B09', foreground: '#FBF6EE', accent: '#FF7A2F', secondary: '#FFC94D', surface: '#1C1813' },
    scenes: () => [
      scene('iris-reveal', 'ad-burst', 'Elemento gráfico explode', merge(copy({ cover: 'Aurum', headline: 'Cold.\nBold.', sub: 'A new kind of coffee.' }), { duration: 3, props: { preset: 'burst', revealDuration: 0.8 } })),
      scene('product-hero', 'ad-hero', 'Produto revelado', merge(copy({ kicker: 'Introducing', name: 'Aurum\nCold Brew', description: 'Slow-steeped for 18 hours. Bold, smooth, unforgettable.' }), { duration: 4 })),
      scene('product-callouts', 'ad-benefits', 'Produto com benefícios', merge(copy({ headline: 'Crafted in every detail' }), { duration: 4.5 })),
      scene('product-impact', 'ad-impact', 'Transição tipográfica + composição', merge(copy({ headline: 'Taste the bold', sub: 'In stores this summer.' }), { duration: 4, props: { colorA: '#FF7A2F', colorB: '#FFE08A', words: [{ text: 'Cold' }, { text: 'Bold' }, { text: 'Gold' }] } })),
      scene('cinematic-outro', 'ad-brand', 'Marca e tagline', merge(copy({ headline: 'Aurum', sub: 'Brewed for the bold.', signature: 'aurumcoffee.co' }), { duration: 4 })),
    ],
  },
  {
    id: 'creator-intro',
    name: 'Creator Intro',
    description: 'Apresentação pessoal: linha geométrica, headline, foto (ou monograma), nome e cargo, destaques, métricas, CTA e assinatura.',
    category: 'signature',
    theme: { background: '#0B0B0D', foreground: '#F5F2EC', accent: '#E9C46A', secondary: '#E76F51', surface: '#18181C' },
    scenes: () => [
      scene('morph-line', 'creator-line', 'Linha geométrica', merge(copy({ headline: 'Hello.', caption: 'A short intro.' }), { duration: 3.2, props: { preset: 'orbit', speed: 1.2 } })),
      scene('semantic-words', 'creator-words', 'Headline de apresentação', {
        duration: 3.5,
        texts: { caption: { content: 'What I do' } },
        props: { words: [{ text: 'Design', preset: 'rise' }, { text: 'Animate', preset: 'spin' }, { text: 'Teach', preset: 'grow' }] },
      }),
      scene('brand-reveal', 'creator-brand', 'Foto, nome, destaques e CTA', { duration: 5.5 }),
      scene('number-impact', 'creator-metrics', 'Métricas', merge(copy({ kicker: 'Community', caption: 'People learning motion with me every week.' }), { duration: 3.5, props: { from: 0, to: 120000, suffix: '+' } })),
      scene('cinematic-outro', 'creator-sign', 'Assinatura final', merge(copy({ headline: 'Let’s make\nthings move.', sub: 'Marina Costa', signature: '@marinamotion' }), { duration: 4 })),
    ],
  },
];

export const findStarter = (id: string): StarterComposition | undefined => STARTERS.find((s) => s.id === id);

/** Builds a starter as a validated free-composition project. */
export const buildStarter = (id: string, init: { id: string; name?: string; format: Format; now: string; fps?: 30 | 60 }): CompositionProject => {
  const starter = findStarter(id);
  if (!starter) throw new Error(`Unknown starter composition "${id}"`);
  const base = compositionDefinition.createDefaults({ id: init.id, name: init.name ?? starter.name, format: init.format, fps: init.fps ?? 30, now: init.now });
  return compositionProjectSchema.parse({
    ...base,
    theme: { ...starter.theme },
    origin: { kind: 'template', templateId: `starter:${starter.id}`, version: '1.0.0' },
    scenes: starter.scenes(),
  });
};

export const starterSummaries = (): StarterSummary[] =>
  STARTERS.map((s) => {
    const scenes = s.scenes();
    return { id: s.id, name: s.name, description: s.description, category: s.category, sceneCount: scenes.length, durationSeconds: projectDurationInFrames(scenes, 30) / 30 };
  });

