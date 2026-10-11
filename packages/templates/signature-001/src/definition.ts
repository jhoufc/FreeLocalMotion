import { FORMATS } from '@lms/shared';
import {
  defineTemplate,
  sceneSequenceTimeline,
  field,
  sequentialMetadata,
  type AnySceneTypeDefinition,
  type EditableTarget,
  type TimelineModel,
} from '@lms/template-sdk';
import { graphicSections, PROCEDURAL_VARIANTS } from '@lms/scene-kit/fields';
import { createSignatureDefaults, createSignatureScene } from './defaults';
import { SIGNATURE_SCENE_TYPES } from './sceneTypes';
import { TEMPLATE_ID, TEMPLATE_VERSION, signatureProjectSchema, type SignatureProject } from './schema';

export { PROCEDURAL_VARIANTS };
export { SIGNATURE_SCENE_TYPES };

const sceneTypeOfScene = (type: string): AnySceneTypeDefinition => SIGNATURE_SCENE_TYPES.find((t) => t.id === type)!;

/* ------------------------------------------------------------------ */
/* Editable targets                                                    */
/* ------------------------------------------------------------------ */

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
        ...graphicSections(['globals', 'hud'], { intensityLabel: 'Escala' }),
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
    targets.push(...sceneTypeOfScene(scene.type).targets(scene, { index, format: project.format, inheritBackground: false }));
  });
  return targets;
};

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export const getTimeline = (project: SignatureProject): TimelineModel => {
  const { scenes, layers, durationInFrames } = sceneSequenceTimeline(project, sceneTypeOfScene);
  layers.push({
    id: 'global.hud',
    label: 'HUD editorial',
    kind: 'overlay',
    sceneId: null,
    targetId: 'global.hud',
    clips: [{ from: 0, durationInFrames }],
    markers: scenes.map((s) => ({ frame: s.from, label: `Cena ${s.index + 1}`, kind: 'transition' as const })),
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
  return { fps: project.fps, durationInFrames, scenes, layers };
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
  mode: 'template',
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
