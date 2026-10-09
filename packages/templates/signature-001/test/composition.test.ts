import { describe, expect, it } from 'vitest';
import { setAtPath } from '@lms/shared';
import {
  computeSceneRanges,
  createTemplateRegistry,
  duplicateScene,
  insertScene,
  moveScene,
  parseProjectForTemplate,
  removeScene,
  type AnyTemplateDefinition,
} from '@lms/template-sdk';
import { signatureDefinition as def } from '../src/definition';
import { SCENE_DURATION_LIMITS, type AnyScene, type SignatureProject } from '../src/schema';

/* Dynamic scene composition (CARTA 002): scene types vs. scene instances. */

type ImpactScene = Extract<AnyScene, { type: 'impact' }>;

const make = (format: 'portrait' | 'landscape' = 'landscape'): SignatureProject =>
  def.createDefaults({ id: 'p-test01', name: 'Test', format, now: '2026-01-01T00:00:00.000Z' });

const impactText = (p: SignatureProject, id: string) => (p.scenes.find((s) => s.id === id) as ImpactScene).texts.lineA.content;

const valid = (p: SignatureProject): SignatureProject => {
  const r = def.schema.safeParse(p);
  if (!r.success) throw new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
};

describe('scene catalog', () => {
  it('declares the four reusable scene types with consistent duration specs', () => {
    expect(def.sceneTypes.map((t) => t.id)).toEqual(['impact', 'energy', 'transformation', 'signature']);
    for (const t of def.sceneTypes) {
      expect(t.duration.min).toBeLessThanOrEqual(t.duration.default);
      expect(t.duration.default).toBeLessThanOrEqual(t.duration.max);
      expect(SCENE_DURATION_LIMITS[t.id as keyof typeof SCENE_DURATION_LIMITS]).toEqual({ min: t.duration.min, max: t.duration.max });
      expect(t.heroTime).toBeLessThan(t.duration.default);
    }
  });

  it('creates fresh default instances of every type (no shared objects)', () => {
    for (const t of def.sceneTypes) {
      const a = def.createScene(t.id, { id: `${t.id}-a`, name: t.name });
      const b = def.createScene(t.id, { id: `${t.id}-b`, name: t.name });
      expect(a.type).toBe(t.id);
      expect(a.duration).toBe(t.duration.default);
      expect(a.texts).not.toBe(b.texts);
      expect(a.background).not.toBe(b.background);
      expect(valid({ ...make(), scenes: [a, b] as SignatureProject['scenes'] }).scenes).toHaveLength(2);
    }
    expect(() => def.createScene('nope', { id: 'x', name: 'x' })).toThrow();
  });

  it('registers (every scene type yields valid instances)', () => {
    expect(() => createTemplateRegistry([def as unknown as AnyTemplateDefinition])).not.toThrow();
  });
});

describe('scene instances', () => {
  it('1 + 14: duplicating Impact and editing only the copy leaves the original intact', () => {
    const { project: dup, scene: copy } = duplicateScene(make(), 'impact');
    const i = dup.scenes.findIndex((s) => s.id === copy.id);
    expect(i).toBe(1);
    let p = valid(setAtPath(dup, ['scenes', i, 'texts', 'lineA', 'content'], '100% LOCAL'));
    p = valid(setAtPath(p, ['scenes', i, 'background', 'mode'], 'solid'));
    p = valid(setAtPath(p, ['scenes', i, 'palette', 'accent'], '#FFFFFF'));
    expect(impactText(p, copy.id)).toBe('100% LOCAL');
    expect(impactText(p, 'impact')).toBe('The Future');
    expect(p.scenes[0]!.background.mode).toBe('procedural');
    expect(p.scenes[0]!.palette.accent).toBeNull();
    expect(p.scenes[0]!.texts).not.toBe(p.scenes[1]!.texts);
  });

  it('2: duplicating the same scene three times creates three independent instances', () => {
    let p = make();
    for (let n = 0; n < 3; n++) p = duplicateScene(p, 'impact').project;
    p = valid(p);
    expect(p.scenes.filter((s) => s.type === 'impact')).toHaveLength(4);
    expect(new Set(p.scenes.map((s) => s.id)).size).toBe(7);
    expect(def.getMetadata(p).durationInFrames).toBe(450 + 3 * 90);
  });

  it('every instance gets its own editable targets and timeline layers', () => {
    const { project: p, scene: copy } = duplicateScene(make('portrait'), 'impact');
    const targets = def.getEditableTargets(p);
    const ids = new Set(targets.map((t) => t.id));
    expect(ids.size).toBe(targets.length);
    for (const key of ['lineA', 'lineB', 'kicker', 'lightLine']) {
      expect(ids.has(`impact.${key}`)).toBe(true);
      expect(ids.has(`${copy.id}.${key}`)).toBe(true);
    }
    const copyText = targets.find((t) => t.id === `${copy.id}.lineA`)!;
    expect(copyText.sections[0]!.fields[0]!.path).toEqual(['scenes', 1, 'texts', 'lineA', 'content']);
    const tl = def.getTimeline(p);
    expect(tl.scenes.map((s) => s.id)).toEqual(['impact', copy.id, 'energy', 'transformation', 'signature']);
    expect(tl.scenes[1]).toMatchObject({ from: 90, typeId: 'impact', label: 'Impact #2' });
    expect(tl.layers.filter((l) => l.sceneId === copy.id).length).toBe(tl.layers.filter((l) => l.sceneId === 'impact').length);
  });

  it('3: adding a scene at the end extends the composition', () => {
    const p = valid(insertScene(make(), def.createScene('energy', { id: 'energy-end', name: 'Energy #2' })));
    expect(def.getMetadata(p).durationInFrames).toBe(540);
    expect(def.getTimeline(p).scenes.at(-1)).toMatchObject({ id: 'energy-end', from: 450 });
  });

  it('4 + 6: moving the last scene first recomputes every offset; layers follow', () => {
    const p = valid(moveScene(make(), 'signature', 0));
    const tl = def.getTimeline(p);
    expect(tl.scenes.map((s) => [s.id, s.from])).toEqual([
      ['signature', 0],
      ['impact', 150],
      ['energy', 240],
      ['transformation', 330],
    ]);
    for (const layer of tl.layers) {
      const scene = tl.scenes.find((s) => s.id === layer.sceneId);
      if (!scene) continue;
      for (const c of layer.clips) {
        expect(c.from).toBeGreaterThanOrEqual(scene.from);
        expect(c.from + c.durationInFrames).toBeLessThanOrEqual(scene.from + scene.durationInFrames);
      }
    }
  });

  it('5: removing an intermediate scene closes the gap', () => {
    const p = valid(removeScene(make(), 'energy'));
    expect(def.getTimeline(p).scenes.map((s) => s.from)).toEqual([0, 90, 210]);
    expect(def.getMetadata(p).durationInFrames).toBe(360);
    expect(def.getEditableTargets(p).some((t) => t.sceneId === 'energy')).toBe(false);
  });

  it('7: changing a compatible duration moves later scenes only', () => {
    const p = valid(setAtPath(make(), ['scenes', 1, 'duration'], 4.5));
    expect(def.getTimeline(p).scenes.map((s) => s.from)).toEqual([0, 90, 225, 345]);
  });

  it('disabled scenes are skipped by timeline and metadata but stay editable', () => {
    const p = valid(setAtPath(make(), ['scenes', 1, 'enabled'], false));
    expect(def.getMetadata(p).durationInFrames).toBe(360);
    expect(def.getTimeline(p).scenes.map((s) => [s.id, s.index])).toEqual([
      ['impact', 0],
      ['transformation', 1],
      ['signature', 2],
    ]);
    expect(def.getEditableTargets(p).some((t) => t.id === 'energy.headline')).toBe(true);
  });

  it('the scene inspector exposes the duration strategy of the type', () => {
    const target = def.getEditableTargets(make()).find((t) => t.id === 'transformation')!;
    const duration = target.sections.flatMap((s) => s.fields).find((f) => f.path.at(-1) === 'duration');
    expect(duration).toMatchObject({ type: 'number', min: 3.2, max: 6 });
    expect(duration?.hint).toMatch(/escala/);
  });

  it('15: template defaults keep the original storyboard regardless of project edits', () => {
    const edited = removeScene(duplicateScene(make(), 'impact').project, 'signature');
    expect(edited.scenes).toHaveLength(4);
    expect(make().scenes.map((s) => s.id)).toEqual(['impact', 'energy', 'transformation', 'signature']);
  });
});

describe('migration from 1.0.0 (fixed scenes, schema v1)', () => {
  /** A project as Signature / 001 1.0.0 wrote it: no scene `type` / `enabled`. */
  const v1Project = () => {
    const p = structuredClone(make('portrait')) as unknown as Record<string, unknown> & { scenes: Record<string, unknown>[] };
    p.schemaVersion = 1;
    p.templateVersion = '1.0.0';
    p.scenes = p.scenes.map(({ type: _t, enabled: _e, ...rest }) => rest);
    const impact = p.scenes[0] as { name: string; duration: number; texts: { lineA: { content: string } }; palette: { accent: string | null } };
    impact.name = 'Abertura';
    impact.duration = 4.2;
    impact.texts.lineA.content = 'MOTION GRAPHICS';
    impact.palette.accent = '#00FF88';
    (p.scenes[3] as { background: { mode: string } }).background.mode = 'gradient';
    return p;
  };

  it('9: loads, reports the migration and preserves every value', () => {
    const raw = v1Project();
    const r = parseProjectForTemplate(def, raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migrated).toBe(true);
    const p = r.project;
    expect(p.schemaVersion).toBe(2);
    expect(p.templateVersion).toBe('1.1.0');
    expect(p.scenes.map((s) => [s.id, s.type, s.enabled])).toEqual([
      ['impact', 'impact', true],
      ['energy', 'energy', true],
      ['transformation', 'transformation', true],
      ['signature', 'signature', true],
    ]);
    const impact = p.scenes[0] as ImpactScene;
    expect(impact).toMatchObject({ name: 'Abertura', duration: 4.2 });
    expect(impact.texts.lineA.content).toBe('MOTION GRAPHICS');
    expect(impact.palette.accent).toBe('#00FF88');
    expect(p.scenes[3]!.background.mode).toBe('gradient');
    expect(p.theme).toEqual(raw.theme);
    expect(p.globals).toEqual(raw.globals);
    // Old target ids (`impact.lineA`) keep working.
    expect(def.getEditableTargets(p).some((t) => t.id === 'impact.lineA')).toBe(true);
    // A migrated document is stable.
    const again = parseProjectForTemplate(def, p);
    expect(again.ok && again.migrated).toBe(false);
  });

  it('a migrated project can immediately be recomposed', () => {
    const r = parseProjectForTemplate(def, v1Project());
    if (!r.ok) throw new Error('migration failed');
    const p = valid(moveScene(duplicateScene(r.project, 'impact').project, 'signature', 0));
    expect(computeSceneRanges(p.scenes, p.fps)[0]!.id).toBe('signature');
  });
});
