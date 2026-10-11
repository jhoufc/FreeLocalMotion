import { z } from 'zod';
import { graphicElementSchema, hexColorSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

/* ------------------------------------------------------------------ */
/* 08 — Product Hero 2.5D                                              */
/* ------------------------------------------------------------------ */

export const productHeroSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('product-hero'),
  duration: z.number().min(3.5).max(8),
  texts: z.object({ kicker: textElementSchema, name: textElementSchema, description: textElementSchema }),
  elements: z.object({ product: graphicElementSchema, light: graphicElementSchema, lines: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** Main product image (PNG with transparency works best). Procedural product otherwise. */
    assetId: z.string().nullable(),
    /**
     * Extra views of the same product (side, back…). When present, the "turn" crossfades
     * between real photographs instead of faking sides that were never provided.
     */
    angles: z.array(z.object({ assetId: z.string().nullable() })).max(3),
    scale: z.number().min(0.6).max(1.4),
    positionX: z.number().min(-0.25).max(0.25),
    positionY: z.number().min(-0.25).max(0.25),
    shadow: z.number().min(0).max(1.5),
  }),
});
export type ProductHeroScene = z.infer<typeof productHeroSchema>;

export const HERO_CHOREO = {
  light: { in: 0, dur: 1 },
  product: { in: 0.2, dur: 1.3 },
  lines: { in: 1, dur: 1 },
  kicker: { in: 0.9, dur: 0.6 },
  name: { in: 1.1, dur: 0.9 },
  description: { in: 1.6, dur: 0.7 },
  exit: 0.6,
} as const;

export const productHeroType = motionSceneType<ProductHeroScene>({
  id: 'product-hero',
  name: 'Product Hero 2.5D',
  description: 'Produto isolado com iluminação gráfica, sombra, profundidade, rotação aparente 2.5D e linhas de destaque — composição publicitária.',
  category: 'product',
  heroTime: 2.8,
  duration: { default: 5, min: 3.5, max: 8 },
  schema: productHeroSchema,
  palette: { background: '#0C0B0A', foreground: '#F7F3EC', accent: '#FF8A3D', secondary: '#3F6BFF', surface: '#1B1916' },
  create: (init) => ({
    id: init.id,
    type: 'product-hero',
    name: init.name,
    duration: 5,
    ...baseInstance('void', ['center', 'start']),
    texts: {
      kicker: text('New · Limited edition', { weight: 600, uppercase: true, tracking: 0.2, color: '$accent', breaks: ['single', 'single'] }),
      name: text('Aurum Cold Brew', { weight: 900, uppercase: false, tracking: -0.035, breaks: ['auto', 'manual'] }),
      description: text('Slow-steeped for 18 hours. Bold, smooth, unforgettable.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
    },
    elements: { product: graphic('$accent', 1, 1), light: graphic('$accent', 0.9, 1), lines: graphic('$foreground', 0.5, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { assetId: null, angles: [], scale: 1, positionX: 0, positionY: 0, shadow: 1 },
  }),
  texts: {
    kicker: { label: 'Kicker', maxLength: 32, multiline: false, ...HERO_CHOREO.kicker },
    name: { label: 'Nome do produto', maxLength: 32, multiline: true, ...HERO_CHOREO.name },
    description: { label: 'Descrição', maxLength: 110, multiline: true, ...HERO_CHOREO.description },
  },
  graphics: {
    product: { label: 'Produto', intensityLabel: 'Flutuação', description: 'Cor do produto procedural (imagens em Cena).', ...HERO_CHOREO.product },
    light: { label: 'Iluminação', intensityLabel: 'Intensidade', description: 'Spot, aro e brilho especular.', ...HERO_CHOREO.light },
    lines: { label: 'Linhas de destaque', intensityLabel: 'Detalhe', description: 'Arcos e marcações ao redor do produto.', ...HERO_CHOREO.lines },
  },
  exit: HERO_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'assetId'], 'Imagem do produto (PNG)', 'image'),
    field.list([...base, 'props', 'angles'], 'Outros ângulos (opcional)', {
      min: 0,
      max: 3,
      itemLabel: 'Ângulo',
      newItem: { assetId: null },
      itemFields: [field.asset(['assetId'], 'Imagem', 'image')],
      hint: 'Com fotos de outros ângulos, a cena alterna entre elas para uma rotação real.',
    }),
    field.number([...base, 'props', 'scale'], 'Escala', { min: 0.6, max: 1.4, step: 0.01, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'positionX'], 'Posição X', { min: -0.25, max: 0.25, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'positionY'], 'Posição Y', { min: -0.25, max: 0.25, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'shadow'], 'Sombra', { min: 0, max: 1.5, step: 0.01, unit: '×' }),
  ],
});

/* ------------------------------------------------------------------ */
/* 09 — Product Detail Callout                                         */
/* ------------------------------------------------------------------ */

export const calloutBenefitSchema = z.object({
  label: z.string().min(1).max(28),
  detail: z.string().max(48),
  /** Marker position on the product, as fractions of its box (-0.5..0.5 from the center). */
  anchorX: z.number().min(-0.5).max(0.5),
  anchorY: z.number().min(-0.5).max(0.5),
});

export const productCalloutsSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('product-callouts'),
  duration: z.number().min(3.5).max(9),
  texts: z.object({ headline: textElementSchema }),
  elements: z.object({ product: graphicElementSchema, markers: graphicElementSchema, lines: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    assetId: z.string().nullable(),
    benefits: z.array(calloutBenefitSchema).min(1).max(5),
    lineStyle: z.enum(['straight', 'elbow', 'dotted']),
    /** Seconds between benefits. */
    stagger: z.number().min(0.15).max(0.8),
  }),
});
export type ProductCalloutsScene = z.infer<typeof productCalloutsSchema>;

export const CALLOUT_CHOREO = {
  product: { in: 0, dur: 1 },
  headline: { in: 0.3, dur: 0.8 },
  markers: { in: 1, dur: 1.6 },
  lines: { in: 1.1, dur: 1.6 },
  exit: 0.6,
} as const;

export const productCalloutsType = motionSceneType<ProductCalloutsScene>({
  id: 'product-callouts',
  name: 'Product Detail Callout',
  description: 'Produto ao centro e até cinco benefícios surgindo com marcadores, linhas de conexão e microanimações.',
  category: 'product',
  heroTime: 3.4,
  duration: { default: 5, min: 3.5, max: 9 },
  schema: productCalloutsSchema,
  palette: { background: '#F2F0EC', foreground: '#121212', accent: '#FF4F1F', secondary: '#1F5BFF', surface: '#E3E0DA' },
  create: (init) => ({
    id: init.id,
    type: 'product-callouts',
    name: init.name,
    duration: 5,
    ...baseInstance('void', ['center', 'center']),
    texts: { headline: text('Every detail, considered', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['auto', 'single'] }) },
    elements: { product: graphic('$accent', 1, 1), markers: graphic('$accent', 1, 1), lines: graphic('$foreground', 0.7, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      assetId: null,
      benefits: [
        { label: 'Aluminium cap', detail: 'Seals in freshness', anchorX: 0, anchorY: -0.44 },
        { label: 'Cold-brewed', detail: '18-hour steep', anchorX: 0.3, anchorY: -0.1 },
        { label: 'Recyclable', detail: '100% glass body', anchorX: -0.32, anchorY: 0.15 },
        { label: 'Zero sugar', detail: 'Naturally smooth', anchorX: 0.28, anchorY: 0.32 },
      ],
      lineStyle: 'elbow',
      stagger: 0.35,
    },
  }),
  texts: { headline: { label: 'Headline', maxLength: 48, multiline: true, ...CALLOUT_CHOREO.headline } },
  graphics: {
    product: { label: 'Produto', intensityLabel: 'Flutuação', description: 'Cor do produto procedural (imagem em Cena).', ...CALLOUT_CHOREO.product },
    markers: { label: 'Marcadores', intensityLabel: 'Pulso', description: 'Pontos sobre o produto.', ...CALLOUT_CHOREO.markers },
    lines: { label: 'Linhas', intensityLabel: 'Espessura', description: 'Conexões entre marcadores e rótulos.', ...CALLOUT_CHOREO.lines },
  },
  exit: CALLOUT_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'assetId'], 'Imagem do produto (PNG)', 'image'),
    field.list([...base, 'props', 'benefits'], 'Benefícios', {
      min: 1,
      max: 5,
      itemLabel: 'Benefício',
      titlePath: ['label'],
      newItem: { label: 'New benefit', detail: 'Short detail', anchorX: -0.2, anchorY: -0.3 },
      itemFields: [
        field.text(['label'], 'Título', { maxLength: 28 }),
        field.text(['detail'], 'Detalhe', { maxLength: 48 }),
        field.number(['anchorX'], 'Marcador — X', { min: -0.5, max: 0.5, step: 0.01, unit: '%', displayScale: 100 }),
        field.number(['anchorY'], 'Marcador — Y', { min: -0.5, max: 0.5, step: 0.01, unit: '%', displayScale: 100 }),
      ],
      hint: 'Marcadores à esquerda do centro levam o rótulo para a esquerda; à direita, para a direita.',
    }),
  ],
  animationFields: (base) => [
    field.select([...base, 'props', 'lineStyle'], 'Estilo das linhas', [
      { value: 'straight', label: 'Reta' },
      { value: 'elbow', label: 'Cotovelo' },
      { value: 'dotted', label: 'Pontilhada' },
    ], true),
    field.number([...base, 'props', 'stagger'], 'Intervalo entre benefícios', { min: 0.15, max: 0.8, step: 0.01, unit: 's' }),
  ],
});

/* ------------------------------------------------------------------ */
/* 10 — Product Color Impact                                           */
/* ------------------------------------------------------------------ */

export const productImpactSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('product-impact'),
  duration: z.number().min(3.5).max(7),
  texts: z.object({ headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ product: graphicElementSchema, shapes: graphicElementSchema, echo: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    assetId: z.string().nullable(),
    colorA: hexColorSchema,
    colorB: hexColorSchema,
    words: z.array(z.object({ text: z.string().min(1).max(12) })).length(3),
  }),
});
export type ProductImpactScene = z.infer<typeof productImpactSchema>;

export const IMPACT_CHOREO = {
  shapes: { in: 0, dur: 1.4 },
  echo: { in: 0.1, dur: 1.4 },
  product: { in: 1.45, dur: 0.8 },
  headline: { in: 1.9, dur: 0.7 },
  sub: { in: 2.3, dur: 0.6 },
  exit: 0.45,
} as const;

export const productImpactType = motionSceneType<ProductImpactScene>({
  id: 'product-impact',
  name: 'Product Color Impact',
  description: 'Comercial de alto contraste: duas cores, três palavras de impacto em cortes rápidos com eco, formas geométricas e revelação do produto.',
  category: 'product',
  heroTime: 2.9,
  duration: { default: 4.5, min: 3.5, max: 7 },
  schema: productImpactSchema,
  palette: { background: '#111111', foreground: '#FFFFFF', accent: '#FFE600', secondary: '#FF2E63', surface: '#1E1E1E' },
  create: (init) => ({
    id: init.id,
    type: 'product-impact',
    name: init.name,
    duration: 4.5,
    ...baseInstance('void', ['center', 'center']),
    texts: {
      headline: text('Taste the bold', { weight: 900, stretch: 'expanded', tracking: -0.04, breaks: ['words', 'words'] }),
      sub: text('Available everywhere this summer.', { weight: 500, uppercase: true, tracking: 0.12, breaks: ['auto', 'single'] }),
    },
    elements: { product: graphic('$accent', 1, 1), shapes: graphic('#FFFFFF', 1, 1), echo: graphic('#FFFFFF', 0.4, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { assetId: null, colorA: '#FF2E63', colorB: '#FFE600', words: [{ text: 'Bold' }, { text: 'Bright' }, { text: 'Now' }] },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 32, multiline: true, ...IMPACT_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 60, multiline: true, ...IMPACT_CHOREO.sub },
  },
  graphics: {
    product: { label: 'Produto', intensityLabel: 'Pulso', description: 'Cor do produto procedural (imagem em Cena).', ...IMPACT_CHOREO.product },
    shapes: { label: 'Formas geométricas', intensityLabel: 'Quantidade', description: 'Círculos, barras e explosões.', ...IMPACT_CHOREO.shapes },
    echo: { label: 'Eco', intensityLabel: 'Repetições', description: 'Cópias das palavras de impacto.', ...IMPACT_CHOREO.echo },
  },
  exit: IMPACT_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'assetId'], 'Imagem do produto (PNG)', 'image'),
    field.color([...base, 'props', 'colorA'], 'Cor A', false),
    field.color([...base, 'props', 'colorB'], 'Cor B', false),
    field.list([...base, 'props', 'words'], 'Palavras de impacto', {
      min: 3,
      max: 3,
      itemLabel: 'Palavra',
      titlePath: ['text'],
      newItem: { text: 'Wow' },
      itemFields: [field.text(['text'], 'Texto', { maxLength: 12 })],
    }),
  ],
});
