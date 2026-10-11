import { describe, expect, it } from 'vitest';
import { FORMATS, getAtPath, setAtPath, type MotionProject } from '@lms/shared';
import { duplicateScene, heroFrameOf, insertScene, moveScene, type ListFieldDescriptor } from '@lms/template-sdk';
import { COMPOSITION_TEMPLATE_ID, sceneDefinitions, templateDefinitions } from '@lms/catalog/definitions';
import { MOTION_SCENE_TYPES } from '../src/definitions';
import { parseSeries } from '../src/scenes/dataBrand';

const template = templateDefinitions.get(COMPOSITION_TEMPLATE_ID);
const blank = (format: 'portrait' | 'landscape' = 'landscape'): MotionProject =>
  template.createDefaults({ id: 'p-motion1', name: 'Motion', format, now: '2026-01-01T00:00:00.000Z' });
const withAll = (format: 'portrait' | 'landscape' = 'landscape') => {
  let p = blank(format);
  for (const t of MOTION_SCENE_TYPES) p = insertScene(p, template.createScene(t.id, { id: `${t.id}-1`, name: t.name }));
  return p;
};
const idx = (p: MotionProject, id: string) => p.scenes.findIndex((s) => s.id === id);
const valid = (p: MotionProject) => template.schema.safeParse(p).success;

describe('Studio Motion pack', () => {
  it('ships 12 scene types registered in the global library', () => {
    expect(MOTION_SCENE_TYPES.map((t) => t.id)).toEqual([
      'bouncing-ball',
      'semantic-words',
      'morph-line',
      'iris-reveal',
      'floating-phone',
      'ui-highlight',
      'app-screens',
      'product-hero',
      'product-callouts',
      'product-impact',
      'infographic',
      'brand-reveal',
    ]);
    for (const t of MOTION_SCENE_TYPES) {
      expect(sceneDefinitions.has(t.id)).toBe(true);
      expect(t.family.id).toBe('studio-motion');
      expect(t.heroTime).toBeLessThan(t.duration.default);
    }
    expect(sceneDefinitions.list().length).toBe(4 + 8 + 12);
  });

  it.each(FORMATS)('every type validates and has fresh defaults (%s)', (format) => {
    const p = withAll(format);
    expect(valid(p)).toBe(true);
    for (const t of MOTION_SCENE_TYPES) {
      const a = t.create({ id: 'a', name: 'a' });
      const b = t.create({ id: 'b', name: 'b' });
      expect((a as unknown as { texts: unknown }).texts).not.toBe((b as unknown as { texts: unknown }).texts);
      expect((a as unknown as { props: unknown }).props).not.toBe((b as unknown as { props: unknown }).props);
    }
  });

  it.each(FORMATS)('every inspector field resolves and stays within schema bounds (%s)', (format) => {
    const p = withAll(format);
    for (const target of template.getEditableTargets(p)) {
      for (const section of target.sections) {
        for (const f of section.fields) {
          expect(getAtPath(p, f.path), `${target.id} -> ${f.path.join('.')}`).not.toBeUndefined();
          if (f.type === 'number') {
            expect(valid(setAtPath(p, f.path, f.min)), `${f.path.join('.')} min`).toBe(true);
            expect(valid(setAtPath(p, f.path, f.max)), `${f.path.join('.')} max`).toBe(true);
          }
          if (f.type === 'list') {
            const list = f as ListFieldDescriptor;
            const items = getAtPath(p, list.path) as unknown[];
            expect(items.length).toBeGreaterThanOrEqual(list.min);
            expect(valid(setAtPath(p, list.path, Array.from({ length: list.max }, () => list.newItem))), `${list.path.join('.')} at max`).toBe(true);
            expect(valid(setAtPath(p, list.path, Array.from({ length: list.max + 1 }, () => list.newItem))), `${list.path.join('.')} above max`).toBe(false);
            for (const item of list.itemFields) {
              if (items[0] !== undefined) expect(getAtPath(items[0], item.path), `${list.path.join('.')}[0].${item.path.join('.')}`).not.toBeUndefined();
              if (item.type === 'number' && items.length) {
                const at0 = [...list.path, 0, ...item.path];
                expect(valid(setAtPath(p, at0, item.min)), `${at0.join('.')} min`).toBe(true);
                expect(valid(setAtPath(p, at0, item.max)), `${at0.join('.')} max`).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('target ids are unique across the whole library (canvas selection is unambiguous)', () => {
    let p = blank();
    for (const t of sceneDefinitions.list()) p = insertScene(p, template.createScene(t.id, { id: `${t.id}-1`, name: t.name }));
    const ids = template.getEditableTargets(p).map((t) => t.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('timeline layers stay inside their scenes and point at real targets', () => {
    const p = withAll('portrait');
    const tl = template.getTimeline(p);
    const ids = new Set(template.getEditableTargets(p).map((t) => t.id));
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

  it('the main object of each scene is replaceable (screens, products, photo, data, words)', () => {
    let p = withAll();
    const set = (id: string, path: (string | number)[], v: unknown) => {
      p = setAtPath(p, ['scenes', idx(p, id), ...path], v);
      expect(valid(p), `${id} ${path.join('.')}`).toBe(true);
    };
    set('floating-phone-1', ['props', 'screenAssetId'], 'a-screenshot');
    set('app-screens-1', ['props', 'screens'], [
      { assetId: 'a-one', variant: 'home', caption: 'One' },
      { assetId: null, variant: 'chat', caption: 'Two' },
      { assetId: 'a-three', variant: 'stats', caption: 'Three' },
      { assetId: null, variant: 'profile', caption: 'Four' },
    ]);
    set('product-hero-1', ['props', 'assetId'], 'a-product');
    set('product-hero-1', ['props', 'angles'], [{ assetId: 'a-side' }, { assetId: 'a-back' }]);
    set('product-callouts-1', ['props', 'benefits', 0, 'label'], 'Titanium');
    set('product-impact-1', ['props', 'words', 1, 'text'], 'Loud');
    set('infographic-1', ['props', 'widgets', 0, 'value'], 12);
    set('brand-reveal-1', ['props', 'photoAssetId'], 'a-photo');
    set('semantic-words-1', ['props', 'words', 0], { text: 'Melt', preset: 'focus' });
    set('ui-highlight-1', ['props', 'assetId'], 'a-ui');
    set('iris-reveal-1', ['props', 'preset'], 'liquid');
  });

  it('rejects unsafe values', () => {
    const p = withAll();
    const bad = (id: string, path: (string | number)[], v: unknown) => expect(valid(setAtPath(p, ['scenes', idx(p, id), ...path], v)), `${id} ${path.join('.')}`).toBe(false);
    bad('app-screens-1', ['props', 'screens'], [{ assetId: null, variant: 'home', caption: 'Only one' }]);
    bad('product-impact-1', ['props', 'words'], [{ text: 'a' }, { text: 'b' }]);
    bad('product-callouts-1', ['props', 'benefits'], Array.from({ length: 6 }, () => ({ label: 'x', detail: '', anchorX: 0, anchorY: 0 })));
    bad('semantic-words-1', ['props', 'words', 0, 'preset'], 'teleport');
    bad('bouncing-ball-1', ['props', 'bounces'], 9);
    bad('morph-line-1', ['props', 'preset'], 'svg-file');
    bad('infographic-1', ['props', 'widgets', 0, 'series'], '1, 2, <script>');
    bad('product-impact-1', ['props', 'colorA'], 'red');
  });

  it('duplicated and moved scenes keep independent data', () => {
    let p = withAll();
    p = duplicateScene(p, 'brand-reveal-1', 'brand-reveal-2').project;
    p = setAtPath(p, ['scenes', idx(p, 'brand-reveal-2'), 'texts', 'name', 'content'], 'Ana Lima');
    p = setAtPath(p, ['scenes', idx(p, 'brand-reveal-2'), 'props', 'highlights', 0, 'value'], 9);
    p = moveScene(p, 'brand-reveal-2', 0);
    expect(valid(p)).toBe(true);
    const orig = p.scenes.find((s) => s.id === 'brand-reveal-1') as unknown as { texts: { name: { content: string } }; props: { highlights: { value: number }[] } };
    expect(orig.texts.name.content).toBe('Marina Costa');
    expect(orig.props.highlights[0]!.value).toBe(120);
    expect(p.scenes[0]!.id).toBe('brand-reveal-2');
  });

  it('semantic words thumbnails land on the first word, never on the gap between words', () => {
    const type = MOTION_SCENE_TYPES.find((t) => t.id === 'semantic-words')!;
    const base = type.create({ id: 'w', name: 'w' }) as unknown as { duration: number; props: { words: unknown[]; timing: number } };
    for (const duration of [3, 3.4, 6, 10]) {
      for (const count of [1, 3, 6]) {
        for (const timing of [0.5, 0.8, 1]) {
          const scene = { ...base, duration, props: { ...base.props, timing, words: base.props.words.concat(base.props.words).slice(0, count) } };
          const slot = (duration - 0.35) / count;
          const hero = heroFrameOf(type, duration, 30, scene) / 30;
          expect(hero, `${duration}s × ${count} words @${timing}`).toBeLessThan(slot * timing);
          expect(hero).toBeGreaterThan(0.1);
        }
      }
    }
  });

  it('plots exactly the series the user typed (no invented data)', () => {
    expect(parseSeries('12, 18, 9, 25')).toEqual([12, 18, 9, 25]);
    expect(parseSeries('')).toEqual([]);
    expect(parseSeries('3,,x,4')).toEqual([3, 4]);
  });
});
