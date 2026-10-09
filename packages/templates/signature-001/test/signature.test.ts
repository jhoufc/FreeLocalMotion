import { describe, expect, it } from 'vitest';
import { FORMATS, getAtPath, setAtPath } from '@lms/shared';
import { parseProjectForTemplate } from '@lms/template-sdk';
import { signatureDefinition as def } from '../src/definition';
import { SCENE_DURATION_LIMITS, type SignatureProject } from '../src/schema';
import { CHOREO, TRANSITION_IN } from '../src/timing';

const make = (format: 'portrait' | 'landscape' = 'landscape', fps: 30 | 60 = 30): SignatureProject =>
  def.createDefaults({ id: 'p-test01', name: 'Test', format, fps, now: '2026-01-01T00:00:00.000Z' });

describe('Signature / 001 defaults', () => {
  it.each(FORMATS)('is valid in %s', (format) => {
    const r = parseProjectForTemplate(def, make(format));
    expect(r.ok).toBe(true);
  });

  it('is 15 seconds with the four storyboard scenes in order', () => {
    const p = make();
    expect(p.scenes.map((s) => s.id)).toEqual(['impact', 'energy', 'transformation', 'signature']);
    expect(p.scenes.map((s) => s.duration)).toEqual([3, 3, 4, 5]);
    expect(def.getMetadata(p)).toEqual({ width: 1920, height: 1080, fps: 30, durationInFrames: 450 });
    expect(def.getMetadata(make('portrait'))).toMatchObject({ width: 1080, height: 1920 });
    expect(def.getMetadata(make('landscape', 60)).durationInFrames).toBe(900);
  });

  it('ships the storyboard copy and palette', () => {
    const p = make();
    expect(p.scenes[0].texts.lineA.content).toBe('The Future');
    expect(p.scenes[0].texts.lineB.content).toBe('Is Built');
    expect(`${p.scenes[1].texts.lead.content} ${p.scenes[1].texts.headline.content}`).toBe('Not just Imagined.');
    expect([p.scenes[2].texts.word1.content, p.scenes[2].texts.word2.content, p.scenes[2].texts.word3.content]).toEqual(['Create.', 'Animate.', 'Inspire.']);
    expect(p.scenes[3].texts.headline.content.replace('\n', ' ')).toBe('Motion without limits.');
    expect(p.theme).toEqual({ background: '#080A10', foreground: '#F5F7FF', accent: '#B8FF35', secondary: '#6574FF', surface: '#151925' });
  });
});

describe('schema guards', () => {
  it('enforces scene duration limits', () => {
    const p = make();
    const tooShort = setAtPath(p, ['scenes', 0, 'duration'], SCENE_DURATION_LIMITS.impact.min - 0.1);
    const tooLong = setAtPath(p, ['scenes', 3, 'duration'], SCENE_DURATION_LIMITS.signature.max + 0.1);
    expect(def.schema.safeParse(tooShort).success).toBe(false);
    expect(def.schema.safeParse(tooLong).success).toBe(false);
  });

  it('rejects unknown scene order and bad colors', () => {
    const p = make();
    expect(def.schema.safeParse({ ...p, scenes: [p.scenes[1], p.scenes[0], p.scenes[2], p.scenes[3]] }).success).toBe(false);
    expect(def.schema.safeParse(setAtPath(p, ['theme', 'accent'], 'lime')).success).toBe(false);
  });
});

describe('editable fields', () => {
  it.each(FORMATS)('every field path resolves to an existing value (%s)', (format) => {
    const p = make(format);
    const targets = def.getEditableTargets(p);
    expect(targets.length).toBeGreaterThan(15);
    for (const t of targets) {
      for (const s of t.sections) {
        for (const f of s.fields) {
          expect(getAtPath(p, f.path), `${t.id} -> ${f.path.join('.')}`).not.toBeUndefined();
        }
      }
      if (t.visibilityPath) expect(typeof getAtPath(p, t.visibilityPath)).toBe('boolean');
    }
  });

  it('exposes all main texts for editing', () => {
    const ids = def.getEditableTargets(make()).map((t) => t.id);
    for (const id of ['impact.lineA', 'impact.lineB', 'energy.lead', 'energy.headline', 'transformation.word1', 'transformation.word2', 'transformation.word3', 'signature.headline', 'signature.subtitle']) {
      expect(ids).toContain(id);
    }
  });

  it('numeric field bounds agree with the schema', () => {
    const p = make();
    for (const t of def.getEditableTargets(p)) {
      for (const s of t.sections) {
        for (const f of s.fields) {
          if (f.type !== 'number') continue;
          expect(def.schema.safeParse(setAtPath(p, f.path, f.min)).success, `${f.path.join('.')} min`).toBe(true);
          expect(def.schema.safeParse(setAtPath(p, f.path, f.max)).success, `${f.path.join('.')} max`).toBe(true);
        }
      }
    }
  });
});

describe('timeline', () => {
  it('scenes are contiguous and cover the composition', () => {
    const p = make();
    const tl = def.getTimeline(p);
    expect(tl.durationInFrames).toBe(450);
    let cursor = 0;
    for (const s of tl.scenes) {
      expect(s.from).toBe(cursor);
      cursor += s.durationInFrames;
    }
    expect(cursor).toBe(450);
  });

  it('layers stay inside their scene and point at real targets', () => {
    const p = make('portrait');
    const tl = def.getTimeline(p);
    const targetIds = new Set(def.getEditableTargets(p).map((t) => t.id));
    for (const layer of tl.layers) {
      expect(targetIds.has(layer.targetId), layer.id).toBe(true);
      const scene = tl.scenes.find((s) => s.id === layer.sceneId);
      for (const c of layer.clips) {
        const lo = scene ? scene.from : 0;
        const hi = scene ? scene.from + scene.durationInFrames : tl.durationInFrames;
        expect(c.from).toBeGreaterThanOrEqual(lo);
        expect(c.from + c.durationInFrames).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('reflects edits: text delay moves its clip, duration changes move later scenes', () => {
    const p = make();
    const before = def.getTimeline(p);
    const delayed = setAtPath(p, ['scenes', 0, 'texts', 'lineA', 'delay'], 0.5);
    const after = def.getTimeline(delayed);
    const clip = (tl: typeof before) => tl.layers.find((l) => l.id === 'impact.lineA')!.clips[0]!.from;
    expect(clip(after) - clip(before)).toBe(15);
    const longer = def.getTimeline(setAtPath(p, ['scenes', 0, 'duration'], 4));
    expect(longer.scenes[1]!.from).toBe(120);
    expect(longer.durationInFrames).toBe(480);
  });

  it('choreography entrances happen before each scene exit', () => {
    for (const key of ['lineA', 'lineB', 'kicker'] as const) expect(CHOREO.impact[key].in).toBeLessThan(3 - CHOREO.impact.exit);
    for (const key of ['lead', 'headline'] as const) expect(CHOREO.energy[key].in).toBeLessThan(3 - CHOREO.energy.exit);
    expect(CHOREO.signature.subtitle.in).toBeLessThan(5 - CHOREO.signature.outro);
    expect(TRANSITION_IN.impact).toBe(0);
  });
});
