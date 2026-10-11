import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

/* ------------------------------------------------------------------ */
/* 11 — Animated Infographic                                           */
/* ------------------------------------------------------------------ */

export const WIDGET_KINDS = ['counter', 'bar', 'line', 'ring'] as const;

/**
 * One indicator. Every number shown comes from these fields — the scene never invents
 * data: a bar/ring shows value/max, a line chart plots exactly the `series` typed.
 */
export const infoWidgetSchema = z.object({
  kind: z.enum(WIDGET_KINDS),
  label: z.string().min(1).max(28),
  value: z.number().min(-1e9).max(1e9),
  max: z.number().min(0.0001).max(1e9),
  unit: z.string().max(6),
  decimals: z.number().int().min(0).max(2),
  /** Comma-separated values for line charts, e.g. "12, 18, 9, 25". */
  series: z.string().max(120).regex(/^[\d\s.,-]*$/, 'Use números separados por vírgula'),
});
export type InfoWidget = z.infer<typeof infoWidgetSchema>;

export const parseSeries = (s: string): number[] =>
  s
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0) // an empty entry is not a zero
    .map(Number)
    .filter((v) => Number.isFinite(v))
    .slice(0, 24);

export const infographicSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('infographic'),
  duration: z.number().min(3.5).max(9),
  texts: z.object({ title: textElementSchema, note: textElementSchema }),
  elements: z.object({ cards: graphicElementSchema, charts: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    widgets: z.array(infoWidgetSchema).min(1).max(4),
    entry: z.enum(['stagger', 'cascade', 'pop']),
  }),
});
export type InfographicScene = z.infer<typeof infographicSchema>;

export const INFO_CHOREO = {
  title: { in: 0.1, dur: 0.8 },
  cards: { in: 0.5, dur: 1 },
  charts: { in: 0.8, dur: 1.6 },
  note: { in: 2.2, dur: 0.6 },
  exit: 0.55,
} as const;

export const infographicType = motionSceneType<InfographicScene>({
  id: 'infographic',
  name: 'Animated Infographic',
  description: 'Indicadores animados — contador, barra de progresso, gráfico de linha e porcentagem circular — com os seus dados.',
  category: 'data',
  heroTime: 3.2,
  duration: { default: 5, min: 3.5, max: 9 },
  schema: infographicSchema,
  palette: { background: '#0A0B10', foreground: '#F1F3F9', accent: '#38F0A4', secondary: '#6C7BFF', surface: '#14161F' },
  create: (init) => ({
    id: init.id,
    type: 'infographic',
    name: init.name,
    duration: 5,
    ...baseInstance('void', ['start', 'start']),
    texts: {
      title: text('Q3 in numbers', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['auto', 'single'] }),
      note: text('Source: internal dashboard, Jul–Sep.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'single'] }),
    },
    elements: { cards: graphic('$surface', 1, 1), charts: graphic('$accent', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      widgets: [
        { kind: 'counter', label: 'Active users', value: 48200, max: 50000, unit: '', decimals: 0, series: '' },
        { kind: 'ring', label: 'Retention', value: 87, max: 100, unit: '%', decimals: 0, series: '' },
        { kind: 'line', label: 'Weekly revenue (k$)', value: 31, max: 40, unit: 'k', decimals: 0, series: '12, 15, 14, 19, 22, 21, 27, 31' },
        { kind: 'bar', label: 'Goal progress', value: 7.4, max: 10, unit: 'M', decimals: 1, series: '' },
      ],
      entry: 'stagger',
    },
  }),
  texts: {
    title: { label: 'Título', maxLength: 40, multiline: true, ...INFO_CHOREO.title },
    note: { label: 'Nota / fonte', maxLength: 80, multiline: false, ...INFO_CHOREO.note },
  },
  graphics: {
    cards: { label: 'Cards', intensityLabel: 'Borda', description: 'Fundo dos indicadores.', ...INFO_CHOREO.cards },
    charts: { label: 'Gráficos', intensityLabel: 'Espessura', description: 'Cor das barras, linhas e anéis.', ...INFO_CHOREO.charts },
  },
  exit: INFO_CHOREO.exit,
  contentFields: (base) => [
    field.list([...base, 'props', 'widgets'], 'Indicadores', {
      min: 1,
      max: 4,
      itemLabel: 'Indicador',
      titlePath: ['label'],
      newItem: { kind: 'counter', label: 'New metric', value: 100, max: 100, unit: '', decimals: 0, series: '' },
      itemFields: [
        field.select(['kind'], 'Tipo de gráfico', [
          { value: 'counter', label: 'Contador' },
          { value: 'bar', label: 'Barra' },
          { value: 'line', label: 'Linha' },
          { value: 'ring', label: 'Anel %' },
        ], true),
        field.text(['label'], 'Rótulo', { maxLength: 28 }),
        field.number(['value'], 'Valor', { min: 0, max: 1_000_000, step: 0.1 }),
        field.number(['max'], 'Máximo (barra/anel)', { min: 0.1, max: 1_000_000, step: 0.1 }),
        field.text(['unit'], 'Unidade', { maxLength: 6 }),
        field.select(['decimals'], 'Casas decimais', [
          { value: 0, label: '0' },
          { value: 1, label: '1' },
          { value: 2, label: '2' },
        ], true),
        field.text(['series'], 'Série (gráfico de linha)', { maxLength: 120, placeholder: '12, 18, 9, 25' }),
      ],
    }),
  ],
  animationFields: (base) => [
    field.select([...base, 'props', 'entry'], 'Estilo de entrada', [
      { value: 'stagger', label: 'Stagger' },
      { value: 'cascade', label: 'Cascata' },
      { value: 'pop', label: 'Pop' },
    ], true),
  ],
});

/* ------------------------------------------------------------------ */
/* 12 — Personal Brand Reveal                                          */
/* ------------------------------------------------------------------ */

export const brandRevealSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('brand-reveal'),
  duration: z.number().min(4).max(9),
  texts: z.object({ headline: textElementSchema, name: textElementSchema, role: textElementSchema, handle: textElementSchema, cta: textElementSchema }),
  elements: z.object({ line: graphicElementSchema, photo: graphicElementSchema, button: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** Portrait photo; a monogram of the name is drawn without it. */
    photoAssetId: z.string().nullable(),
    photoShape: z.enum(['circle', 'rounded']),
    highlights: z.array(z.object({ value: z.number().min(0).max(1e9), suffix: z.string().max(4), label: z.string().max(20) })).max(3),
  }),
});
export type BrandRevealScene = z.infer<typeof brandRevealSchema>;

export const BRAND_CHOREO = {
  line: { in: 0, dur: 1.1 },
  photo: { in: 0.5, dur: 1 },
  headline: { in: 0.9, dur: 0.7 },
  name: { in: 1.2, dur: 0.8 },
  role: { in: 1.55, dur: 0.6 },
  handle: { in: 2.6, dur: 0.6 },
  button: { in: 2.9, dur: 0.7 },
  cta: { in: 3, dur: 0.6 },
  exit: 0.6,
} as const;

export const brandRevealType = motionSceneType<BrandRevealScene>({
  id: 'brand-reveal',
  name: 'Personal Brand Reveal',
  description: 'Apresentação premium de criador ou profissional: linha que desenha o quadro, foto por máscara, nome em stagger, números, @ e CTA.',
  category: 'signature',
  heroTime: 3.6,
  duration: { default: 5.5, min: 4, max: 9 },
  schema: brandRevealSchema,
  palette: { background: '#0B0B0D', foreground: '#F5F2EC', accent: '#E9C46A', secondary: '#E76F51', surface: '#18181C' },
  create: (init) => ({
    id: init.id,
    type: 'brand-reveal',
    name: init.name,
    duration: 5.5,
    ...baseInstance('void', ['center', 'start']),
    texts: {
      headline: text('Hi, I am', { weight: 500, uppercase: true, tracking: 0.2, color: '$accent', breaks: ['single', 'single'] }),
      name: text('Marina Costa', { weight: 900, uppercase: false, tracking: -0.035, breaks: ['auto', 'manual'] }),
      role: text('Motion designer & creative director', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
      handle: text('@marinamotion', { weight: 600, uppercase: false, tracking: 0.02, breaks: ['single', 'single'] }),
      cta: text('Follow for daily motion', { weight: 700, uppercase: false, tracking: 0, color: '$background', breaks: ['single', 'single'] }),
    },
    elements: { line: graphic('$accent', 1, 1), photo: graphic('$accent', 1, 1), button: graphic('$accent', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      photoAssetId: null,
      photoShape: 'circle',
      highlights: [
        { value: 120, suffix: 'K', label: 'followers' },
        { value: 8, suffix: '', label: 'years in motion' },
        { value: 300, suffix: '+', label: 'projects' },
      ],
    },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 32, multiline: false, ...BRAND_CHOREO.headline },
    name: { label: 'Nome', maxLength: 32, multiline: true, ...BRAND_CHOREO.name },
    role: { label: 'Cargo', maxLength: 60, multiline: true, ...BRAND_CHOREO.role },
    handle: { label: '@ do Instagram', maxLength: 32, multiline: false, ...BRAND_CHOREO.handle },
    cta: { label: 'CTA', maxLength: 32, multiline: false, ...BRAND_CHOREO.cta },
  },
  graphics: {
    line: { label: 'Linha gráfica', intensityLabel: 'Espessura', description: 'Traço que desenha a moldura e a assinatura.', ...BRAND_CHOREO.line },
    photo: { label: 'Foto', intensityLabel: 'Brilho do aro', description: 'Foto ou monograma (imagem em Cena).', ...BRAND_CHOREO.photo },
    button: { label: 'Botão do CTA', intensityLabel: 'Pulso', description: 'Pílula do chamado para ação.', ...BRAND_CHOREO.button },
  },
  exit: BRAND_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'photoAssetId'], 'Foto (opcional)', 'image'),
    field.select([...base, 'props', 'photoShape'], 'Formato da foto', [
      { value: 'circle', label: 'Circular' },
      { value: 'rounded', label: 'Retangular' },
    ], true),
    field.list([...base, 'props', 'highlights'], 'Destaques', {
      min: 0,
      max: 3,
      itemLabel: 'Destaque',
      titlePath: ['label'],
      newItem: { value: 10, suffix: '+', label: 'awards' },
      itemFields: [
        field.number(['value'], 'Número', { min: 0, max: 1_000_000, step: 1 }),
        field.text(['suffix'], 'Sufixo', { maxLength: 4 }),
        field.text(['label'], 'Rótulo', { maxLength: 20 }),
      ],
    }),
  ],
});
