import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

export const uiCalloutSchema = z.object({ label: z.string().min(1).max(32), side: z.enum(['left', 'right', 'top', 'bottom']) });

export const uiHighlightSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('ui-highlight'),
  duration: z.number().min(3.5).max(8),
  texts: z.object({ title: textElementSchema, benefit: textElementSchema }),
  elements: z.object({ window: graphicElementSchema, focus: graphicElementSchema, callouts: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** Interface screenshot (16:10 works best); procedural dashboard otherwise. */
    assetId: z.string().nullable(),
    reveal: z.enum(['cards', 'zoom', 'spotlight']),
    /** Focus region, as fractions of the interface. */
    focusX: z.number().min(0).max(0.9),
    focusY: z.number().min(0).max(0.9),
    focusW: z.number().min(0.1).max(1),
    focusH: z.number().min(0.1).max(1),
    callouts: z.array(uiCalloutSchema).min(0).max(3),
  }),
});
export type UiHighlightScene = z.infer<typeof uiHighlightSchema>;

export const UI_CHOREO = {
  window: { in: 0, dur: 1 },
  title: { in: 0.4, dur: 0.8 },
  focus: { in: 1.5, dur: 1 },
  callouts: { in: 2.1, dur: 0.9 },
  benefit: { in: 2.3, dur: 0.7 },
  exit: 0.6,
} as const;

export const uiHighlightType = motionSceneType<UiHighlightScene>({
  id: 'ui-highlight',
  name: 'UI Feature Highlight',
  description: 'Interface em destaque: componentes surgem, a câmera dá zoom na região da funcionalidade e callouts explicam o benefício.',
  category: 'technology',
  heroTime: 3.2,
  duration: { default: 5, min: 3.5, max: 8 },
  schema: uiHighlightSchema,
  palette: { background: '#0A0C14', foreground: '#EEF1FA', accent: '#5CF2B0', secondary: '#5C7CFF', surface: '#121624' },
  create: (init) => ({
    id: init.id,
    type: 'ui-highlight',
    name: init.name,
    duration: 5,
    ...baseInstance('radial', ['center', 'start']),
    texts: {
      title: text('Insights in one click', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['auto', 'single'] }),
      benefit: text('Live KPIs update the moment your data changes.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'single'] }),
    },
    elements: { window: graphic('$surface', 1, 1), focus: graphic('$accent', 1, 1), callouts: graphic('$foreground', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      assetId: null,
      reveal: 'zoom',
      focusX: 0.17,
      focusY: 0.03,
      focusW: 0.26,
      focusH: 0.22,
      callouts: [
        { label: 'Real-time revenue', side: 'right' },
        { label: 'Week-over-week trend', side: 'bottom' },
      ],
    },
  }),
  texts: {
    title: { label: 'Título', maxLength: 48, multiline: true, ...UI_CHOREO.title },
    benefit: { label: 'Benefício', maxLength: 100, multiline: true, ...UI_CHOREO.benefit },
  },
  graphics: {
    window: { label: 'Janela da interface', intensityLabel: 'Sombra', description: 'Moldura e cor da janela (imagem em Cena).', ...UI_CHOREO.window },
    focus: { label: 'Destaque', intensityLabel: 'Escurecimento', description: 'Cor do anel de foco e intensidade do spotlight.', ...UI_CHOREO.focus },
    callouts: { label: 'Callouts', intensityLabel: 'Tamanho', description: 'Rótulos com linhas de conexão.', ...UI_CHOREO.callouts },
  },
  exit: UI_CHOREO.exit,
  contentFields: (base) => [
    field.asset([...base, 'props', 'assetId'], 'Imagem da interface (opcional)', 'image'),
    field.select([...base, 'props', 'reveal'], 'Tipo de revelação', [
      { value: 'cards', label: 'Cards' },
      { value: 'zoom', label: 'Zoom' },
      { value: 'spotlight', label: 'Spotlight' },
    ], true),
    field.number([...base, 'props', 'focusX'], 'Foco — X', { min: 0, max: 0.9, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'focusY'], 'Foco — Y', { min: 0, max: 0.9, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'focusW'], 'Foco — largura', { min: 0.1, max: 1, step: 0.005, unit: '%', displayScale: 100 }),
    field.number([...base, 'props', 'focusH'], 'Foco — altura', { min: 0.1, max: 1, step: 0.005, unit: '%', displayScale: 100 }),
    field.list([...base, 'props', 'callouts'], 'Callouts', {
      min: 0,
      max: 3,
      itemLabel: 'Callout',
      titlePath: ['label'],
      newItem: { label: 'New detail', side: 'left' },
      itemFields: [
        field.text(['label'], 'Texto', { maxLength: 32 }),
        field.select(['side'], 'Posição', [
          { value: 'left', label: 'Esq.' },
          { value: 'right', label: 'Dir.' },
          { value: 'top', label: 'Topo' },
          { value: 'bottom', label: 'Base' },
        ], true),
      ],
    }),
  ],
});
