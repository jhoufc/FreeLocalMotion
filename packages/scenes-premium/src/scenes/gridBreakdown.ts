import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const gridBreakdownSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('grid-breakdown'),
  duration: z.number().min(3.5).max(6.5),
  texts: z.object({ headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ cells: graphicElementSchema, lines: graphicElementSchema, accents: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    /** Columns of the grid across the frame width (landscape; portrait uses fewer). */
    density: z.number().int().min(6).max(18),
  }),
});
export type GridBreakdownScene = z.infer<typeof gridBreakdownSchema>;

export const GRID_CHOREO = {
  lines: { in: 0, dur: 0.6 },
  cells: { in: 0.25, dur: 1 },
  accents: { in: 0.6, dur: 0.8 },
  headline: { in: 1.35, dur: 0.9 },
  sub: { in: 1.85, dur: 0.7 },
  /** Cells inside the text band break away. */
  breakdown: { in: 1.15, dur: 0.75 },
  exit: 0.75,
} as const;

export const gridBreakdownType = premiumSceneType<GridBreakdownScene>({
  id: 'grid-breakdown',
  name: 'Grid Breakdown',
  description: 'Uma grade geométrica se constrói, fragmenta e se reorganiza para revelar a mensagem.',
  category: 'abstract',
  heroTime: 2.7,
  duration: { default: 4.5, min: 3.5, max: 6.5 },
  schema: gridBreakdownSchema,
  palette: { background: '#0B0B0D', foreground: '#F2F0EA', accent: '#FF3D6E', secondary: '#2E2E38', surface: '#1A1A20' },
  create: (init) => ({
    id: init.id,
    type: 'grid-breakdown',
    name: init.name,
    duration: 4.5,
    ...baseInstance('void', ['center', 'center']),
    texts: {
      headline: text('Order from\nchaos', { stretch: 'expanded', tracking: -0.03, breaks: ['manual', 'manual'] }),
      sub: text('Systems that rearrange themselves around your message.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
    },
    elements: { cells: graphic('$surface', 1, 1), lines: graphic('$foreground', 0.18, 1), accents: graphic('$accent', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { density: 12 },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 36, multiline: true, ...GRID_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 90, multiline: true, ...GRID_CHOREO.sub },
  },
  graphics: {
    cells: { label: 'Células', intensityLabel: 'Variação de tom', description: 'Blocos que constroem e quebram a grade.', ...GRID_CHOREO.cells },
    lines: { label: 'Linhas da grade', intensityLabel: 'Espessura', description: 'Estrutura desenhada antes das células.', ...GRID_CHOREO.lines },
    accents: { label: 'Células de destaque', intensityLabel: 'Quantidade', description: 'Blocos coloridos que pulsam na grade.', ...GRID_CHOREO.accents },
  },
  exit: GRID_CHOREO.exit,
  animationFields: (base) => [field.number([...base, 'props', 'density'], 'Densidade da grade', { min: 6, max: 18, step: 1, unit: ' col' })],
});
