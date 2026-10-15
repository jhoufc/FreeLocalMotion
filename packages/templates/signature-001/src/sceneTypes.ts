import { field } from '@lms/template-sdk';
import {
  asAnySceneType,
  defineSceneType,
  type AnySceneTypeDefinition,
  type FieldDescriptor,
  type SceneDefinition,
  type SceneFamily,
  type SceneTypeDefinition,
} from '@lms/template-sdk';
import { choreoLayers, instanceTargets, sceneSections, standardAnimationFields, type ChoreoEntry, type GraphicMeta, type TextMeta } from '@lms/scene-kit/fields';
import { DEFAULT_THEME, SCENE_TYPE_NAMES, createSignatureScene } from './defaults';
import {
  SCENE_DURATION_LIMITS,
  energySceneSchema,
  impactSceneSchema,
  signatureSceneSchema,
  transformationSceneSchema,
  type AnyScene,
  type SceneType,
} from './schema';
import { CHOREO, entranceAt, transformationToScene } from './timing';
import { SIGNATURE_PLANNING } from './planning';

/**
 * The four Signature / 001 animations as *global scene types*. The template uses them in
 * its storyboard; the global scene library exposes the very same types to free
 * compositions (same schema, same view, same fields).
 */

export const SIGNATURE_FAMILY: SceneFamily = { id: 'signature-001', name: 'Signature / 001' };
export const SIGNATURE_SCENE_VERSION = '1.1.0';

const HOLD_NOTE = 'Entradas mantêm o timing desenhado e a saída fica ancorada ao fim: a duração extra estende a sustentação.';

const SCENE_INFO: Record<SceneType, Pick<SceneDefinition, 'description' | 'category' | 'heroTime'> & { strategy: SceneDefinition['duration']['strategy']; note: string; default: number }> = {
  impact: {
    description: 'Abertura: linha de luz revela geometria em profundidade e uma headline em duas linhas.',
    category: 'typography',
    strategy: 'hold',
    note: HOLD_NOTE,
    heroTime: 1.9,
    default: 3,
  },
  energy: {
    description: 'Núcleo pulsante, anéis e grade de pontos com lead + headline.',
    category: 'technology',
    strategy: 'hold',
    note: HOLD_NOTE,
    heroTime: 1.9,
    default: 3,
  },
  transformation: {
    description: 'Create / Animate / Inspire: três palavras em sequência com a câmera atravessando planos.',
    category: 'typography',
    strategy: 'proportional',
    note: 'As três palavras formam um único movimento de câmera: o ritmo inteiro escala com a duração, limitado a 0,8×–1,5× do original.',
    heroTime: 2.5,
    default: 4,
  },
  signature: {
    description: 'Encerramento: fragmentos convergem para a assinatura geométrica, com headline e subtítulo.',
    category: 'signature',
    strategy: 'hold',
    note: HOLD_NOTE,
    heroTime: 3.1,
    default: 5,
  },
};

const TEXTS: Record<SceneType, Record<string, TextMeta>> = {
  impact: {
    kicker: { label: 'Kicker', maxLength: 32, multiline: false },
    lineA: { label: 'Headline — linha 1', maxLength: 28, multiline: true },
    lineB: { label: 'Headline — linha 2', maxLength: 28, multiline: true },
  },
  energy: {
    lead: { label: 'Lead', maxLength: 24, multiline: false },
    headline: { label: 'Headline', maxLength: 22, multiline: true },
  },
  transformation: {
    word1: { label: 'Palavra 1', maxLength: 14, multiline: false },
    word2: { label: 'Palavra 2', maxLength: 14, multiline: false },
    word3: { label: 'Palavra 3', maxLength: 14, multiline: false },
  },
  signature: {
    headline: { label: 'Headline', maxLength: 48, multiline: true },
    subtitle: { label: 'Subtítulo', maxLength: 80, multiline: true },
  },
};

const GRAPHICS: Record<SceneType, Record<string, GraphicMeta>> = {
  impact: {
    lightLine: { label: 'Linha luminosa', intensityLabel: 'Brilho', description: 'Varredura de luz que revela a cena.' },
    geometry: { label: 'Geometria em profundidade', intensityLabel: 'Densidade', description: 'Molduras em perspectiva reveladas pela linha.' },
    particles: { label: 'Partículas', intensityLabel: 'Quantidade', description: 'Poeira luminosa com seed fixa.' },
  },
  energy: {
    core: { label: 'Núcleo', intensityLabel: 'Brilho do pulso', description: 'Centro pulsante que emite ondas.' },
    rings: { label: 'Anéis e ticks', intensityLabel: 'Velocidade de rotação', description: 'Anéis concêntricos e mostrador.' },
    grid: { label: 'Grade de pontos', intensityLabel: 'Deslocamento da onda', description: 'Campo de pontos deslocado pelos pulsos.' },
    orbiters: { label: 'Satélites', intensityLabel: 'Velocidade', description: 'Pontos em órbita nos anéis.' },
  },
  transformation: {
    frames: { label: 'Planos em profundidade', intensityLabel: 'Densidade', description: 'Molduras atravessadas pela câmera.' },
    morph: { label: 'Forma coreografada', intensityLabel: 'Amplitude', description: 'Forma que muda de posição, escala e cor.' },
    guides: { label: 'Guias de criação', intensityLabel: 'Detalhe', description: 'Caixa de seleção, caminho de animação e raios.' },
  },
  signature: {
    markRing: { label: 'Assinatura — anel', intensityLabel: 'Espessura', description: 'Anel externo da assinatura geométrica.' },
    markDiamond: { label: 'Assinatura — losango', intensityLabel: 'Espessura', description: 'Quadrado rotacionado.' },
    markCore: { label: 'Assinatura — núcleo', intensityLabel: 'Brilho', description: 'Disco central e linha luminosa.' },
    shards: { label: 'Fragmentos', intensityLabel: 'Quantidade', description: 'Elementos que convergem para a assinatura.' },
  },
};

/** Scene-specific animation controls beyond duration / intensity / pace. */
const extraAnimationFields = (scene: AnyScene, index: number): FieldDescriptor[] => {
  const base = ['scenes', index] as const;
  if (scene.type === 'energy') return [field.number([...base, 'props', 'pulseRate'], 'Pulsos por segundo', { min: 0.6, max: 3, step: 0.05, unit: 'Hz' })];
  if (scene.type === 'signature') {
    const words = scene.texts.headline.content.replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
    return [
      field.select([...base, 'props', 'highlightWord'], 'Palavra em destaque', [
        { value: -1, label: 'Nenhuma' },
        ...words.map((w, i) => ({ value: i, label: `${i + 1}. ${w}` })),
      ]),
    ];
  }
  return [];
};

const choreoFor = (scene: AnyScene, key: string): { in: number; dur: number } => {
  const table = CHOREO[scene.type] as unknown as Record<string, { in: number; dur: number }>;
  const entry = table[key] ?? { in: 0, dur: scene.duration };
  if (scene.type === 'transformation') {
    return { in: transformationToScene(entry.in, scene.duration), dur: transformationToScene(entry.dur, scene.duration) };
  }
  return entry;
};

const makeType = <T extends SceneType>(type: T, schema: SceneTypeDefinition<Extract<AnyScene, { type: T }>>['schema']) => {
  const info = SCENE_INFO[type];
  const def: SceneDefinition = {
    id: type,
    name: SCENE_TYPE_NAMES[type],
    description: info.description,
    category: info.category,
    family: SIGNATURE_FAMILY,
    version: SIGNATURE_SCENE_VERSION,
    heroTime: info.heroTime,
    duration: { default: info.default, ...SCENE_DURATION_LIMITS[type], strategy: info.strategy, note: info.note },
    planning: SIGNATURE_PLANNING[type],
  };
  return defineSceneType<Extract<AnyScene, { type: T }>>({
    ...def,
    schema,
    palette: { ...DEFAULT_THEME },
    create: (init) => createSignatureScene(type, init) as Extract<AnyScene, { type: T }>,
    targets: (scene, ctx) => {
      const base = ['scenes', ctx.index] as const;
      return instanceTargets({
        scene,
        index: ctx.index,
        description: info.description,
        sections: sceneSections({
          base,
          def,
          format: ctx.format,
          inheritBackground: ctx.inheritBackground,
          animationFields: [...standardAnimationFields(base, def), ...extraAnimationFields(scene, ctx.index)],
        }),
        texts: TEXTS[type],
        graphics: GRAPHICS[type],
      });
    },
    layers: (scene, ctx) => {
      const entries: ChoreoEntry[] = [];
      const add = (key: string, label: string, kind: 'text' | 'graphic', visible: boolean, delay: number, delayPath?: ChoreoEntry['delay']) => {
        const c = choreoFor(scene, key);
        const start = entranceAt(c.in, scene.animation, delay);
        entries.push({ key, label, kind, start, settle: start + c.dur / scene.animation.pace, visible, ...(delayPath ? { delay: delayPath } : {}) });
      };
      for (const [key, meta] of Object.entries(TEXTS[type])) {
        const el = (scene.texts as Record<string, { visible: boolean; delay: number }>)[key]!;
        add(key, meta.label, 'text', el.visible, el.delay, { path: ['scenes', ctx.index, 'texts', key, 'delay'], max: 0.6 });
      }
      for (const [key, meta] of Object.entries(GRAPHICS[type])) {
        const el = (scene.elements as Record<string, { visible: boolean }>)[key]!;
        add(key, meta.label, 'graphic', el.visible, 0);
      }
      const exitLead = scene.type === 'signature' ? CHOREO.signature.outro : CHOREO[scene.type as Exclude<SceneType, 'signature'>].exit;
      return choreoLayers(scene, ctx, entries, exitLead);
    },
  });
};

export const impactSceneType = makeType('impact', impactSceneSchema);
export const energySceneType = makeType('energy', energySceneSchema);
export const transformationSceneType = makeType('transformation', transformationSceneSchema);
export const signatureSceneType = makeType('signature', signatureSceneSchema);

/** In storyboard order. */
export const SIGNATURE_SCENE_TYPES: readonly AnySceneTypeDefinition[] = [impactSceneType, energySceneType, transformationSceneType, signatureSceneType].map(
  (t) => asAnySceneType(t as SceneTypeDefinition<AnyScene>),
);
