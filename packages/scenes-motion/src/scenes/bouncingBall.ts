import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

export const bouncingBallSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('bouncing-ball'),
  duration: z.number().min(3).max(7),
  texts: z.object({ headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ ball: graphicElementSchema, trail: graphicElementSchema, floor: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    bounces: z.number().int().min(2).max(6),
    /** 0.3 = dead, 0.8 = rubbery. */
    elasticity: z.number().min(0.3).max(0.8),
    /** Speed multiplier of the whole bounce. */
    speed: z.number().min(0.6).max(1.6),
    /** Ball diameter multiplier. */
    size: z.number().min(0.5).max(1.6),
    /** Where the ball ends: as the dot of the first "i"/"j", as a final period, or above the text. */
    landing: z.enum(['dot-i', 'period', 'above']),
  }),
});
export type BouncingBallScene = z.infer<typeof bouncingBallSchema>;

export const BOUNCE_CHOREO = {
  ball: { in: 0, dur: 2.3 },
  floor: { in: 0, dur: 0.6 },
  trail: { in: 0.4, dur: 1.8 },
  headline: { in: 0.5, dur: 1.9 },
  sub: { in: 2.5, dur: 0.6 },
  exit: 0.55,
} as const;

export const bouncingBallType = motionSceneType<BouncingBallScene>({
  id: 'bouncing-ball',
  name: 'Bouncing Ball Typography',
  description: 'Uma bola com squash & stretch, antecipação e follow-through quica pelas letras e vira o pingo do “i” (ou o ponto final).',
  category: 'typography',
  heroTime: 3.3,
  duration: { default: 4.5, min: 3, max: 7 },
  schema: bouncingBallSchema,
  palette: { background: '#F3EEE6', foreground: '#141210', accent: '#FF4B2B', secondary: '#2F5BFF', surface: '#E6DFD3' },
  create: (init) => ({
    id: init.id,
    type: 'bouncing-ball',
    name: init.name,
    duration: 4.5,
    ...baseInstance('void', ['center', 'center']),
    texts: {
      headline: text('motion is life', { weight: 900, uppercase: false, tracking: -0.04, breaks: ['single', 'single'] }),
      sub: text('Squash, stretch, anticipation, follow-through.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'single'] }),
    },
    elements: { ball: graphic('$accent', 1, 1), trail: graphic('$accent', 0.35, 1), floor: graphic('$foreground', 0.25, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { bounces: 4, elasticity: 0.55, speed: 1, size: 1, landing: 'dot-i' },
  }),
  texts: {
    headline: { label: 'Texto final', maxLength: 28, multiline: false, ...BOUNCE_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 80, multiline: true, ...BOUNCE_CHOREO.sub },
  },
  graphics: {
    ball: { label: 'Bola', intensityLabel: 'Brilho', description: 'Cor e acabamento da bola.', ...BOUNCE_CHOREO.ball },
    trail: { label: 'Rastro', intensityLabel: 'Comprimento', description: 'Eco da trajetória.', ...BOUNCE_CHOREO.trail },
    floor: { label: 'Chão e sombra', intensityLabel: 'Sombra', description: 'Linha de base e sombra de contato.', ...BOUNCE_CHOREO.floor },
  },
  exit: BOUNCE_CHOREO.exit,
  contentFields: (base) => [
    field.select([...base, 'props', 'landing'], 'Posição final da bola', [
      { value: 'dot-i', label: 'Pingo do i' },
      { value: 'period', label: 'Ponto final' },
      { value: 'above', label: 'Acima' },
    ], true),
    field.number([...base, 'props', 'size'], 'Tamanho da bola', { min: 0.5, max: 1.6, step: 0.01, unit: '%', displayScale: 100 }),
  ],
  animationFields: (base) => [
    field.number([...base, 'props', 'bounces'], 'Quantidade de quiques', { min: 2, max: 6, step: 1 }),
    field.number([...base, 'props', 'elasticity'], 'Intensidade elástica', { min: 0.3, max: 0.8, step: 0.01, unit: '×' }),
    field.number([...base, 'props', 'speed'], 'Velocidade', { min: 0.6, max: 1.6, step: 0.01, unit: '×' }),
  ],
});
