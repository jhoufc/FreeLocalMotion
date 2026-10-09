import { FORMATS, type FieldPath, type Format } from '@lms/shared';
import {
  computeSceneRanges,
  defineTemplate,
  field,
  isDurationEditable,
  sequentialMetadata,
  type EditableTarget,
  type FieldSection,
  type SceneDefinition,
  type TimelineLayer,
  type TimelineModel,
} from '@lms/template-sdk';
import { SCENE_TYPE_NAMES, createSignatureDefaults, createSignatureScene } from './defaults';
import {
  SCENE_DURATION_LIMITS,
  SCENE_TYPES,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  signatureProjectSchema,
  type AnyScene,
  type SceneType,
  type SignatureProject,
} from './schema';
import { CHOREO, entranceAt, transformationToScene } from './timing';

export const PROCEDURAL_VARIANTS = [
  { value: 'void', label: 'Void — grade e luz' },
  { value: 'radial', label: 'Radial — núcleo luminoso' },
  { value: 'tunnel', label: 'Tunnel — profundidade' },
  { value: 'aurora', label: 'Aurora — campos de cor' },
] as const;

const WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra' },
  { value: 900, label: 'Black' },
];

const STRETCHES = [
  { value: 'condensed', label: 'Condensed' },
  { value: 'normal', label: 'Normal' },
  { value: 'expanded', label: 'Expanded' },
];

/* ------------------------------------------------------------------ */
/* Scene catalog: the four reusable animations of Signature / 001.     */
/* ------------------------------------------------------------------ */

const HOLD_NOTE = 'Entradas mantêm o timing desenhado e a saída fica ancorada ao fim: a duração extra estende a sustentação.';

interface SceneInfo {
  description: string;
  strategy: SceneDefinition['duration']['strategy'];
  note: string;
  heroTime: number;
}

const SCENE_INFO: Record<SceneType, SceneInfo> = {
  impact: {
    description: 'Abertura: linha de luz revela geometria em profundidade e uma headline em duas linhas.',
    strategy: 'hold',
    note: HOLD_NOTE,
    heroTime: 1.9,
  },
  energy: {
    description: 'Núcleo pulsante, anéis e grade de pontos com lead + headline.',
    strategy: 'hold',
    note: HOLD_NOTE,
    heroTime: 1.9,
  },
  transformation: {
    description: 'Create / Animate / Inspire: três palavras em sequência com a câmera atravessando planos.',
    strategy: 'proportional',
    note: 'As três palavras formam um único movimento de câmera: o ritmo inteiro escala com a duração, limitado a 0,8×–1,5× do original.',
    heroTime: 2.5,
  },
  signature: {
    description: 'Encerramento: fragmentos convergem para a assinatura geométrica, com headline e subtítulo.',
    strategy: 'hold',
    note: HOLD_NOTE,
    heroTime: 3.1,
  },
};

const DEFAULT_DURATION: Record<SceneType, number> = { impact: 3, energy: 3, transformation: 4, signature: 5 };

export const SIGNATURE_SCENE_TYPES: readonly SceneDefinition[] = SCENE_TYPES.map((id) => ({
  id,
  name: SCENE_TYPE_NAMES[id],
  description: SCENE_INFO[id].description,
  heroTime: SCENE_INFO[id].heroTime,
  duration: { default: DEFAULT_DURATION[id], ...SCENE_DURATION_LIMITS[id], strategy: SCENE_INFO[id].strategy, note: SCENE_INFO[id].note },
}));

const sceneTypeDef = (type: SceneType): SceneDefinition => SIGNATURE_SCENE_TYPES.find((t) => t.id === type)!;

/* ------------------------------------------------------------------ */
/* Element metadata: labels + text limits, one place.                  */
/* ------------------------------------------------------------------ */

interface TextMeta {
  label: string;
  maxLength: number;
  multiline: boolean;
  /** Choreography key in CHOREO for the timeline. */
  choreo: string;
}
interface GraphicMeta {
  label: string;
  choreo: string;
  intensityLabel: string;
  description: string;
}

const TEXTS: Record<SceneType, Record<string, TextMeta>> = {
  impact: {
    kicker: { label: 'Kicker', maxLength: 32, multiline: false, choreo: 'kicker' },
    lineA: { label: 'Headline — linha 1', maxLength: 28, multiline: true, choreo: 'lineA' },
    lineB: { label: 'Headline — linha 2', maxLength: 28, multiline: true, choreo: 'lineB' },
  },
  energy: {
    lead: { label: 'Lead', maxLength: 24, multiline: false, choreo: 'lead' },
    headline: { label: 'Headline', maxLength: 22, multiline: true, choreo: 'headline' },
  },
  transformation: {
    word1: { label: 'Palavra 1', maxLength: 14, multiline: false, choreo: 'word1' },
    word2: { label: 'Palavra 2', maxLength: 14, multiline: false, choreo: 'word2' },
    word3: { label: 'Palavra 3', maxLength: 14, multiline: false, choreo: 'word3' },
  },
  signature: {
    headline: { label: 'Headline', maxLength: 48, multiline: true, choreo: 'headline' },
    subtitle: { label: 'Subtítulo', maxLength: 80, multiline: true, choreo: 'subtitle' },
  },
};

const GRAPHICS: Record<SceneType, Record<string, GraphicMeta>> = {
  impact: {
    lightLine: { label: 'Linha luminosa', choreo: 'lightLine', intensityLabel: 'Brilho', description: 'Varredura de luz que revela a cena.' },
    geometry: { label: 'Geometria em profundidade', choreo: 'geometry', intensityLabel: 'Densidade', description: 'Molduras em perspectiva reveladas pela linha.' },
    particles: { label: 'Partículas', choreo: 'particles', intensityLabel: 'Quantidade', description: 'Poeira luminosa com seed fixa.' },
  },
  energy: {
    core: { label: 'Núcleo', choreo: 'core', intensityLabel: 'Brilho do pulso', description: 'Centro pulsante que emite ondas.' },
    rings: { label: 'Anéis e ticks', choreo: 'rings', intensityLabel: 'Velocidade de rotação', description: 'Anéis concêntricos e mostrador.' },
    grid: { label: 'Grade de pontos', choreo: 'grid', intensityLabel: 'Deslocamento da onda', description: 'Campo de pontos deslocado pelos pulsos.' },
    orbiters: { label: 'Satélites', choreo: 'orbiters', intensityLabel: 'Velocidade', description: 'Pontos em órbita nos anéis.' },
  },
  transformation: {
    frames: { label: 'Planos em profundidade', choreo: 'frames', intensityLabel: 'Densidade', description: 'Molduras atravessadas pela câmera.' },
    morph: { label: 'Forma coreografada', choreo: 'morph', intensityLabel: 'Amplitude', description: 'Forma que muda de posição, escala e cor.' },
    guides: { label: 'Guias de criação', choreo: 'guides', intensityLabel: 'Detalhe', description: 'Caixa de seleção, caminho de animação e raios.' },
  },
  signature: {
    markRing: { label: 'Assinatura — anel', choreo: 'markRing', intensityLabel: 'Espessura', description: 'Anel externo da assinatura geométrica.' },
    markDiamond: { label: 'Assinatura — losango', choreo: 'markDiamond', intensityLabel: 'Espessura', description: 'Quadrado rotacionado.' },
    markCore: { label: 'Assinatura — núcleo', choreo: 'markCore', intensityLabel: 'Brilho', description: 'Disco central e linha luminosa.' },
    shards: { label: 'Fragmentos', choreo: 'shards', intensityLabel: 'Quantidade', description: 'Elementos que convergem para a assinatura.' },
  },
};

const FORMAT_LABEL: Record<Format, string> = { portrait: 'Vertical 9:16', landscape: 'Horizontal 16:9' };

/* ------------------------------------------------------------------ */
/* Editable targets                                                    */
/* ------------------------------------------------------------------ */

const textSections = (base: FieldPath, meta: TextMeta): FieldSection[] => [
  {
    id: 'content',
    label: 'Conteúdo',
    fields: [
      field.text([...base, 'content'], 'Texto', { maxLength: meta.maxLength, multiline: meta.multiline, hint: meta.multiline ? 'Enter cria uma quebra manual.' : undefined }),
      field.lineBreaks([...base, 'breaks']),
      field.toggle([...base, 'visible'], 'Visível'),
    ],
  },
  {
    id: 'typography',
    label: 'Tipografia',
    fields: [
      field.select([...base, 'weight'], 'Peso', WEIGHTS),
      field.select([...base, 'stretch'], 'Largura', STRETCHES, true),
      field.number([...base, 'sizeScale'], 'Tamanho', { min: 0.4, max: 1.6, step: 0.01, unit: '%', displayScale: 100, hint: 'Relativo ao tamanho de layout. O texto nunca ultrapassa a área segura.' }),
      field.number([...base, 'tracking'], 'Tracking', { min: -0.12, max: 0.5, step: 0.005, unit: 'em' }),
      field.toggle([...base, 'uppercase'], 'Caixa alta'),
      field.toggle([...base, 'italic'], 'Itálico'),
    ],
  },
  { id: 'color', label: 'Cor', fields: [field.color([...base, 'color'], 'Cor do texto')] },
  {
    id: 'animation',
    label: 'Animação',
    fields: [field.number([...base, 'delay'], 'Atraso de entrada', { min: 0, max: 0.6, step: 0.01, unit: 's' })],
  },
];

const graphicSections = (base: FieldPath, meta: GraphicMeta): FieldSection[] => [
  {
    id: 'element',
    label: 'Elemento',
    fields: [
      field.toggle([...base, 'visible'], 'Visível'),
      field.color([...base, 'color'], 'Cor'),
      field.number([...base, 'opacity'], 'Opacidade', { min: 0, max: 1, step: 0.01, unit: '%', displayScale: 100 }),
      field.number([...base, 'intensity'], meta.intensityLabel, { min: 0, max: 2, step: 0.01, unit: '×' }),
    ],
  },
];

const sceneSections = (project: SignatureProject, index: number): FieldSection[] => {
  const scene = project.scenes[index]!;
  const base: FieldPath = ['scenes', index];
  const def = sceneTypeDef(scene.type);
  const fmt = project.format;
  const animation: FieldSection = {
    id: 'animation',
    label: 'Animação',
    fields: [
      ...(isDurationEditable(def)
        ? [field.number([...base, 'duration'], 'Duração da cena', { min: def.duration.min, max: def.duration.max, step: 0.1, unit: 's', hint: def.duration.note })]
        : []),
      field.number([...base, 'animation', 'intensity'], 'Intensidade / overshoot', { min: 0, max: 1.5, step: 0.01, unit: '×' }),
      field.number([...base, 'animation', 'pace'], 'Ritmo das entradas', { min: 0.75, max: 1.35, step: 0.01, unit: '×' }),
    ],
  };
  if (scene.type === 'energy') {
    animation.fields.push(field.number([...base, 'props', 'pulseRate'], 'Pulsos por segundo', { min: 0.6, max: 3, step: 0.05, unit: 'Hz' }));
  }
  if (scene.type === 'signature') {
    const words = scene.texts.headline.content.replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
    animation.fields.push(
      field.select([...base, 'props', 'highlightWord'], 'Palavra em destaque', [
        { value: -1, label: 'Nenhuma' },
        ...words.map((w, i) => ({ value: i, label: `${i + 1}. ${w}` })),
      ]),
    );
  }
  return [
    {
      id: 'content',
      label: 'Cena',
      fields: [field.text([...base, 'name'], 'Nome', { maxLength: 60, hint: `Instância de ${def.name}: editar esta cena não altera outras do mesmo tipo.` })],
    },
    {
      id: 'background',
      label: 'Background',
      fields: [field.background([...base, 'background'], 'Background', PROCEDURAL_VARIANTS)],
    },
    {
      id: 'color',
      label: 'Paleta da cena',
      fields: (['background', 'foreground', 'accent', 'secondary', 'surface'] as const).map((k) =>
        field.optionalColor([...base, 'palette', k], k[0]!.toUpperCase() + k.slice(1)),
      ),
    },
    {
      id: 'layout',
      label: `Layout — ${FORMAT_LABEL[fmt]}`,
      fields: [
        field.select([...base, 'layout', fmt, 'align'], 'Alinhamento', [
          { value: 'start', label: 'Início' },
          { value: 'center', label: 'Centro' },
          { value: 'end', label: 'Fim' },
        ], true),
        field.number([...base, 'layout', fmt, 'scale'], 'Escala do bloco', { min: 0.7, max: 1.3, step: 0.01, unit: '%', displayScale: 100 }),
        field.number([...base, 'layout', fmt, 'offsetX'], 'Deslocamento X', { min: -0.25, max: 0.25, step: 0.005, unit: '%', displayScale: 100 }),
        field.number([...base, 'layout', fmt, 'offsetY'], 'Deslocamento Y', { min: -0.25, max: 0.25, step: 0.005, unit: '%', displayScale: 100 }),
      ],
    },
    animation,
  ];
};

export const getEditableTargets = (project: SignatureProject): EditableTarget[] => {
  const targets: EditableTarget[] = [
    {
      id: 'project',
      label: 'Projeto e tema',
      kind: 'project',
      sceneId: null,
      sections: [
        {
          id: 'theme',
          label: 'Tema',
          fields: (['background', 'foreground', 'accent', 'secondary', 'surface'] as const).map((k) =>
            field.color(['theme', k], k[0]!.toUpperCase() + k.slice(1), false),
          ),
        },
        {
          id: 'content',
          label: 'Projeto',
          fields: [
            field.text(['name'], 'Nome do projeto', { maxLength: 80 }),
            field.select(['fps'], 'Frame rate', [
              { value: 30, label: '30 fps' },
              { value: 60, label: '60 fps' },
            ], true),
          ],
        },
        {
          id: 'audio',
          label: 'Trilha sonora',
          fields: [
            field.asset(['audio', 'assetId'], 'Arquivo de áudio', 'audio'),
            field.number(['audio', 'volume'], 'Volume', { min: 0, max: 1, step: 0.01, unit: '%', displayScale: 100 }),
            field.number(['audio', 'fadeIn'], 'Fade in', { min: 0, max: 5, step: 0.1, unit: 's' }),
            field.number(['audio', 'fadeOut'], 'Fade out', { min: 0, max: 5, step: 0.1, unit: 's' }),
          ],
        },
      ],
    },
    {
      id: 'global.hud',
      label: 'HUD editorial',
      kind: 'overlay',
      sceneId: null,
      visibilityPath: ['globals', 'hud', 'visible'],
      description: 'Rótulos, cantoneiras, timecode e barra de progresso.',
      sections: [
        {
          id: 'content',
          label: 'Rótulos',
          fields: [
            field.text(['globals', 'hud', 'labelLeft'], 'Rótulo esquerdo', { maxLength: 40 }),
            field.text(['globals', 'hud', 'labelRight'], 'Rótulo direito', { maxLength: 40 }),
            field.toggle(['globals', 'hud', 'timecode'], 'Timecode'),
            field.toggle(['globals', 'hud', 'progress'], 'Barra de progresso'),
          ],
        },
        ...graphicSections(['globals', 'hud'], { label: 'HUD', choreo: '', intensityLabel: 'Escala', description: '' }),
      ],
    },
    {
      id: 'global.grain',
      label: 'Granulação',
      kind: 'overlay',
      sceneId: null,
      visibilityPath: ['globals', 'grain', 'visible'],
      sections: graphicSections(['globals', 'grain'], { label: 'Grain', choreo: '', intensityLabel: 'Quantidade', description: '' }),
    },
    {
      id: 'global.vignette',
      label: 'Vinheta',
      kind: 'overlay',
      sceneId: null,
      visibilityPath: ['globals', 'vignette', 'visible'],
      sections: graphicSections(['globals', 'vignette'], { label: 'Vinheta', choreo: '', intensityLabel: 'Alcance', description: '' }),
    },
  ];

  project.scenes.forEach((scene, index) => {
    targets.push({
      id: scene.id,
      label: scene.name,
      kind: 'scene',
      sceneId: scene.id,
      description: SCENE_INFO[scene.type].description,
      sections: sceneSections(project, index),
    });
    for (const [key, meta] of Object.entries(TEXTS[scene.type])) {
      targets.push({
        id: `${scene.id}.${key}`,
        label: meta.label,
        kind: 'text',
        sceneId: scene.id,
        visibilityPath: ['scenes', index, 'texts', key, 'visible'],
        sections: textSections(['scenes', index, 'texts', key], meta),
      });
    }
    for (const [key, meta] of Object.entries(GRAPHICS[scene.type])) {
      targets.push({
        id: `${scene.id}.${key}`,
        label: meta.label,
        kind: 'graphic',
        sceneId: scene.id,
        description: meta.description,
        visibilityPath: ['scenes', index, 'elements', key, 'visible'],
        sections: graphicSections(['scenes', index, 'elements', key], meta),
      });
    }
  });
  return targets;
};

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

const choreoFor = (scene: AnyScene, key: string): { in: number; dur: number } => {
  const table = CHOREO[scene.type] as unknown as Record<string, { in: number; dur: number }>;
  const entry = table[key] ?? { in: 0, dur: scene.duration };
  if (scene.type === 'transformation') {
    return { in: transformationToScene(entry.in, scene.duration), dur: transformationToScene(entry.dur, scene.duration) };
  }
  return entry;
};

export const getTimeline = (project: SignatureProject): TimelineModel => {
  const fps = project.fps;
  const ranges = computeSceneRanges(project.scenes, fps);
  const layers: TimelineLayer[] = [];

  // Only enabled scenes are on the timeline; field paths still use the project index.
  for (const range of ranges) {
    const index = range.index;
    const scene = project.scenes[index]!;
    const toFrame = (s: number) => range.from + Math.round(s * fps);
    const sceneEnd = range.from + range.durationInFrames;
    const exitLead = scene.type === 'signature' ? CHOREO.signature.outro : CHOREO[scene.type].exit;
    const exitFrame = Math.max(range.from, sceneEnd - Math.round(exitLead * fps));

    layers.push({
      id: `${scene.id}.background`,
      label: 'Background',
      kind: 'background',
      sceneId: scene.id,
      targetId: scene.id,
      clips: [{ from: range.from, durationInFrames: range.durationInFrames, label: scene.background.mode }],
      markers: [],
      hidden: false,
    });

    const addLayer = (key: string, label: string, kind: 'text' | 'graphic', visible: boolean, delay: number, delayIndexPath?: FieldPath) => {
      const c = choreoFor(scene, key);
      const start = entranceAt(c.in, scene.animation, delay);
      const fromFrame = Math.min(sceneEnd - 1, toFrame(start));
      layers.push({
        id: `${scene.id}.${key}`,
        label,
        kind,
        sceneId: scene.id,
        targetId: `${scene.id}.${key}`,
        clips: [{ from: fromFrame, durationInFrames: Math.max(1, sceneEnd - fromFrame) }],
        markers: [
          { frame: fromFrame, label: 'Entrada', kind: 'in' },
          { frame: Math.min(sceneEnd - 1, toFrame(start + c.dur / scene.animation.pace)), label: 'Assentado', kind: 'beat' },
          { frame: exitFrame, label: 'Saída', kind: 'out' },
        ],
        hidden: !visible,
        ...(delayIndexPath ? { delay: { path: delayIndexPath, min: 0, max: 0.6 } } : {}),
      });
    };

    for (const [key, meta] of Object.entries(TEXTS[scene.type])) {
      const el = (scene.texts as Record<string, { visible: boolean; delay: number }>)[key]!;
      addLayer(key, meta.label, 'text', el.visible, el.delay, ['scenes', index, 'texts', key, 'delay']);
    }
    for (const [key, meta] of Object.entries(GRAPHICS[scene.type])) {
      const el = (scene.elements as Record<string, { visible: boolean }>)[key]!;
      addLayer(key, meta.label, 'graphic', el.visible, 0);
    }
  }

  const durationInFrames = ranges.reduce((a, r) => a + r.durationInFrames, 0);
  layers.push({
    id: 'global.hud',
    label: 'HUD editorial',
    kind: 'overlay',
    sceneId: null,
    targetId: 'global.hud',
    clips: [{ from: 0, durationInFrames }],
    markers: ranges.map((r, i) => ({ frame: r.from, label: `Cena ${i + 1}`, kind: 'transition' as const })),
    hidden: !project.globals.hud.visible,
  });
  if (project.audio.assetId) {
    layers.push({
      id: 'project.audio',
      label: 'Trilha sonora',
      kind: 'audio',
      sceneId: null,
      targetId: 'project',
      clips: [{ from: 0, durationInFrames, label: 'Áudio' }],
      markers: [],
      hidden: project.audio.volume === 0,
    });
  }

  return {
    fps,
    durationInFrames,
    scenes: ranges.map((range) => {
      const scene = project.scenes[range.index]!;
      const def = sceneTypeDef(scene.type);
      return {
        id: scene.id,
        label: scene.name,
        index: range.order,
        typeId: scene.type,
        typeLabel: def.name,
        from: range.from,
        durationInFrames: range.durationInFrames,
        targetId: scene.id,
        ...(isDurationEditable(def) ? { duration: { path: ['scenes', range.index, 'duration'], min: def.duration.min, max: def.duration.max } } : {}),
      };
    }),
    layers,
  };
};

/* ------------------------------------------------------------------ */
/* Definition                                                          */
/* ------------------------------------------------------------------ */

export const signatureDefinition = defineTemplate<SignatureProject>({
  id: TEMPLATE_ID,
  name: 'Signature / 001',
  version: TEMPLATE_VERSION,
  description:
    'THE FUTURE IS BUILT — filme promocional cinematográfico: tipografia cinética, geometria em profundidade e uma assinatura visual final. Quatro cenas reutilizáveis, em qualquer ordem e quantidade.',
  tags: ['cinematic', 'kinetic type', 'tech', 'promo'],
  formats: FORMATS,
  schema: signatureProjectSchema,
  sceneTypes: SIGNATURE_SCENE_TYPES,
  createDefaults: createSignatureDefaults,
  createScene: createSignatureScene,
  // 1.0.0 -> 1.1.0: the envelope migration (schema v2) already turned the fixed scenes
  // into instances (type = old id, enabled = true); every field value is unchanged.
  migrate: (raw) => ({ ...raw, templateVersion: TEMPLATE_VERSION }),
  getMetadata: (project) => sequentialMetadata(project),
  getEditableTargets,
  getTimeline,
});

