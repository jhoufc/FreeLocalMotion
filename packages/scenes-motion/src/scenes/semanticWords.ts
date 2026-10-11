import { z } from 'zod';
import { graphicElementSchema, sceneBaseShape, textElementSchema } from '@lms/shared';
import { field } from '@lms/template-sdk';
import { WEIGHTS } from '@lms/scene-kit/fields';
import { animationSchema, baseInstance, graphic, motionSceneType, text } from '../common';

/**
 * Motion presets. They describe a *behaviour*, not a meaning: "explode" works on any word,
 * so users can rewrite the copy freely.
 */
export const WORD_PRESETS = ['explode', 'fast', 'grow', 'focus', 'connect', 'rise', 'spin', 'shake'] as const;
export type WordPreset = (typeof WORD_PRESETS)[number];
export const WORD_PRESET_LABELS: Record<WordPreset, string> = {
  explode: 'Explodir (fragmenta)',
  fast: 'Rápido (atravessa)',
  grow: 'Crescer',
  focus: 'Foco (desfocado → nítido)',
  connect: 'Conectar (une pontos)',
  rise: 'Subir (stagger)',
  spin: 'Girar (flip 3D)',
  shake: 'Tremer (impacto)',
};

export const semanticWordSchema = z.object({ text: z.string().min(1).max(16), preset: z.enum(WORD_PRESETS) });

export const semanticWordsSchema = z.object({
  ...sceneBaseShape,
  type: z.literal('semantic-words'),
  duration: z.number().min(3).max(10),
  texts: z.object({ caption: textElementSchema }),
  elements: z.object({ words: graphicElementSchema, accents: graphicElementSchema }),
  animation: animationSchema,
  props: z.object({
    words: z.array(semanticWordSchema).min(1).max(6),
    weight: z.number().int().min(300).max(900),
    uppercase: z.boolean(),
    /** Share of each word's slot spent on the behaviour (the rest is a held beat). */
    timing: z.number().min(0.5).max(1),
  }),
});
export type SemanticWordsScene = z.infer<typeof semanticWordsSchema>;

export const SEMANTIC_CHOREO = {
  words: { in: 0, dur: 1.2 },
  accents: { in: 0.1, dur: 1 },
  caption: { in: 0.2, dur: 0.6 },
  exit: 0.35,
} as const;

export const semanticWordsType = motionSceneType<SemanticWordsScene>({
  id: 'semantic-words',
  name: 'Semantic Kinetic Words',
  description: 'Cada palavra se move de acordo com um comportamento: explode, atravessa, cresce, ganha foco, conecta, sobe, gira ou treme.',
  category: 'typography',
  heroTime: 0.5,
  // Words take turns in equal slots: the readable still is the first word, mid-behaviour,
  // never the gap between two words (which moves with the word count and duration).
  heroTimeOf: (scene) => {
    const slot = Math.max(0.5, scene.duration - SEMANTIC_CHOREO.exit) / Math.max(1, scene.props.words.length);
    const active = slot * scene.props.timing;
    return Math.max(Math.min(0.3, active * 0.6), Math.min(active * 0.45, 1.2));
  },
  duration: { default: 6, min: 3, max: 10 },
  schema: semanticWordsSchema,
  palette: { background: '#0B0A12', foreground: '#F7F5FF', accent: '#7CF29A', secondary: '#7B61FF', surface: '#17152A' },
  create: (init) => ({
    id: init.id,
    type: 'semantic-words',
    name: init.name,
    duration: 6,
    ...baseInstance('radial', ['center', 'center']),
    texts: { caption: text('Words that move like they mean it', { weight: 500, uppercase: true, tracking: 0.18, color: '$accent', breaks: ['auto', 'single'] }) },
    elements: { words: graphic('$foreground', 1, 1), accents: graphic('$accent', 1, 1) },
    animation: { intensity: 1, pace: 1 },
    props: {
      words: [
        { text: 'Explode', preset: 'explode' },
        { text: 'Fast', preset: 'fast' },
        { text: 'Grow', preset: 'grow' },
        { text: 'Focus', preset: 'focus' },
        { text: 'Connect', preset: 'connect' },
      ],
      weight: 900,
      uppercase: true,
      timing: 0.8,
    },
  }),
  texts: { caption: { label: 'Legenda', maxLength: 60, multiline: false, ...SEMANTIC_CHOREO.caption } },
  graphics: {
    words: { label: 'Palavras', intensityLabel: 'Escala', description: 'Cor e escala das palavras (lista em Cena › Palavras).', ...SEMANTIC_CHOREO.words },
    accents: { label: 'Elementos de apoio', intensityLabel: 'Quantidade', description: 'Fragmentos, rastros, pontos e linhas de cada comportamento.', ...SEMANTIC_CHOREO.accents },
  },
  exit: SEMANTIC_CHOREO.exit,
  contentFields: (base) => [
    field.list([...base, 'props', 'words'], 'Palavras', {
      min: 1,
      max: 6,
      itemLabel: 'Palavra',
      titlePath: ['text'],
      newItem: { text: 'Rise', preset: 'rise' },
      itemFields: [
        field.text(['text'], 'Texto', { maxLength: 16 }),
        field.select(['preset'], 'Comportamento', WORD_PRESETS.map((p) => ({ value: p, label: WORD_PRESET_LABELS[p] }))),
      ],
      hint: 'Os comportamentos descrevem movimentos: funcionam com qualquer palavra.',
    }),
    field.select([...base, 'props', 'weight'], 'Peso das palavras', WEIGHTS),
    field.toggle([...base, 'props', 'uppercase'], 'Caixa alta'),
  ],
  animationFields: (base) => [field.number([...base, 'props', 'timing'], 'Tempo de movimento por palavra', { min: 0.5, max: 1, step: 0.01, unit: '%', displayScale: 100 })],
});
