import {
  CURRENT_SCHEMA_VERSION,
  createBackground,
  emptyPaletteOverride,
  type GraphicElement,
  type LineBreakMode,
  type SceneLayout,
  type TextElement,
} from '@lms/shared';
import type { ProjectInit } from '@lms/template-sdk';
import { TEMPLATE_ID, TEMPLATE_VERSION, type AnyScene, type SceneType, type SignatureProject } from './schema';

export const DEFAULT_THEME = {
  background: '#080A10',
  foreground: '#F5F7FF',
  accent: '#B8FF35',
  secondary: '#6574FF',
  surface: '#151925',
} as const;

const text = (content: string, opts: Partial<Omit<TextElement, 'breaks'>> & { breaks?: [LineBreakMode, LineBreakMode] } = {}): TextElement => {
  const { breaks = ['manual', 'manual'], ...rest } = opts;
  return {
    visible: true,
    content,
    color: '$foreground',
    weight: 900,
    italic: false,
    uppercase: true,
    stretch: 'expanded',
    sizeScale: 1,
    tracking: -0.02,
    delay: 0,
    ...rest,
    breaks: { portrait: breaks[0], landscape: breaks[1] },
  };
};

const graphic = (color: string, opacity = 1, intensity = 1): GraphicElement => ({ visible: true, color, opacity, intensity });

const layout = (portrait: SceneLayout['portrait']['align'], landscape: SceneLayout['landscape']['align']): SceneLayout => ({
  portrait: { align: portrait, scale: 1, offsetX: 0, offsetY: 0 },
  landscape: { align: landscape, scale: 1, offsetX: 0, offsetY: 0 },
});

/** Default name of each scene type in a new instance. */
export const SCENE_TYPE_NAMES: Record<SceneType, string> = {
  impact: 'Impact',
  energy: 'Energy',
  transformation: 'Transformation',
  signature: 'Signature',
};

type SceneFactory<T extends SceneType> = (init: { id: string; name: string }) => Extract<AnyScene, { type: T }>;

/**
 * Default values of each scene type. Every call returns fresh objects, so instances
 * created from the same type never share editable state.
 */
const SCENE_FACTORIES: { [T in SceneType]: SceneFactory<T> } = {
  impact: (init) => ({
    id: init.id,
    type: 'impact',
    name: init.name,
    enabled: true,
    duration: 3,
    background: createBackground({ variant: 'void' }),
    palette: emptyPaletteOverride(),
    layout: layout('center', 'start'),
    texts: {
      kicker: text('Signature / 001', { weight: 500, stretch: 'normal', tracking: 0.32, breaks: ['single', 'single'], color: '$accent' }),
      lineA: text('The Future', { breaks: ['words', 'single'] }),
      lineB: text('Is Built', { breaks: ['words', 'single'], color: '$accent' }),
    },
    elements: {
      lightLine: graphic('$accent', 1, 1),
      geometry: graphic('$secondary', 0.6, 1),
      particles: graphic('$foreground', 0.55, 1),
    },
    animation: { intensity: 1, pace: 1 },
  }),
  energy: (init) => ({
    id: init.id,
    type: 'energy',
    name: init.name,
    enabled: true,
    duration: 3,
    background: createBackground({ variant: 'radial' }),
    palette: emptyPaletteOverride(),
    layout: layout('center', 'start'),
    texts: {
      lead: text('Not just', { weight: 300, stretch: 'normal', tracking: 0.04, breaks: ['single', 'single'] }),
      headline: text('Imagined.', { breaks: ['single', 'single'] }),
    },
    elements: {
      core: graphic('$accent', 1, 1),
      rings: graphic('$foreground', 0.5, 1),
      grid: graphic('$foreground', 0.4, 1),
      orbiters: graphic('$secondary', 1, 1),
    },
    animation: { intensity: 1, pace: 1 },
    props: { pulseRate: 1.5 },
  }),
  transformation: (init) => ({
    id: init.id,
    type: 'transformation',
    name: init.name,
    enabled: true,
    duration: 4,
    background: createBackground({ variant: 'tunnel' }),
    palette: emptyPaletteOverride(),
    layout: layout('center', 'center'),
    texts: {
      word1: text('Create.', { breaks: ['single', 'single'] }),
      word2: text('Animate.', { breaks: ['single', 'single'] }),
      word3: text('Inspire.', { breaks: ['single', 'single'], color: '$accent' }),
    },
    elements: {
      frames: graphic('$foreground', 0.4, 1),
      morph: graphic('$secondary', 1, 1),
      guides: graphic('$accent', 0.9, 1),
    },
    animation: { intensity: 1, pace: 1 },
  }),
  signature: (init) => ({
    id: init.id,
    type: 'signature',
    name: init.name,
    enabled: true,
    duration: 5,
    background: createBackground({ variant: 'void' }),
    palette: emptyPaletteOverride(),
    layout: layout('center', 'start'),
    texts: {
      headline: text('Motion without\nlimits.', { breaks: ['words', 'manual'] }),
      subtitle: text('Designed with code.\nMade to move.', {
        weight: 400,
        stretch: 'normal',
        uppercase: false,
        tracking: 0,
        breaks: ['manual', 'single'],
        color: '$foreground',
      }),
    },
    elements: {
      markRing: graphic('$foreground', 0.9, 1),
      markDiamond: graphic('$secondary', 1, 1),
      markCore: graphic('$accent', 1, 1),
      shards: graphic('$foreground', 0.7, 1),
    },
    animation: { intensity: 1, pace: 1 },
    props: { highlightWord: 2 },
  }),
};

export const createSignatureScene = (type: string, init: { id: string; name: string }): AnyScene => {
  const factory = SCENE_FACTORIES[type as SceneType] as SceneFactory<SceneType> | undefined;
  if (!factory) throw new Error(`Signature / 001 has no scene type "${type}"`);
  return factory(init);
};

/** The original storyboard: one instance of each type, ids equal to the type (as in 1.0.0). */
export const DEFAULT_SEQUENCE: readonly SceneType[] = ['impact', 'energy', 'transformation', 'signature'];

export const createSignatureDefaults = (init: ProjectInit): SignatureProject => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: init.id,
  name: init.name,
  templateId: TEMPLATE_ID,
  templateVersion: TEMPLATE_VERSION,
  format: init.format,
  fps: init.fps ?? 30,
  theme: { ...DEFAULT_THEME },
  audio: { assetId: null, volume: 0.9, fadeIn: 0, fadeOut: 1.2 },
  assets: [],
  createdAt: init.now,
  updatedAt: init.now,
  scenes: DEFAULT_SEQUENCE.map((type) => createSignatureScene(type, { id: type, name: SCENE_TYPE_NAMES[type] })),
  globals: {
    hud: { ...graphic('$foreground', 0.55, 1), labelLeft: 'Signature — 001', labelRight: 'Local Motion Studio', timecode: true, progress: true },
    grain: graphic('#FFFFFF', 1, 1),
    vignette: graphic('#000000', 0.7, 1),
  },
});
