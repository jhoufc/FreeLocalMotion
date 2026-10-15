import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const glassPanelSchema = z.object({
  label: z.string().max(24),
  value: z.string().max(18),
  /** Optional image shown inside the panel; without it the panel draws a procedural chart. */
  assetId: z.string().nullable(),
});
export type GlassPanel = z.infer<typeof glassPanelSchema>;

export const glassPanelsSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('glass-panels'),
  duration: z.number().min(3.5).max(9),
  texts: z.object({ title: textElementSchema, subtitle: textElementSchema }),
  elements: z.object({ panels: graphicElementSchema, orbs: graphicElementSchema, sheen: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    panels: z.array(glassPanelSchema).min(1).max(3),
    /** Amount of 2.5D perspective, rotation and parallax. */
    depth: z.number().min(0).max(1.5),
  }),
});
export type GlassPanelsScene = z.infer<typeof glassPanelsSchema>;

export const GLASS_CHOREO = {
  orbs: { in: 0, dur: 1.2 },
  panels: { in: 0.2, dur: 1.2 },
  title: { in: 0.55, dur: 0.9 },
  subtitle: { in: 1.05, dur: 0.7 },
  sheen: { in: 1.5, dur: 0.9 },
  exit: 0.65,
} as const;

export const glassPanelsType = premiumSceneType<GlassPanelsScene>({
  id: 'glass-panels',
  name: 'Glass Panels',
  description: 'Painéis translúcidos em perspectiva 2.5D com reflexo, parallax e revelação tipográfica — apresentação de produto/UI.',
  category: 'product',
  heroTime: 2.6,
  duration: { default: 5, min: 3.5, max: 9 },
  schema: glassPanelsSchema,
  palette: { background: '#060912', foreground: '#EEF3FF', accent: '#55E6FF', secondary: '#7A5CFF', surface: '#121A2E' },
  create: (init) => ({
    id: init.id,
    type: 'glass-panels',
    name: init.name,
    duration: 5,
    ...baseInstance('radial', ['start', 'start']),
    texts: {
      title: text('Everything\nin one view', { weight: 800, uppercase: false, tracking: -0.035, breaks: ['manual', 'manual'] }),
      subtitle: text('Live metrics, crafted panels and zero clutter.', { weight: 400, uppercase: false, tracking: 0, color: '$foreground', breaks: ['auto', 'auto'] }),
    },
    elements: { panels: graphic('$surface', 0.62, 1), orbs: graphic('$accent', 0.9, 1), sheen: graphic('#FFFFFF', 0.5, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      panels: [
        { label: 'Active users', value: '128K', assetId: null },
        { label: 'Conversion', value: '+42%', assetId: null },
        { label: 'Render time', value: '0.8s', assetId: null },
      ],
      depth: 1,
    },
  }),
  texts: {
    title: { label: 'Título', maxLength: 48, multiline: true, ...GLASS_CHOREO.title },
    subtitle: { label: 'Subtítulo', maxLength: 100, multiline: true, ...GLASS_CHOREO.subtitle },
  },
  graphics: {
    panels: { label: 'Painéis de vidro', intensityLabel: 'Brilho da borda', description: 'Cor/opacidade do vidro; o conteúdo fica em Cena › Painéis.', ...GLASS_CHOREO.panels },
    orbs: { label: 'Orbes de luz', intensityLabel: 'Tamanho', description: 'Campos de cor por trás do vidro.', ...GLASS_CHOREO.orbs },
    sheen: { label: 'Reflexo', intensityLabel: 'Largura', description: 'Varredura de luz sobre os painéis.', ...GLASS_CHOREO.sheen },
  },
  exit: GLASS_CHOREO.exit,
  contentFields: (base) => [
    field.list([...base, 'props', 'panels'], 'Painéis', {
      min: 1,
      max: 3,
      itemLabel: 'Painel',
      titlePath: ['label'],
      newItem: { label: 'New metric', value: '99%', assetId: null },
      itemFields: [
        field.text(['label'], 'Rótulo', { maxLength: 24 }),
        field.text(['value'], 'Valor', { maxLength: 18 }),
        field.asset(['assetId'], 'Imagem (opcional)', 'image'),
      ],
      hint: 'Sem imagem, o painel desenha um gráfico procedural.',
    }),
  ],
  animationFields: (base) => [field.number([...base, 'props', 'depth'], 'Profundidade 2.5D', { min: 0, max: 1.5, step: 0.01, unit: '×' })],
});
