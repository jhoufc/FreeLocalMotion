import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  createBackground,
  emptyPaletteOverride,
  motionProjectSchema,
  projectBaseShape,
  sceneBaseShape,
  textElementSchema,
  type MotionProject,
} from '@lms/shared';
import { computeSceneRanges, createTemplateRegistry, defineTemplate, field, parseProjectForTemplate, sequentialMetadata, type AnyTemplateDefinition, TemplateRegistryError } from '../src';

/**
 * A deliberately tiny second template ("kinetic-numbers") written only against the
 * SDK. If this registers and works through the generic APIs, a new template can be
 * added without touching the editor (acceptance criterion 15).
 */
const numbersScene = z.object({ ...sceneBaseShape, texts: z.object({ value: textElementSchema }) });
const numbersSchema = z.object({ ...projectBaseShape, templateId: z.literal('kinetic-numbers'), scenes: z.tuple([numbersScene]), globals: z.object({}) });
type NumbersProject = z.infer<typeof numbersSchema>;

const numbersTemplate = defineTemplate<NumbersProject>({
  id: 'kinetic-numbers',
  name: 'Kinetic Numbers',
  version: '0.1.0',
  description: 'Test template',
  tags: ['test'],
  formats: ['portrait', 'landscape'],
  schema: numbersSchema,
  createDefaults: ({ id, name, format, now, fps }) => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    name,
    templateId: 'kinetic-numbers',
    templateVersion: '0.1.0',
    format,
    fps: fps ?? 30,
    theme: { background: '#000000', foreground: '#FFFFFF', accent: '#FF0000', secondary: '#00FF00', surface: '#111111' },
    audio: { assetId: null, volume: 1, fadeIn: 0, fadeOut: 0 },
    assets: [],
    createdAt: now,
    updatedAt: now,
    scenes: [
      {
        id: 'count',
        name: 'Count',
        duration: 2,
        background: createBackground({ variant: 'plain' }),
        palette: emptyPaletteOverride(),
        layout: { portrait: { align: 'center', scale: 1, offsetX: 0, offsetY: 0 }, landscape: { align: 'center', scale: 1, offsetX: 0, offsetY: 0 } },
        texts: {
          value: {
            visible: true,
            content: '1,000,000',
            color: '$foreground',
            weight: 800,
            italic: false,
            uppercase: false,
            stretch: 'normal',
            sizeScale: 1,
            tracking: 0,
            breaks: { portrait: 'single', landscape: 'single' },
            delay: 0,
          },
        },
      },
    ],
    globals: {},
  }),
  getMetadata: (p) => sequentialMetadata(p),
  getEditableTargets: () => [
    { id: 'count.value', label: 'Value', kind: 'text', sceneId: 'count', sections: [{ id: 'content', label: 'Content', fields: [field.text(['scenes', 0, 'texts', 'value', 'content'], 'Value')] }] },
  ],
  getTimeline: (p) => ({ fps: p.fps, durationInFrames: sequentialMetadata(p).durationInFrames, scenes: [], layers: [] }),
});

const asAny = (t: unknown) => t as AnyTemplateDefinition;

describe('template registry', () => {
  it('registers, lists and summarizes templates', () => {
    const reg = createTemplateRegistry([asAny(numbersTemplate)]);
    expect(reg.has('kinetic-numbers')).toBe(true);
    expect(reg.list()).toHaveLength(1);
    expect(reg.summaries()[0]).toMatchObject({ id: 'kinetic-numbers', durationSeconds: 2, formats: ['portrait', 'landscape'] });
  });

  it('rejects duplicates and unknown lookups', () => {
    const reg = createTemplateRegistry([asAny(numbersTemplate)]);
    expect(() => reg.register(asAny(numbersTemplate))).toThrow(TemplateRegistryError);
    expect(() => reg.get('nope')).toThrow(TemplateRegistryError);
    expect(reg.find('nope')).toBeUndefined();
  });

  it('rejects a template whose defaults violate its own schema', () => {
    const broken = { ...numbersTemplate, id: 'broken', createDefaults: (i: Parameters<typeof numbersTemplate.createDefaults>[0]) => ({ ...numbersTemplate.createDefaults(i), fps: 24 }) };
    expect(() => createTemplateRegistry([asAny(broken)])).toThrow(/defaults are invalid/);
  });

  it('every template project is a valid generic MotionProject envelope', () => {
    const p = numbersTemplate.createDefaults({ id: 'p-abcdef', name: 'x', format: 'landscape', now: 'now' });
    expect(motionProjectSchema.safeParse(p).success).toBe(true);
  });
});

describe('project parsing', () => {
  const base = numbersTemplate.createDefaults({ id: 'p-abcdef', name: 'x', format: 'portrait', now: 'now' });

  it('accepts valid projects', () => {
    const r = parseProjectForTemplate(numbersTemplate, base);
    expect(r.ok).toBe(true);
  });

  it('reports schema issues with paths', () => {
    const bad = structuredClone(base) as MotionProject & { scenes: { texts: { value: { weight: number } } }[] };
    bad.scenes[0]!.texts.value.weight = 5000;
    const r = parseProjectForTemplate(numbersTemplate, bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.path).toBe('scenes.0.texts.value.weight');
  });

  it('rejects projects of another template and dangling assets', () => {
    expect(parseProjectForTemplate(numbersTemplate, { ...base, templateId: 'other' }).ok).toBe(false);
    const dangling = structuredClone(base);
    dangling.scenes[0]!.background.image.assetId = 'a-missing1';
    const r = parseProjectForTemplate(numbersTemplate, dangling);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]!.message).toMatch(/Missing asset/);
  });

  it('computes sequential scene ranges at any fps', () => {
    const scenes = [
      { id: 'a', duration: 3 },
      { id: 'b', duration: 1.5 },
    ];
    expect(computeSceneRanges(scenes, 30)).toEqual([
      { id: 'a', index: 0, from: 0, durationInFrames: 90 },
      { id: 'b', index: 1, from: 90, durationInFrames: 45 },
    ]);
    expect(computeSceneRanges(scenes, 60)[1]).toMatchObject({ from: 180, durationInFrames: 90 });
  });
});
