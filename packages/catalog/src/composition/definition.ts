import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  FORMATS,
  backgroundSchema,
  createBackground,
  graphicElementSchema,
  projectBaseShape,
  scenesArray,
  type MotionProject,
} from '@lms/shared';
import { defineTemplate, field, sceneSequenceTimeline, sequentialMetadata, type EditableTarget, type TimelineModel } from '@lms/template-sdk';
import { PROCEDURAL_VARIANTS, TYPEFACE_IDS, TYPEFACE_OPTIONS, graphicSections } from '@lms/scene-kit/fields';
import { sceneDefinitions } from '../scenes';

/**
 * Free composition: a project that belongs to no storyboard. It starts empty and accepts
 * every scene type of the global library, from any family, in any order. It is a native
 * template like any other, so the editor, timeline, persistence and render pipeline are
 * the same ones Signature / 001 uses.
 */

export const COMPOSITION_TEMPLATE_ID = 'composition';
export const COMPOSITION_VERSION = '1.0.0';

/** Neutral, premium default palette (scenes may keep their own via palette overrides). */
export const COMPOSITION_THEME = {
  background: '#07080C',
  foreground: '#F4F5F8',
  accent: '#FF5A36',
  secondary: '#4D7CFF',
  surface: '#14161E',
} as const;

const sceneTypeSchemas = sceneDefinitions.list().map((t) => t.schema);

/** Any registered scene type, validated by its own schema (discriminated by `type`). */
const anySceneSchema = (
  sceneTypeSchemas.length === 1 ? sceneTypeSchemas[0]! : z.discriminatedUnion('type', sceneTypeSchemas as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]])
) as z.ZodType<MotionProject['scenes'][number]>;

export const compositionGlobalsSchema = z.object({
  style: z.object({
    /** Base display typeface inherited by scene types that support it. */
    typeface: z.enum(TYPEFACE_IDS),
    /** Background painted by scenes whose background mode is "inherit". */
    background: backgroundSchema.refine((b) => b.mode !== 'inherit', 'The default background cannot inherit'),
  }),
  grain: graphicElementSchema,
  vignette: graphicElementSchema,
});
export type CompositionGlobals = z.infer<typeof compositionGlobalsSchema>;

export const compositionProjectSchema = z.object({
  ...projectBaseShape,
  templateId: z.literal(COMPOSITION_TEMPLATE_ID),
  scenes: scenesArray(anySceneSchema, { allowEmpty: true }),
  globals: compositionGlobalsSchema,
});
export type CompositionProject = z.infer<typeof compositionProjectSchema>;

export const createCompositionGlobals = (): CompositionGlobals => ({
  style: { typeface: 'archivo', background: createBackground({ variant: 'void' }) },
  grain: { visible: true, color: '#FFFFFF', opacity: 1, intensity: 0.8 },
  vignette: { visible: true, color: '#000000', opacity: 0.6, intensity: 1 },
});

const sceneType = (type: string) => sceneDefinitions.get(type);

const getEditableTargets = (project: CompositionProject): EditableTarget[] => {
  const targets: EditableTarget[] = [
    {
      id: 'project',
      label: 'Composição e estilo',
      kind: 'project',
      sceneId: null,
      description: 'Estilo global opcional: cenas herdam a paleta por tokens e o background quando usam "Herdar".',
      sections: [
        {
          id: 'theme',
          label: 'Paleta da composição',
          fields: (['background', 'foreground', 'accent', 'secondary', 'surface'] as const).map((k) =>
            field.color(['theme', k], k === 'accent' ? 'Destaque' : k === 'secondary' ? 'Secundária' : k[0]!.toUpperCase() + k.slice(1), false),
          ),
        },
        {
          id: 'typography',
          label: 'Tipografia base',
          fields: [
            field.select(['globals', 'style', 'typeface'], 'Fonte de títulos', TYPEFACE_OPTIONS),
          ],
        },
        {
          id: 'background',
          label: 'Background padrão',
          fields: [field.background(['globals', 'style', 'background'], 'Usado por cenas em "Herdar"', PROCEDURAL_VARIANTS)],
        },
        {
          id: 'content',
          label: 'Projeto',
          fields: [
            field.text(['name'], 'Nome', { maxLength: 80 }),
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
      id: 'global.grain',
      label: 'Granulação',
      kind: 'overlay',
      sceneId: null,
      visibilityPath: ['globals', 'grain', 'visible'],
      sections: graphicSections(['globals', 'grain'], { intensityLabel: 'Quantidade' }),
    },
    {
      id: 'global.vignette',
      label: 'Vinheta',
      kind: 'overlay',
      sceneId: null,
      visibilityPath: ['globals', 'vignette', 'visible'],
      sections: graphicSections(['globals', 'vignette'], { intensityLabel: 'Alcance' }),
    },
  ];
  project.scenes.forEach((scene, index) => {
    targets.push(...sceneType(scene.type).targets(scene, { index, format: project.format, inheritBackground: true }));
  });
  return targets;
};

const getTimeline = (project: CompositionProject): TimelineModel => {
  const { scenes, layers, durationInFrames } = sceneSequenceTimeline(project, sceneType);
  if (project.audio.assetId && durationInFrames > 0) {
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
  return { fps: project.fps, durationInFrames, scenes, layers };
};

export const compositionDefinition = defineTemplate<CompositionProject>({
  id: COMPOSITION_TEMPLATE_ID,
  name: 'Composição livre',
  version: COMPOSITION_VERSION,
  description: 'Timeline vazia: combine cenas de qualquer família da biblioteca, personalize cada uma e exporte — ou salve como template.',
  tags: ['free', 'library'],
  formats: FORMATS,
  mode: 'free',
  allowEmpty: true,
  schema: compositionProjectSchema,
  sceneTypes: sceneDefinitions.list(),
  createDefaults: (init) => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: init.id,
    name: init.name,
    templateId: COMPOSITION_TEMPLATE_ID,
    templateVersion: COMPOSITION_VERSION,
    format: init.format,
    fps: init.fps ?? 30,
    theme: { ...COMPOSITION_THEME },
    audio: { assetId: null, volume: 0.9, fadeIn: 0, fadeOut: 1.2 },
    assets: [],
    origin: { kind: 'blank' },
    createdAt: init.now,
    updatedAt: init.now,
    scenes: [],
    globals: createCompositionGlobals(),
  }),
  createScene: (type, init) => sceneType(type).create(init),
  getMetadata: (project) => sequentialMetadata(project),
  getEditableTargets,
  getTimeline,
});

/**
 * Converts any project whose scenes all exist in the global library into a free
 * composition (keeps scenes, theme, audio, assets and the matching global overlays).
 * Used to save a template-based project as a user template.
 */
export const toComposition = (project: MotionProject): CompositionProject => {
  if (project.templateId === COMPOSITION_TEMPLATE_ID) return compositionProjectSchema.parse(project);
  const unknown = project.scenes.find((s) => !sceneDefinitions.has(s.type));
  if (unknown) throw new Error(`A cena “${unknown.name}” usa um tipo que não está na biblioteca global (${unknown.type}).`);
  const globals = createCompositionGlobals();
  const g = project.globals as Partial<Record<'grain' | 'vignette', unknown>>;
  const grain = graphicElementSchema.safeParse(g.grain);
  const vignette = graphicElementSchema.safeParse(g.vignette);
  return compositionProjectSchema.parse({
    ...project,
    templateId: COMPOSITION_TEMPLATE_ID,
    templateVersion: COMPOSITION_VERSION,
    globals: { ...globals, grain: grain.success ? grain.data : globals.grain, vignette: vignette.success ? vignette.data : globals.vignette },
  });
};
