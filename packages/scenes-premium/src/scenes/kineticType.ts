import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const KINETIC_DIRECTIONS = ['right', 'left', 'up', 'down'] as const;

export const kineticTypeSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('kinetic-type'),
  duration: z.number().min(3).max(8),
  texts: z.object({ tag: textElementSchema, headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({
    blocks: graphicElementSchema,
    stripes: graphicElementSchema,
    echo: graphicElementSchema,
    /** Blinking square before the kicker (added in 1.x; older documents get the accent default). */
    marker: graphicElementSchema.default(() => graphic('$accent')),
  }),
  animation: animationSchema,
  props: z.object({
    /** Travel direction of the entrance (masks, blocks and characters). */
    direction: z.enum(KINETIC_DIRECTIONS),
    /** Characters animate one by one, or words as solid blocks. */
    split: z.enum(['chars', 'words']),
  }),
});
export type KineticTypeScene = z.infer<typeof kineticTypeSchema>;

export const KINETIC_CHOREO = {
  stripes: { in: 0, dur: 0.8 },
  echo: { in: 0.1, dur: 1.2 },
  tag: { in: 0.05, dur: 0.6 },
  marker: { in: 0.05, dur: 0.6 },
  blocks: { in: 0.15, dur: 0.9 },
  headline: { in: 0.22, dur: 1.1 },
  sub: { in: 1.15, dur: 0.7 },
  exit: 0.6,
} as const;

export const kineticTypeType = premiumSceneType<KineticTypeScene>({
  id: 'kinetic-type',
  name: 'Kinetic Type Explosion',
  description: 'Tipografia gigante construída por blocos: máscaras direcionais, stagger por caractere e faixas cinéticas ao fundo.',
  category: 'typography',
  heroTime: 2.3,
  duration: { default: 4, min: 3, max: 8 },
  schema: kineticTypeSchema,
  palette: { background: '#0A0A0F', foreground: '#F6F4EF', accent: '#FF4D2E', secondary: '#3B3BFF', surface: '#17171F' },
  create: (init) => ({
    id: init.id,
    type: 'kinetic-type',
    name: init.name,
    duration: 4,
    ...baseInstance('void', ['start', 'start']),
    texts: {
      tag: text('/// 01 — Type in motion', { weight: 500, uppercase: true, tracking: 0.18, color: '$accent', breaks: ['single', 'single'] }),
      headline: text('Break\nthe grid', { stretch: 'expanded', tracking: -0.03, breaks: ['words', 'manual'] }),
      sub: text('Kinetic typography, rendered frame by frame.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'single'] }),
    },
    elements: { blocks: graphic('$accent'), stripes: graphic('$secondary', 0.55, 1), echo: graphic('$foreground', 0.1, 1), marker: graphic('$accent') },
    animation: { intensity: 1, pace: 1 },
    props: { direction: 'right', split: 'chars' },
  }),
  texts: {
    tag: { label: 'Kicker', maxLength: 40, multiline: false, ...KINETIC_CHOREO.tag },
    headline: { label: 'Headline', maxLength: 40, multiline: true, ...KINETIC_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 90, multiline: true, ...KINETIC_CHOREO.sub },
  },
  graphics: {
    blocks: { label: 'Blocos de revelação', intensityLabel: 'Espessura', description: 'Barras que varrem cada palavra e revelam o texto.', ...KINETIC_CHOREO.blocks },
    stripes: { label: 'Faixas cinéticas', intensityLabel: 'Quantidade', description: 'Faixas diagonais em movimento ao fundo.', ...KINETIC_CHOREO.stripes },
    marker: { label: 'Marcador do kicker', intensityLabel: 'Tamanho', description: 'Quadrado que pisca antes do kicker.', ...KINETIC_CHOREO.marker },
    echo: { label: 'Eco tipográfico', intensityLabel: 'Escala', description: 'Contorno gigante da primeira palavra, em parallax.', ...KINETIC_CHOREO.echo },
  },
  exit: KINETIC_CHOREO.exit,
  animationFields: (base) => [
    field.select([...base, 'props', 'direction'], 'Direção da entrada', [
      { value: 'right', label: '→' },
      { value: 'left', label: '←' },
      { value: 'up', label: '↑' },
      { value: 'down', label: '↓' },
    ], true),
    field.select([...base, 'props', 'split'], 'Animar por', [
      { value: 'chars', label: 'Caracteres' },
      { value: 'words', label: 'Palavras' },
    ], true),
  ],
});
