import type { FieldPath, Format, MotionSceneBase } from '@lms/shared';
import {
  field,
  isDurationEditable,
  type EditableTarget,
  type FieldDescriptor,
  type FieldSection,
  type SceneDefinition,
  type SceneLayerContext,
  type TimelineLayer,
} from '@lms/template-sdk';

/**
 * Data-only builders shared by every scene type (no React): inspector sections and
 * timeline layers. Scene types describe *what* is editable with these; the Studio's
 * generic inspector decides how to render it.
 */

export const PROCEDURAL_VARIANTS = [
  { value: 'void', label: 'Void — grade e luz' },
  { value: 'radial', label: 'Radial — núcleo luminoso' },
  { value: 'tunnel', label: 'Tunnel — profundidade' },
  { value: 'aurora', label: 'Aurora — campos de cor' },
] as const;

/** Base typography options of free compositions (ids map to bundled font families in the kit). */
export const TYPEFACE_IDS = ['archivo', 'inter', 'mono'] as const;
export const TYPEFACE_OPTIONS = [
  { value: 'archivo', label: 'Archivo — expressiva' },
  { value: 'inter', label: 'Inter — neutra' },
  { value: 'mono', label: 'JetBrains Mono — técnica' },
] as const;

export const WEIGHTS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'Extra' },
  { value: 900, label: 'Black' },
];

export const STRETCHES = [
  { value: 'condensed', label: 'Condensed' },
  { value: 'normal', label: 'Normal' },
  { value: 'expanded', label: 'Expanded' },
];

const FORMAT_LABEL: Record<Format, string> = { portrait: 'Vertical 9:16', landscape: 'Horizontal 16:9' };

export interface TextMeta {
  label: string;
  maxLength: number;
  multiline: boolean;
}

export interface GraphicMeta {
  label: string;
  intensityLabel: string;
  description: string;
}

export const textSections = (base: FieldPath, meta: TextMeta, opts: { delayMax?: number } = {}): FieldSection[] => [
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
    fields: [field.number([...base, 'delay'], 'Atraso de entrada', { min: 0, max: opts.delayMax ?? 0.6, step: 0.01, unit: 's' })],
  },
];

export const graphicSections = (base: FieldPath, meta: Pick<GraphicMeta, 'intensityLabel'>): FieldSection[] => [
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

/** Duration (when the type allows it) + the standard intensity / pace knobs. */
export const standardAnimationFields = (base: FieldPath, def: SceneDefinition, opts: { pace?: boolean } = {}): FieldDescriptor[] => [
  ...(isDurationEditable(def)
    ? [field.number([...base, 'duration'], 'Duração da cena', { min: def.duration.min, max: def.duration.max, step: 0.1, unit: 's', hint: def.duration.note })]
    : []),
  field.number([...base, 'animation', 'intensity'], 'Intensidade / overshoot', { min: 0, max: 1.5, step: 0.01, unit: '×' }),
  ...(opts.pace === false ? [] : [field.number([...base, 'animation', 'pace'], 'Ritmo das entradas', { min: 0.75, max: 1.35, step: 0.01, unit: '×' })]),
];

/**
 * The scene-level inspector: name, scene-specific content, background, palette, layout for
 * the active format and animation. Every scene type uses the same structure.
 */
export const sceneSections = (opts: {
  base: FieldPath;
  def: SceneDefinition;
  format: Format;
  inheritBackground: boolean;
  /** Scene-specific content controls (numbers, lists, options) shown under the name. */
  contentFields?: FieldDescriptor[];
  animationFields: FieldDescriptor[];
}): FieldSection[] => {
  const { base, def, format: fmt } = opts;
  return [
    {
      id: 'content',
      label: 'Cena',
      fields: [
        field.text([...base, 'name'], 'Nome', { maxLength: 60, hint: `Instância de ${def.name}: editar esta cena não altera outras do mesmo tipo.` }),
        ...(opts.contentFields ?? []),
      ],
    },
    { id: 'background', label: 'Background', fields: [field.background([...base, 'background'], 'Background', PROCEDURAL_VARIANTS, opts.inheritBackground)] },
    {
      id: 'color',
      label: 'Paleta da cena',
      fields: (['background', 'foreground', 'accent', 'secondary', 'surface'] as const).map((k) =>
        field.optionalColor([...base, 'palette', k], k[0]!.toUpperCase() + k.slice(1), 'Herdar da composição'),
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
    { id: 'animation', label: 'Animação', fields: opts.animationFields },
  ];
};

/** Scene target + one target per text and graphic element of an instance. */
export const instanceTargets = (opts: {
  scene: MotionSceneBase;
  index: number;
  description: string;
  sections: FieldSection[];
  texts: Record<string, TextMeta>;
  graphics: Record<string, GraphicMeta>;
  textDelayMax?: number;
}): EditableTarget[] => {
  const { scene, index } = opts;
  const targets: EditableTarget[] = [
    { id: scene.id, label: scene.name, kind: 'scene', sceneId: scene.id, description: opts.description, sections: opts.sections },
  ];
  for (const [key, meta] of Object.entries(opts.texts)) {
    targets.push({
      id: `${scene.id}.${key}`,
      label: meta.label,
      kind: 'text',
      sceneId: scene.id,
      visibilityPath: ['scenes', index, 'texts', key, 'visible'],
      sections: textSections(['scenes', index, 'texts', key], meta, { delayMax: opts.textDelayMax }),
    });
  }
  for (const [key, meta] of Object.entries(opts.graphics)) {
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
  return targets;
};

export interface ChoreoEntry {
  key: string;
  label: string;
  kind: 'text' | 'graphic';
  /** Entrance start and settle time, scene seconds (pace/delay already applied). */
  start: number;
  settle: number;
  visible: boolean;
  /** Path of the entrance delay, makes the clip draggable on the timeline. */
  delay?: { path: FieldPath; max: number };
}

/** Timeline layers of one instance: a background clip plus a clip per element with in/settle/out markers. */
export const choreoLayers = (scene: MotionSceneBase, ctx: SceneLayerContext, entries: readonly ChoreoEntry[], exitLead: number): TimelineLayer[] => {
  const { range, fps } = ctx;
  const sceneEnd = range.from + range.durationInFrames;
  const toFrame = (s: number) => range.from + Math.round(s * fps);
  const exitFrame = Math.max(range.from, sceneEnd - Math.round(exitLead * fps));
  const layers: TimelineLayer[] = [
    {
      id: `${scene.id}.background`,
      label: 'Background',
      kind: 'background',
      sceneId: scene.id,
      targetId: scene.id,
      clips: [{ from: range.from, durationInFrames: range.durationInFrames, label: scene.background.mode }],
      markers: [],
      hidden: false,
    },
  ];
  for (const e of entries) {
    const fromFrame = Math.min(sceneEnd - 1, toFrame(e.start));
    layers.push({
      id: `${scene.id}.${e.key}`,
      label: e.label,
      kind: e.kind,
      sceneId: scene.id,
      targetId: `${scene.id}.${e.key}`,
      clips: [{ from: fromFrame, durationInFrames: Math.max(1, sceneEnd - fromFrame) }],
      markers: [
        { frame: fromFrame, label: 'Entrada', kind: 'in' },
        { frame: Math.min(sceneEnd - 1, toFrame(e.settle)), label: 'Assentado', kind: 'beat' },
        { frame: exitFrame, label: 'Saída', kind: 'out' },
      ],
      hidden: !e.visible,
      ...(e.delay ? { delay: { path: e.delay.path, min: 0, max: e.delay.max } } : {}),
    });
  }
  return layers;
};

export * from './sceneType';
