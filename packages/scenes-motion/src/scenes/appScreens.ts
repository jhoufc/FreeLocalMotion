import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';
import { APP_SCREEN_IDS, APP_SCREEN_OPTIONS, DEVICE_MODEL_IDS, DEVICE_OPTIONS } from './floatingPhone';

export const appScreenItemSchema = z.object({
  assetId: z.string().nullable(),
  /** Procedural screen used when there is no screenshot. */
  variant: z.enum(APP_SCREEN_IDS),
  caption: z.string().max(48),
});

export const appScreensSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('app-screens'),
  duration: z.number().min(3.5).max(12),
  texts: z.object({ title: textElementSchema }),
  elements: z.object({ device: graphicElementSchema, captions: graphicElementSchema, echo: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    screens: z.array(appScreenItemSchema).min(2).max(5),
    transition: z.enum(['slide', 'mask', 'zoom', 'parallax', 'blur']),
    direction: z.enum(['left', 'right', 'up']),
    model: z.enum(DEVICE_MODEL_IDS),
    /** Seconds each screen-to-screen transition takes. */
    transitionDuration: z.number().min(0.3).max(1.2),
  }),
});
export type AppScreensScene = z.infer<typeof appScreensSchema>;

export const SCREENS_CHOREO = {
  device: { in: 0, dur: 1 },
  title: { in: 0.3, dur: 0.8 },
  captions: { in: 0.6, dur: 0.6 },
  echo: { in: 1, dur: 3 },
  exit: 0.55,
} as const;

export const appScreensType = motionSceneType<AppScreensScene>({
  id: 'app-screens',
  name: 'App Screen Transition',
  description: 'Sequência de telas no dispositivo: deslocamento, máscara, zoom, parallax ou blur entre screenshots, com legendas sincronizadas.',
  category: 'technology',
  heroTime: 2.2,
  duration: { default: 6, min: 3.5, max: 12 },
  schema: appScreensSchema,
  palette: { background: '#08090F', foreground: '#F2F3FA', accent: '#FFB13D', secondary: '#4D7BFF', surface: '#141726' },
  create: (init) => ({
    id: init.id,
    type: 'app-screens',
    name: init.name,
    duration: 6,
    ...baseInstance('radial', ['center', 'start']),
    texts: { title: text('Everything flows', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['auto', 'manual'] }) },
    elements: { device: graphic('$foreground', 1, 1), captions: graphic('$foreground', 1, 1), echo: graphic('$accent', 0.35, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      screens: [
        { assetId: null, variant: 'home', caption: 'See your whole week at a glance' },
        { assetId: null, variant: 'stats', caption: 'Understand where it goes' },
        { assetId: null, variant: 'checkout', caption: 'Pay in one tap' },
      ],
      transition: 'parallax',
      direction: 'left',
      model: 'midnight',
      transitionDuration: 0.7,
    },
  }),
  texts: { title: { label: 'Título', maxLength: 40, multiline: true, ...SCREENS_CHOREO.title } },
  graphics: {
    device: { label: 'Dispositivo', intensityLabel: 'Sombra', description: 'Modelo e telas em Cena.', ...SCREENS_CHOREO.device },
    captions: { label: 'Legendas', intensityLabel: 'Tamanho', description: 'Texto de cada tela (em Cena › Telas).', ...SCREENS_CHOREO.captions },
    echo: { label: 'Echo trail', intensityLabel: 'Quantidade', description: 'Rastro da tela que sai durante a transição.', ...SCREENS_CHOREO.echo },
  },
  exit: SCREENS_CHOREO.exit,
  contentFields: (base) => [
    field.list([...base, 'props', 'screens'], 'Telas', {
      min: 2,
      max: 5,
      itemLabel: 'Tela',
      titlePath: ['caption'],
      newItem: { assetId: null, variant: 'profile', caption: 'Make it yours' },
      itemFields: [
        field.asset(['assetId'], 'Screenshot', 'image'),
        field.select(['variant'], 'Tela procedural (sem screenshot)', APP_SCREEN_OPTIONS),
        field.text(['caption'], 'Legenda', { maxLength: 48 }),
      ],
    }),
    field.select([...base, 'props', 'model'], 'Cor do dispositivo', DEVICE_OPTIONS, true),
  ],
  animationFields: (base) => [
    field.select([...base, 'props', 'transition'], 'Estilo de transição', [
      { value: 'slide', label: 'Deslocamento' },
      { value: 'mask', label: 'Máscara' },
      { value: 'zoom', label: 'Zoom' },
      { value: 'parallax', label: 'Parallax' },
      { value: 'blur', label: 'Blur' },
    ]),
    field.select([...base, 'props', 'direction'], 'Direção', [
      { value: 'left', label: '←' },
      { value: 'right', label: '→' },
      { value: 'up', label: '↑' },
    ], true),
    field.number([...base, 'props', 'transitionDuration'], 'Velocidade da transição', { min: 0.3, max: 1.2, step: 0.05, unit: 's' }),
  ],
});
