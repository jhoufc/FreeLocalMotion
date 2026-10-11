import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { animationSchema, baseInstance, graphic, premiumSceneType, text } from '../common';

export const orbitalNodeSchema = z.object({ label: z.string().max(16), value: z.string().max(10) });

export const orbitalDataSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('orbital-data'),
  duration: z.number().min(4).max(7),
  texts: z.object({ headline: textElementSchema, sub: textElementSchema }),
  elements: z.object({ core: graphicElementSchema, orbits: graphicElementSchema, nodes: graphicElementSchema, links: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    nodes: z.array(orbitalNodeSchema).min(3).max(8),
    /** Orbit angular speed multiplier. */
    rotationSpeed: z.number().min(0).max(2),
  }),
});
export type OrbitalDataScene = z.infer<typeof orbitalDataSchema>;

export const ORBITAL_CHOREO = {
  orbits: { in: 0, dur: 1 },
  core: { in: 0.15, dur: 0.8 },
  nodes: { in: 0.6, dur: 1.4 },
  links: { in: 0.75, dur: 1.4 },
  headline: { in: 1.7, dur: 0.9 },
  sub: { in: 2.15, dur: 0.7 },
  exit: 0.7,
} as const;

export const orbitalDataType = premiumSceneType<OrbitalDataScene>({
  id: 'orbital-data',
  name: 'Orbital Data',
  description: 'Sistema orbital modular: núcleo luminoso, órbitas inclinadas em 2.5D, nós de dados conectados e transição para a headline.',
  category: 'technology',
  heroTime: 3,
  duration: { default: 5, min: 4, max: 7 },
  schema: orbitalDataSchema,
  palette: { background: '#05070D', foreground: '#E9F1FF', accent: '#4DF0C5', secondary: '#5B7BFF', surface: '#0F1524' },
  create: (init) => ({
    id: init.id,
    type: 'orbital-data',
    name: init.name,
    duration: 5,
    ...baseInstance('radial', ['start', 'start']),
    texts: {
      headline: text('Every signal,\nconnected', { weight: 800, uppercase: false, tracking: -0.03, breaks: ['manual', 'manual'] }),
      sub: text('A modular data core for real-time systems.', { weight: 400, uppercase: false, tracking: 0, breaks: ['auto', 'auto'] }),
    },
    elements: { core: graphic('$accent', 1, 1), orbits: graphic('$foreground', 0.35, 1), nodes: graphic('$accent', 1, 1), links: graphic('$secondary', 0.7, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      nodes: [
        { label: 'Latency', value: '12ms' },
        { label: 'Nodes', value: '2,048' },
        { label: 'Uptime', value: '99.99%' },
        { label: 'Throughput', value: '4.2GB/s' },
        { label: 'Regions', value: '18' },
        { label: 'Events', value: '1.2M' },
      ],
      rotationSpeed: 1,
    },
  }),
  texts: {
    headline: { label: 'Headline', maxLength: 48, multiline: true, ...ORBITAL_CHOREO.headline },
    sub: { label: 'Subheadline', maxLength: 90, multiline: true, ...ORBITAL_CHOREO.sub },
  },
  graphics: {
    core: { label: 'Núcleo', intensityLabel: 'Brilho', description: 'Núcleo luminoso segmentado e pulsante.', ...ORBITAL_CHOREO.core },
    orbits: { label: 'Órbitas', intensityLabel: 'Detalhe', description: 'Três órbitas inclinadas com marcações.', ...ORBITAL_CHOREO.orbits },
    nodes: { label: 'Nós de dados', intensityLabel: 'Tamanho', description: 'Nós em órbita com rótulos (conteúdo em Cena › Nós).', ...ORBITAL_CHOREO.nodes },
    links: { label: 'Conexões', intensityLabel: 'Espessura', description: 'Linhas do núcleo aos nós e entre vizinhos.', ...ORBITAL_CHOREO.links },
  },
  exit: ORBITAL_CHOREO.exit,
  contentFields: (base) => [
    field.list([...base, 'props', 'nodes'], 'Nós', {
      min: 3,
      max: 8,
      itemLabel: 'Nó',
      titlePath: ['label'],
      newItem: { label: 'Signal', value: '42' },
      itemFields: [field.text(['label'], 'Rótulo', { maxLength: 16 }), field.text(['value'], 'Valor', { maxLength: 10 })],
    }),
  ],
  animationFields: (base) => [field.number([...base, 'props', 'rotationSpeed'], 'Velocidade de rotação', { min: 0, max: 2, step: 0.01, unit: '×' })],
});
