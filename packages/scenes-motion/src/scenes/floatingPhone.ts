import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

export const DEVICE_MODEL_IDS = ['graphite', 'silver', 'midnight', 'gold'] as const;
export const APP_SCREEN_IDS = ['home', 'stats', 'chat', 'profile', 'checkout'] as const;
export const APP_SCREEN_OPTIONS = [
  { value: 'home', label: 'Início (procedural)' },
  { value: 'stats', label: 'Analytics (procedural)' },
  { value: 'chat', label: 'Chat (procedural)' },
  { value: 'profile', label: 'Perfil (procedural)' },
  { value: 'checkout', label: 'Checkout (procedural)' },
] as const;
export const DEVICE_OPTIONS = [
  { value: 'graphite', label: 'Grafite' },
  { value: 'silver', label: 'Prata' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'gold', label: 'Dourado' },
] as const;

export const floatingPhoneSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('floating-phone'),
  duration: z.number().min(3.5).max(8),
  texts: z.object({ kicker: textElementSchema, headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ device: graphicElementSchema, glow: graphicElementSchema, reflection: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** App screenshot (portrait). Without it, a procedural screen is shown. */
    screenAssetId: z.string().nullable(),
    screenVariant: z.enum(APP_SCREEN_IDS),
    model: z.enum(DEVICE_MODEL_IDS),
    /** Amount of 3D perspective and camera orbit. */
    perspective: z.number().min(0).max(1.5),
    /** Resting rotation (deg) of the phone. */
    rotation: z.number().min(-35).max(35),
    scale: z.number().min(0.6).max(1.4),
    positionX: z.number().min(-0.3).max(0.3),
    positionY: z.number().min(-0.3).max(0.3),
  }),
});
export type FloatingPhoneScene = z.infer<typeof floatingPhoneSchema>;

export const PHONE_CHOREO = {
  device: { in: 0, dur: 1.4 },
  glow: { in: 0.2, dur: 1.2 },
  reflection: { in: 1.2, dur: 0.9 },
  kicker: { in: 0.6, dur: 0.6 },
  headline: { in: 0.8, dur: 0.9 },
  sub: { in: 1.25, dur: 0.7 },
  exit: 0.6,
} as const;

export const floatingPhoneType = motionSceneType<FloatingPhoneScene>({
  id: 'floating-phone',
  name: 'Floating Smartphone',
  description: 'Smartphone premium em perspectiva 3D (CSS): câmera simulada, rotação, zoom, reflexo e glow — com a screenshot do seu app.',
  category: 'technology',
  heroTime: 2.6,
  duration: { default: 5, min: 3.5, max: 8 },
  schema: floatingPhoneSchema,
  palette: { background: '#070912', foreground: '#F1F4FF', accent: '#6CF0FF', secondary: '#8A5CFF', surface: '#131830' },
  create: (init) => ({
    id: init.id,
    type: 'floating-phone',
    name: init.name,
    duration: 5,
    ...baseInstance('radial', ['center', 'start']),
    texts: {
      kicker: text('New app', { weight: 600, uppercase: true, tracking: 0.2, color: '$accent', breaks: ['single', 'single'] }),
      headline: text('Your money,\nfinally clear', { weight: 800, uppercase: false, tracking: -0.035, breaks: ['manual', 'manual'] }),
      sub: text('Track, plan and grow — all in one beautiful app.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
    },
    elements: { device: graphic('$foreground', 1, 1), glow: graphic('$accent', 0.8, 1), reflection: graphic('#FFFFFF', 0.6, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { screenAssetId: null, screenVariant: 'home', model: 'graphite', perspective: 1, rotation: -14, scale: 1, positionX: 0, positionY: 0 },
  }),
  texts: {
    kicker: { label: 'Kicker', maxLength: 28, multiline: false, ...PHONE_CHOREO.kicker },
    headline: { label: 'Headline', maxLength: 48, multiline: true, ...PHONE_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 100, multiline: true, ...PHONE_CHOREO.sub },
  },
  graphics: {
    device: { label: 'Dispositivo', intensityLabel: 'Sombra', description: 'Modelo e tela em Cena.', ...PHONE_CHOREO.device },
    glow: { label: 'Glow', intensityLabel: 'Tamanho', description: 'Halo de luz atrás do aparelho.', ...PHONE_CHOREO.glow },
    reflection: { label: 'Reflexo', intensityLabel: 'Intensidade', description: 'Brilho que varre o vidro.', ...PHONE_CHOREO.reflection },
  },
  exit: PHONE_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'screenAssetId'], 'Screenshot do app', 'image'),
    field.select([...base, 'props', 'screenVariant'], 'Tela procedural (sem screenshot)', APP_SCREEN_OPTIONS),
    field.select([...base, 'props', 'model'], 'Modelo do dispositivo', DEVICE_OPTIONS, true),
    field.number([...base, 'props', 'scale'], 'Escala', { min: 0.6, max: 1.4, step: 0.01, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'positionX'], 'Posição X', { min: -0.3, max: 0.3, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'positionY'], 'Posição Y', { min: -0.3, max: 0.3, step: 0.005, unit: '%', displayScale: 100 }),
  ],
  animationFields: (base) => [
    field.number([...base, 'props', 'perspective'], 'Intensidade da perspectiva', { min: 0, max: 1.5, step: 0.01, unit: '×' }),
    field.number([...base, 'props', 'rotation'], 'Rotação', { min: -35, max: 35, step: 1, unit: '°' }),
  ],
});
