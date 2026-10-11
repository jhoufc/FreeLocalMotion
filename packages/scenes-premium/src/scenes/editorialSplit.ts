import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const editorialSplitSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('editorial-split'),
  duration: z.number().min(3.5).max(6.5),
  texts: z.object({ blockA: textElementSchema, blockB: textElementSchema, aux: textElementSchema }),
  elements: z.object({ panelA: graphicElementSchema, panelB: graphicElementSchema, rules: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** `auto`: side by side in 16:9, stacked in 9:16. */
    direction: z.enum(['auto', 'vertical', 'horizontal']),
    /** Share of the frame taken by panel A. */
    ratio: z.number().min(0.3).max(0.7),
  }),
});
export type EditorialSplitScene = z.infer<typeof editorialSplitSchema>;

export const EDITORIAL_CHOREO = {
  rules: { in: 0, dur: 0.6 },
  panelA: { in: 0.15, dur: 0.7 },
  panelB: { in: 0.3, dur: 0.7 },
  blockA: { in: 0.65, dur: 0.85 },
  blockB: { in: 0.95, dur: 0.85 },
  aux: { in: 1.35, dur: 0.6 },
  exit: 0.65,
} as const;

export const editorialSplitType = premiumSceneType<EditorialSplitScene>({
  id: 'editorial-split',
  name: 'Editorial Split',
  description: 'Tela dividida com hierarquia editorial: painéis direcionais, tipografia por máscaras, linhas gráficas e índices.',
  category: 'editorial',
  heroTime: 2.4,
  duration: { default: 4.5, min: 3.5, max: 6.5 },
  schema: editorialSplitSchema,
  palette: { background: '#F1EDE4', foreground: '#141312', accent: '#E8432F', secondary: '#141312', surface: '#E3DDD0' },
  create: (init) => ({
    id: init.id,
    type: 'editorial-split',
    name: init.name,
    duration: 4.5,
    ...baseInstance('void', ['start', 'start']),
    texts: {
      blockA: text('Less\nnoise', { weight: 900, stretch: 'condensed', tracking: -0.02, color: '$background', breaks: ['manual', 'manual'] }),
      blockB: text('More\nsignal.', { weight: 300, stretch: 'normal', uppercase: false, tracking: -0.04, color: '$foreground', breaks: ['manual', 'manual'] }),
      aux: text('Issue 07 — Motion as an editorial language', { weight: 500, uppercase: true, tracking: 0.14, color: '$foreground', breaks: ['auto', 'single'] }),
    },
    elements: { panelA: graphic('$accent', 1, 1), panelB: graphic('$surface', 1, 1), rules: graphic('$foreground', 0.8, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { direction: 'auto', ratio: 0.5 },
  }),
  texts: {
    blockA: { label: 'Bloco A', maxLength: 32, multiline: true, ...EDITORIAL_CHOREO.blockA },
    blockB: { label: 'Bloco B', maxLength: 32, multiline: true, ...EDITORIAL_CHOREO.blockB },
    aux: { label: 'Texto auxiliar', maxLength: 60, multiline: false, ...EDITORIAL_CHOREO.aux },
  },
  graphics: {
    panelA: { label: 'Painel A', intensityLabel: 'Textura', description: 'Cor do primeiro painel.', ...EDITORIAL_CHOREO.panelA },
    panelB: { label: 'Painel B', intensityLabel: 'Textura', description: 'Cor do segundo painel.', ...EDITORIAL_CHOREO.panelB },
    rules: { label: 'Linhas e índices', intensityLabel: 'Espessura', description: 'Filetes, marcas de índice e divisor.', ...EDITORIAL_CHOREO.rules },
  },
  exit: EDITORIAL_CHOREO.exit,
  animationFields: (base) => [
    field.select([...base, 'props', 'direction'], 'Divisão', [
      { value: 'auto', label: 'Auto' },
      { value: 'vertical', label: 'Lado a lado' },
      { value: 'horizontal', label: 'Empilhada' },
    ], true),
    field.number([...base, 'props', 'ratio'], 'Proporção da divisão', { min: 0.3, max: 0.7, step: 0.01, unit: '%', displayScale: 100 }),
  ],
});
