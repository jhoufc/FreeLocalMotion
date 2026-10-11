import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const cinematicOutroSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('cinematic-outro'),
  duration: z.number().min(4).max(8),
  texts: z.object({ headline: textElementSchema, sub: textElementSchema, signature: textElementSchema }),
  elements: z.object({ emblem: graphicElementSchema, streaks: graphicElementSchema, flare: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** Optional logo shown inside the emblem ring. */
    logoAssetId: z.string().nullable(),
  }),
});
export type CinematicOutroScene = z.infer<typeof cinematicOutroSchema>;

export const OUTRO_CHOREO = {
  streaks: { in: 0, dur: 1.15 },
  flare: { in: 0.95, dur: 0.6 },
  emblem: { in: 0.9, dur: 1.2 },
  headline: { in: 1.55, dur: 0.9 },
  sub: { in: 2.05, dur: 0.7 },
  signature: { in: 2.45, dur: 0.7 },
  exit: 0.9,
} as const;

export const cinematicOutroType = premiumSceneType<CinematicOutroScene>({
  id: 'cinematic-outro',
  name: 'Cinematic Outro',
  description: 'Encerramento premium: rastros convergentes, emblema geométrico animado (ou logotipo), headline, subtítulo, assinatura e saída para o preto.',
  category: 'signature',
  heroTime: 3.3,
  duration: { default: 5, min: 4, max: 8 },
  schema: cinematicOutroSchema,
  palette: { background: '#040406', foreground: '#F3F1EC', accent: '#E7C27A', secondary: '#7B8CFF', surface: '#121216' },
  create: (init) => ({
    id: init.id,
    type: 'cinematic-outro',
    name: init.name,
    duration: 5,
    ...baseInstance('void', ['center', 'center']),
    texts: {
      headline: text('Made to move.', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['auto', 'single'] }),
      sub: text('Local Motion Studio', { weight: 400, uppercase: false, tracking: 0.02, breaks: ['single', 'single'] }),
      signature: text('© 2026 · localmotion.studio', { weight: 500, uppercase: true, tracking: 0.22, color: '$accent', breaks: ['single', 'single'] }),
    },
    elements: { emblem: graphic('$accent', 1, 1), streaks: graphic('$secondary', 0.9, 1), flare: graphic('#FFFFFF', 0.85, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { logoAssetId: null },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 40, multiline: true, ...OUTRO_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 60, multiline: true, ...OUTRO_CHOREO.sub },
    signature: { label: 'Assinatura', maxLength: 48, multiline: false, ...OUTRO_CHOREO.signature },
  },
  graphics: {
    emblem: { label: 'Emblema', intensityLabel: 'Espessura', description: 'Cor principal: anel, hexágono e arcos.', ...OUTRO_CHOREO.emblem },
    streaks: { label: 'Rastros convergentes', intensityLabel: 'Quantidade', description: 'Cor secundária: linhas de luz que convergem.', ...OUTRO_CHOREO.streaks },
    flare: { label: 'Clarão', intensityLabel: 'Intensidade dos efeitos', description: 'Brilho no momento da convergência.', ...OUTRO_CHOREO.flare },
  },
  exit: OUTRO_CHOREO.exit,
  contentFields: (base) => [field.asset([...base, 'props', 'logoAssetId'], 'Logotipo (opcional)', 'image')],
});
