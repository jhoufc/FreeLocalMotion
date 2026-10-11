import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const NUMBER_SEPARATORS = ['comma', 'dot', 'space', 'none'] as const;

export const numberImpactSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('number-impact'),
  duration: z.number().min(3).max(6),
  texts: z.object({ kicker: textElementSchema, caption: textElementSchema }),
  elements: z.object({ number: graphicElementSchema, lines: graphicElementSchema, markers: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    from: z.number().min(-1e9).max(1e9),
    to: z.number().min(-1e9).max(1e9),
    decimals: z.number().int().min(0).max(3),
    prefix: z.string().max(4),
    suffix: z.string().max(6),
    /** Thousands separator (the decimal mark is the other one of comma/dot). */
    separator: z.enum(NUMBER_SEPARATORS),
    /** Seconds the count takes. */
    countDuration: z.number().min(0.6).max(3),
  }),
});
export type NumberImpactScene = z.infer<typeof numberImpactSchema>;

export const NUMBER_CHOREO = {
  markers: { in: 0, dur: 0.8 },
  kicker: { in: 0.15, dur: 0.6 },
  number: { in: 0.3, dur: 1.9 },
  lines: { in: 0.35, dur: 1.6 },
  caption: { in: 1.5, dur: 0.7 },
  exit: 0.55,
} as const;

export const numberImpactType = premiumSceneType<NumberImpactScene>({
  id: 'number-impact',
  name: 'Number Impact',
  description: 'Número gigante com contagem tipo odômetro, linhas de velocidade, régua de progresso e pulso de destaque.',
  category: 'data',
  heroTime: 2.6,
  duration: { default: 4, min: 3, max: 6 },
  schema: numberImpactSchema,
  palette: { background: '#08080A', foreground: '#F7F7F2', accent: '#D7FF3A', secondary: '#5A5AFF', surface: '#16161B' },
  create: (init) => ({
    id: init.id,
    type: 'number-impact',
    name: init.name,
    duration: 4,
    ...baseInstance('void', ['center', 'start']),
    texts: {
      kicker: text('Frames rendered locally', { weight: 500, uppercase: true, tracking: 0.16, color: '$accent', breaks: ['single', 'single'] }),
      caption: text('Zero cloud. Zero waiting. Every frame on your machine.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
    },
    elements: { number: graphic('$foreground', 1, 1), lines: graphic('$accent', 0.8, 1), markers: graphic('$foreground', 0.5, 1) },
    animation: { intensity: 1, pace: 1 },
    props: { from: 0, to: 1250000, decimals: 0, prefix: '', suffix: '+', separator: 'comma', countDuration: 1.8 },
  }),
  texts: {
    kicker: { label: 'Kicker', maxLength: 40, multiline: false, ...NUMBER_CHOREO.kicker },
    caption: { label: 'Legenda', maxLength: 100, multiline: true, ...NUMBER_CHOREO.caption },
  },
  graphics: {
    number: { label: 'Número', intensityLabel: 'Força do pulso', description: 'Cor do número; valores em Cena › Contagem.', ...NUMBER_CHOREO.number },
    lines: { label: 'Linhas de velocidade', intensityLabel: 'Quantidade', description: 'Rastros proporcionais à velocidade da contagem.', ...NUMBER_CHOREO.lines },
    markers: { label: 'Marcadores geométricos', intensityLabel: 'Detalhe', description: 'Régua de progresso, ticks e cantoneiras.', ...NUMBER_CHOREO.markers },
  },
  exit: NUMBER_CHOREO.exit,
  contentFields: (base) => [
    field.number([...base, 'props', 'from'], 'Valor inicial', { min: 0, max: 10_000_000, step: 1 }),
    field.number([...base, 'props', 'to'], 'Valor final', { min: 0, max: 10_000_000, step: 1, hint: 'Digite o valor exato no campo numérico.' }),
    field.select([...base, 'props', 'decimals'], 'Casas decimais', [
      { value: 0, label: '0' },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
    ], true),
    field.text([...base, 'props', 'prefix'], 'Prefixo', { maxLength: 4, placeholder: 'R$' }),
    field.text([...base, 'props', 'suffix'], 'Sufixo', { maxLength: 6, placeholder: '%' }),
    field.select([...base, 'props', 'separator'], 'Separador de milhar', [
      { value: 'comma', label: '1,000' },
      { value: 'dot', label: '1.000' },
      { value: 'space', label: '1 000' },
      { value: 'none', label: '1000' },
    ], true),
  ],
  animationFields: (base) => [field.number([...base, 'props', 'countDuration'], 'Duração da contagem', { min: 0.6, max: 3, step: 0.05, unit: 's' })],
});

/** Formats a value with the scene's options (used by tests and the view). */
export const formatNumber = (value: number, p: Pick<NumberImpactScene['props'], 'decimals' | 'separator'>): string => {
  const fixed = Math.abs(value).toFixed(p.decimals);
  const [int, dec] = fixed.split('.');
  const sep = p.separator === 'comma' ? ',' : p.separator === 'dot' ? '.' : p.separator === 'space' ? ' ' : '';
  const mark = p.separator === 'dot' ? ',' : '.';
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${value < 0 ? '−' : ''}${grouped}${dec ? mark + dec : ''}`;
};
