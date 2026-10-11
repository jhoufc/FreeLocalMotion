import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const productRevealSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('product-reveal'),
  duration: z.number().min(4).max(8),
  texts: z.object({ headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ light: graphicElementSchema, product: graphicElementSchema, reflection: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** Product image; without it a procedural device is drawn. */
    assetId: z.string().nullable(),
    productScale: z.number().min(0.6).max(1.4),
    productX: z.number().min(-0.25).max(0.25),
    productY: z.number().min(-0.25).max(0.25),
  }),
});
export type ProductRevealScene = z.infer<typeof productRevealSchema>;

export const PRODUCT_CHOREO = {
  light: { in: 0.1, dur: 1.4 },
  product: { in: 0, dur: 2.4 },
  reflection: { in: 1.2, dur: 0.8 },
  headline: { in: 1.9, dur: 0.9 },
  sub: { in: 2.35, dur: 0.7 },
  exit: 0.7,
} as const;

export const productRevealType = premiumSceneType<ProductRevealScene>({
  id: 'product-reveal',
  name: 'Product Reveal',
  description: 'Revelação cinematográfica: silhueta com luz de recorte, linhas de luz, máscara reveladora e zoom controlado até a composição com título.',
  category: 'product',
  heroTime: 3.2,
  duration: { default: 5, min: 4, max: 8 },
  schema: productRevealSchema,
  palette: { background: '#050506', foreground: '#F4F2EE', accent: '#FFB547', secondary: '#7C6CFF', surface: '#141418' },
  create: (init) => ({
    id: init.id,
    type: 'product-reveal',
    name: init.name,
    duration: 5,
    ...baseInstance('void', ['center', 'start']),
    texts: {
      headline: text('Meet Pulse One', { weight: 800, uppercase: false, tracking: -0.035, breaks: ['auto', 'manual'] }),
      sub: text('Designed in the dark. Revealed in the light.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
    },
    elements: { light: graphic('$accent', 1, 1), product: graphic('$secondary', 1, 1), reflection: graphic('$foreground', 0.35, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { assetId: null, productScale: 1, productX: 0, productY: 0 },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 40, multiline: true, ...PRODUCT_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 90, multiline: true, ...PRODUCT_CHOREO.sub },
  },
  graphics: {
    light: { label: 'Iluminação', intensityLabel: 'Intensidade da revelação', description: 'Cor da luz de recorte, linhas e spot.', ...PRODUCT_CHOREO.light },
    product: { label: 'Produto', intensityLabel: 'Brilho da tela', description: 'Cor de destaque do dispositivo procedural (imagem em Cena).', ...PRODUCT_CHOREO.product },
    reflection: { label: 'Reflexo no piso', intensityLabel: 'Altura', description: 'Reflexo espelhado sob o produto.', ...PRODUCT_CHOREO.reflection },
  },
  exit: PRODUCT_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'assetId'], 'Imagem do produto (opcional)', 'image'),
    field.number([...base, 'props', 'productScale'], 'Escala do produto', { min: 0.6, max: 1.4, step: 0.01, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'productX'], 'Posição X', { min: -0.25, max: 0.25, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'productY'], 'Posição Y', { min: -0.25, max: 0.25, step: 0.005, unit: '%', displayScale: 100 }),
  ],
});
