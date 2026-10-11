import { describe, expect, it } from 'vitest';
import { FORMATS, getAtPath, setAtPath, type MotionProject } from '@lms/shared';
import { computeSceneRanges, duplicateScene, insertScene, type FieldDescriptor, type ListFieldDescriptor } from '@lms/template-sdk';
import { COMPOSITION_TEMPLATE_ID, sceneDefinitions, templateDefinitions } from '@lms/catalog/definitions';
import { PREMIUM_SCENE_TYPES } from '../src/definitions';
import { formatNumber } from '../src/scenes/numberImpact';

const template = templateDefinitions.get(COMPOSITION_TEMPLATE_ID);
const blank = (format: 'portrait' | 'landscape' = 'landscape'): MotionProject =>
  template.createDefaults({ id: 'p-premium', name: 'Premium', format, now: '2026-01-01T00:00:00.000Z' });

/** A composition holding one instance of every premium type. */
const withAll = (format: 'portrait' | 'landscape' = 'landscape') => {
  let p = blank(format);
  for (const t of PREMIUM_SCENE_TYPES) p = insertScene(p, template.createScene(t.id, { id: `${t.id}-1`, name: t.name }));
  return p;
};

const allFields = (fields: readonly FieldDescriptor[]): readonly FieldDescriptor[] => fields;

describe('premium scene pack', () => {
  it('20: ships 8 distinct scene types, registered in the global library and the free composition', () => {
    const ids = PREMIUM_SCENE_TYPES.map((t) => t.id);
    expect(ids).toEqual(['kinetic-type', 'glass-panels', 'number-impact', 'orbital-data', 'product-reveal', 'grid-breakdown', 'editorial-split', 'cinematic-outro']);
    for (const id of ids) {
      expect(sceneDefinitions.has(id)).toBe(true);
      expect(template.sceneTypes.some((t) => t.id === id)).toBe(true);
    }
    expect(new Set(PREMIUM_SCENE_TYPES.map((t) => t.category))).toEqual(new Set(['typography', 'product', 'data', 'technology', 'abstract', 'editorial', 'signature']));
    expect(sceneDefinitions.categories()).toEqual(['typography', 'technology', 'product', 'data', 'abstract', 'editorial', 'signature']);
    for (const t of PREMIUM_SCENE_TYPES) {
      expect(t.family).toEqual({ id: 'studio-premium', name: 'Studio Premium' });
      expect(t.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(t.heroTime).toBeLessThan(t.duration.default);
    }
  });

  it.each(FORMATS)('3: every premium type validates in a composition (%s)', (format) => {
    const p = withAll(format);
    expect(template.schema.safeParse(p).success).toBe(true);
    expect(template.getMetadata(p).durationInFrames).toBe(PREMIUM_SCENE_TYPES.reduce((a, t) => a + Math.round(t.duration.default * 30), 0));
  });

  it.each(FORMATS)('8: every inspector field resolves to a value and lists respect their bounds (%s)', (format) => {
    const p = withAll(format);
    const targets = template.getEditableTargets(p);
    for (const target of targets) {
      for (const section of target.sections) {
        for (const f of allFields(section.fields)) {
          expect(getAtPath(p, f.path), `${target.id} -> ${f.path.join('.')}`).not.toBeUndefined();
          if (f.type === 'list') {
            const list = f as ListFieldDescriptor;
            const items = getAtPath(p, list.path) as unknown[];
            expect(items.length).toBeGreaterThanOrEqual(list.min);
            expect(items.length).toBeLessThanOrEqual(list.max);
            // Bounds of the descriptor match the schema.
            expect(template.schema.safeParse(setAtPath(p, list.path, Array.from({ length: list.max }, () => list.newItem))).success).toBe(true);
            expect(template.schema.safeParse(setAtPath(p, list.path, Array.from({ length: list.max + 1 }, () => list.newItem))).success).toBe(false);
            expect(template.schema.safeParse(setAtPath(p, list.path, Array.from({ length: Math.max(0, list.min - 1) }, () => list.newItem))).success).toBe(list.min === 0);
            for (const item of list.itemFields) expect(getAtPath(items[0], item.path), `${list.path.join('.')}[0].${item.path.join('.')}`).not.toBeUndefined();
          }
          if (f.type === 'number') {
            expect(template.schema.safeParse(setAtPath(p, f.path, f.min)).success, `${f.path.join('.')} min`).toBe(true);
            expect(template.schema.safeParse(setAtPath(p, f.path, f.max)).success, `${f.path.join('.')} max`).toBe(true);
          }
        }
      }
      if (target.visibilityPath) expect(typeof getAtPath(p, target.visibilityPath)).toBe('boolean');
    }
    // Free compositions offer the "inherit" background on scenes.
    const bg = targets.find((t) => t.id === 'kinetic-type-1')!.sections.flatMap((s) => s.fields).find((f) => f.type === 'background');
    expect(bg).toMatchObject({ allowInherit: true });
  });

  it('timeline layers stay inside their scene and point at real targets', () => {
    const p = withAll('portrait');
    const tl = template.getTimeline(p);
    const ids = new Set(template.getEditableTargets(p).map((t) => t.id));
    expect(tl.scenes.map((s) => s.typeId)).toEqual(PREMIUM_SCENE_TYPES.map((t) => t.id));
    for (const layer of tl.layers) {
      expect(ids.has(layer.targetId), layer.id).toBe(true);
      const scene = tl.scenes.find((s) => s.id === layer.sceneId);
      if (!scene) continue;
      for (const c of layer.clips) {
        expect(c.from).toBeGreaterThanOrEqual(scene.from);
        expect(c.from + c.durationInFrames).toBeLessThanOrEqual(scene.from + scene.durationInFrames);
      }
    }
  });

  it('6 + 7: duplicated premium scenes keep independent texts, lists and backgrounds', () => {
    let p = withAll();
    p = duplicateScene(p, 'glass-panels-1', 'glass-panels-2').project;
    const i = p.scenes.findIndex((s) => s.id === 'glass-panels-2');
    p = setAtPath(p, ['scenes', i, 'props', 'panels', 0, 'value'], '99%');
    p = setAtPath(p, ['scenes', i, 'texts', 'title', 'content'], 'Second');
    p = setAtPath(p, ['scenes', i, 'background', 'mode'], 'inherit');
    expect(template.schema.safeParse(p).success).toBe(true);
    const original = p.scenes.find((s) => s.id === 'glass-panels-1') as unknown as { props: { panels: { value: string }[] }; texts: { title: { content: string } }; background: { mode: string } };
    expect(original.props.panels[0]!.value).toBe('128K');
    expect(original.texts.title.content).toBe('Everything\nin one view');
    expect(original.background.mode).toBe('procedural');
  });

  it('8: scene-specific properties are validated with safe limits', () => {
    const p = withAll();
    const idx = (id: string) => p.scenes.findIndex((s) => s.id === id);
    const ok = (path: (string | number)[], v: unknown) => template.schema.safeParse(setAtPath(p, path, v)).success;
    expect(ok(['scenes', idx('number-impact-1'), 'props', 'decimals'], 3)).toBe(true);
    expect(ok(['scenes', idx('number-impact-1'), 'props', 'decimals'], 4)).toBe(false);
    expect(ok(['scenes', idx('number-impact-1'), 'props', 'suffix'], 'toolong')).toBe(false);
    expect(ok(['scenes', idx('kinetic-type-1'), 'props', 'direction'], 'diagonal')).toBe(false);
    expect(ok(['scenes', idx('editorial-split-1'), 'props', 'ratio'], 0.8)).toBe(false);
    expect(ok(['scenes', idx('grid-breakdown-1'), 'props', 'density'], 12.5)).toBe(false);
    expect(ok(['scenes', idx('orbital-data-1'), 'props', 'nodes'], [{ label: 'a', value: '1' }])).toBe(false);
    expect(ok(['scenes', idx('product-reveal-1'), 'props', 'productScale'], 2)).toBe(false);
    expect(ok(['scenes', idx('cinematic-outro-1'), 'props', 'logoAssetId'], 'a-missing')).toBe(true); // reference checked against project assets on load
  });

  it('kinetic type kicker marker is editable and older documents get the accent default', () => {
    const p = withAll();
    const i = p.scenes.findIndex((s) => s.type === 'kinetic-type');
    const ids = template.getEditableTargets(p).map((t) => t.id);
    expect(ids).toContain(`${p.scenes[i]!.id}.marker`);
    const legacy = structuredClone(p) as unknown as { scenes: { elements: Record<string, unknown> }[] };
    delete legacy.scenes[i]!.elements.marker;
    const parsed = template.schema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    expect(getAtPath(parsed.data, ['scenes', i, 'elements', 'marker', 'color'])).toBe('$accent');
    expect(template.schema.safeParse(setAtPath(p, ['scenes', i, 'elements', 'marker', 'color'], '#00FF88')).success).toBe(true);
  });

  it('formats counter values deterministically', () => {
    expect(formatNumber(1250000, { decimals: 0, separator: 'comma' })).toBe('1,250,000');
    expect(formatNumber(1234.5, { decimals: 2, separator: 'dot' })).toBe('1.234,50');
    expect(formatNumber(1234.5, { decimals: 1, separator: 'space' })).toBe('1 234.5');
    expect(formatNumber(-42, { decimals: 0, separator: 'none' })).toBe('−42');
  });

  it('keeps the original palette available as an opt-in override', () => {
    for (const t of PREMIUM_SCENE_TYPES) {
      expect(Object.keys(t.palette ?? {}).sort()).toEqual(['accent', 'background', 'foreground', 'secondary', 'surface']);
      const scene = template.createScene(t.id, { id: 'x', name: 'x' });
      expect(Object.values(scene.palette).every((v) => v === null)).toBe(true);
    }
  });

  it('3 + 4: mixes Signature and premium families in one ordered sequence', () => {
    let p = blank('portrait');
    p = insertScene(p, template.createScene('impact', { id: 'impact-1', name: 'Impact' }));
    p = insertScene(p, template.createScene('number-impact', { id: 'number-1', name: 'Number' }));
    p = insertScene(p, template.createScene('signature', { id: 'signature-1', name: 'Signature' }));
    p = insertScene(p, template.createScene('cinematic-outro', { id: 'outro-1', name: 'Outro' }), 0);
    expect(template.schema.safeParse(p).success).toBe(true);
    expect(computeSceneRanges(p.scenes, p.fps).map((r) => [r.id, r.from])).toEqual([
      ['outro-1', 0],
      ['impact-1', 150],
      ['number-1', 240],
      ['signature-1', 360],
    ]);
  });
});
