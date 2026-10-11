import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

/**
 * Shape sequences. Morphing only happens between shapes of the built-in vocabulary
 * (resampled to the same point count) — arbitrary SVGs are not morph sources.
 */
export const MORPH_PRESETS = {
  flow: ['line', 'circle', 'arrow', 'star'],
  growth: ['line', 'wave', 'chart', 'arrow'],
  love: ['line', 'circle', 'heart', 'infinity'],
  success: ['line', 'square', 'check', 'spark'],
  orbit: ['line', 'circle', 'triangle', 'infinity'],
} as const;
export type MorphPreset = keyof typeof MORPH_PRESETS;

export const morphLineSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('morph-line'),
  duration: z.number().min(3).max(8),
  texts: z.object({ headline: textElementSchema, caption: textElementSchema }),
  elements: z.object({ line: graphicElementSchema, echo: graphicElementSchema, spark: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    preset: z.enum(Object.keys(MORPH_PRESETS) as [MorphPreset, ...MorphPreset[]]),
    thickness: z.number().min(1).max(24),
    /** Portion of each shape's outline that is drawn (1 = full shape). */
    length: z.number().min(0.25).max(1),
    speed: z.number().min(0.6).max(1.6),
    direction: z.enum(['clockwise', 'counter']),
  }),
});
export type MorphLineScene = z.infer<typeof morphLineSchema>;

export const MORPH_CHOREO = {
  line: { in: 0, dur: 0.7 },
  echo: { in: 0.9, dur: 2 },
  spark: { in: 0.2, dur: 2.5 },
  headline: { in: 2.6, dur: 0.8 },
  caption: { in: 3, dur: 0.6 },
  exit: 0.55,
} as const;

export const morphLineType = motionSceneType<MorphLineScene>({
  id: 'morph-line',
  name: 'Morphing Line Art',
  description: 'Uma linha se desenha e se transforma: círculo, seta, símbolo — morphing geométrico com rastro e faísca no traço.',
  category: 'abstract',
  heroTime: 3.4,
  duration: { default: 4.5, min: 3, max: 8 },
  schema: morphLineSchema,
  palette: { background: '#08090E', foreground: '#F2F4FA', accent: '#FFC94D', secondary: '#4D8DFF', surface: '#141722' },
  create: (init) => ({
    id: init.id,
    type: 'morph-line',
    name: init.name,
    duration: 4.5,
    ...baseInstance('void', ['center', 'center']),
    texts: {
      headline: text('Ideas take shape', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['auto', 'single'] }),
      caption: text('One line. Infinite forms.', { weight: 400, uppercase: false, tracking: 0, breaks: ['single', 'single'] }),
    },
    elements: { line: graphic('$accent', 1, 1), echo: graphic('$secondary', 0.45, 1), spark: graphic('#FFFFFF', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { preset: 'flow', thickness: 8, length: 1, speed: 1, direction: 'clockwise' },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 40, multiline: true, ...MORPH_CHOREO.headline },
    caption: { label: 'Legenda', maxLength: 60, multiline: false, ...MORPH_CHOREO.caption },
  },
  graphics: {
    line: { label: 'Linha', intensityLabel: 'Brilho', description: 'Cor e brilho do traço.', ...MORPH_CHOREO.line },
    echo: { label: 'Eco da forma', intensityLabel: 'Quantidade', description: 'Cópias da forma anterior que se dissolvem.', ...MORPH_CHOREO.echo },
    spark: { label: 'Faísca', intensityLabel: 'Tamanho', description: 'Ponto de luz que percorre o traço.', ...MORPH_CHOREO.spark },
  },
  exit: MORPH_CHOREO.exit,
  contentFields: (base) => [
    field.select([...base, 'props', 'preset'], 'Sequência de formas', [
      { value: 'flow', label: 'Linha → círculo → seta → estrela' },
      { value: 'growth', label: 'Linha → onda → gráfico → seta' },
      { value: 'love', label: 'Linha → círculo → coração → infinito' },
      { value: 'success', label: 'Linha → quadrado → check → faísca' },
      { value: 'orbit', label: 'Linha → círculo → triângulo → infinito' },
    ]),
    field.number([...base, 'props', 'thickness'], 'Espessura', { min: 1, max: 24, step: 0.5, unit: 'px' }),
    field.number([...base, 'props', 'length'], 'Comprimento do percurso', { min: 0.25, max: 1, step: 0.01, unit: '%', displayScale: 100 }),
    field.select([...base, 'props', 'direction'], 'Direção', [
      { value: 'clockwise', label: 'Horário' },
      { value: 'counter', label: 'Anti-horário' },
    ], true),
  ],
  animationFields: (base) => [field.number([...base, 'props', 'speed'], 'Velocidade', { min: 0.6, max: 1.6, step: 0.01, unit: '×' })],
});
