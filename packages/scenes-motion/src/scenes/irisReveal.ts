import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

export const REVEAL_PRESETS = ['iris', 'diagonal', 'burst', 'liquid', 'aperture'] as const;
export type RevealPreset = (typeof REVEAL_PRESETS)[number];

export const irisRevealSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('iris-reveal'),
  duration: z.number().min(3).max(9),
  texts: z.object({ cover: textElementSchema, headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ curtain: graphicElementSchema, edge: graphicElementSchema, content: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    preset: z.enum(REVEAL_PRESETS),
    /** Where the mask opens from. */
    origin: z.enum(['center', 'left', 'right', 'top', 'bottom']),
    /** Optional image revealed by the mask (procedural art otherwise). */
    assetId: z.string().nullable(),
    /** Seconds the mask takes to open. */
    revealDuration: z.number().min(0.5).max(2.5),
  }),
});
export type IrisRevealScene = z.infer<typeof irisRevealSchema>;

export const IRIS_CHOREO = {
  cover: { in: 0, dur: 0.6 },
  curtain: { in: 0, dur: 0.6 },
  edge: { in: 0.7, dur: 1.2 },
  content: { in: 0.7, dur: 1.2 },
  headline: { in: 1.6, dur: 0.8 },
  sub: { in: 2, dur: 0.6 },
  exit: 0.6,
} as const;

export const irisRevealType = motionSceneType<IrisRevealScene>({
  id: 'iris-reveal',
  name: 'Iris & Liquid Reveal',
  description: 'Revelação por máscaras animadas: íris, wipe diagonal, explosão radial, forma líquida ou abertura geométrica.',
  category: 'abstract',
  heroTime: 2.8,
  duration: { default: 4, min: 3, max: 9 },
  schema: irisRevealSchema,
  palette: { background: '#0A0A0E', foreground: '#FFFFFF', accent: '#FF6A3D', secondary: '#3C2BFF', surface: '#18161F' },
  create: (init) => ({
    id: init.id,
    type: 'iris-reveal',
    name: init.name,
    duration: 4,
    ...baseInstance('aurora', ['center', 'start']),
    texts: {
      cover: text('Open', { weight: 900, stretch: 'expanded', tracking: -0.04, color: '$background', breaks: ['single', 'single'] }),
      headline: text('See it\ndifferently', { weight: 800, uppercase: false, tracking: -0.035, breaks: ['manual', 'manual'] }),
      sub: text('Reveals that mean something.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'single'] }),
    },
    elements: { curtain: graphic('$accent', 1, 1), edge: graphic('#FFFFFF', 0.9, 1), content: graphic('$secondary', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { preset: 'iris', origin: 'center', assetId: null, revealDuration: 1.1 },
  }),
  texts: {
    cover: { label: 'Texto de capa', maxLength: 16, multiline: false, ...IRIS_CHOREO.cover },
    headline: { label: 'Texto principal', maxLength: 40, multiline: true, ...IRIS_CHOREO.headline },
    sub: { label: 'Texto secundário', maxLength: 80, multiline: true, ...IRIS_CHOREO.sub },
  },
  graphics: {
    curtain: { label: 'Camada de capa', intensityLabel: 'Textura', description: 'Cor sólida que a máscara abre.', ...IRIS_CHOREO.curtain },
    edge: { label: 'Borda da máscara', intensityLabel: 'Espessura', description: 'Contorno luminoso que acompanha a abertura.', ...IRIS_CHOREO.edge },
    content: { label: 'Conteúdo revelado', intensityLabel: 'Profundidade', description: 'Arte procedural (ou a imagem escolhida em Cena).', ...IRIS_CHOREO.content },
  },
  exit: IRIS_CHOREO.exit,
  contentFields: (base) => [
    field.select([...base, 'props', 'preset'], 'Máscara', [
      { value: 'iris', label: 'Íris circular' },
      { value: 'diagonal', label: 'Wipe diagonal' },
      { value: 'burst', label: 'Explosão radial' },
      { value: 'liquid', label: 'Forma líquida' },
      { value: 'aperture', label: 'Abertura geométrica' },
    ]),
    field.select([...base, 'props', 'origin'], 'Origem', [
      { value: 'center', label: 'Centro' },
      { value: 'left', label: 'Esq.' },
      { value: 'right', label: 'Dir.' },
      { value: 'top', label: 'Topo' },
      { value: 'bottom', label: 'Base' },
    ], true),
    field.asset([...base, 'props', 'assetId'], 'Imagem revelada (opcional)', 'image'),
  ],
  animationFields: (base) => [field.number([...base, 'props', 'revealDuration'], 'Tempo da revelação', { min: 0.5, max: 2.5, step: 0.05, unit: 's' })],
});
