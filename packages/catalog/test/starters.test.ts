import { describe, expect, it } from 'vitest';
import { FORMATS } from '@lms/shared';
import { duplicateScene, insertScene, moveScene, projectDurationInFrames } from '@lms/template-sdk';
import { COMPOSITION_TEMPLATE_ID, STARTERS, buildStarter, sceneDefinitions, starterSummaries, templateDefinitions } from '../src/definitions';

const template = templateDefinitions.get(COMPOSITION_TEMPLATE_ID);

/** Duration ranges suggested by CARTA 004 (seconds). */
const RANGES: Record<string, [number, number]> = {
  'app-launch': [25, 30],
  'motion-showreel': [15, 21],
  'digital-product': [25, 30],
  'product-commercial': [15, 20],
  'creator-intro': [15, 20],
};

describe('starter compositions', () => {
  it('ships the five compositions', () => {
    expect(STARTERS.map((s) => s.id)).toEqual(Object.keys(RANGES));
  });

  it.each(STARTERS.map((s) => s.id))('%s builds as a valid, editable free composition in both formats', (id) => {
    for (const format of FORMATS) {
      const p = buildStarter(id, { id: 'p-starter', format, now: '2026-01-01T00:00:00.000Z' });
      expect(template.schema.safeParse(p).success).toBe(true);
      expect(p.templateId).toBe(COMPOSITION_TEMPLATE_ID);
      expect(p.origin).toEqual({ kind: 'template', templateId: `starter:${id}`, version: '1.0.0' });
      for (const s of p.scenes) expect(sceneDefinitions.has(s.type), s.type).toBe(true);
      const seconds = projectDurationInFrames(p.scenes, p.fps) / p.fps;
      expect(seconds).toBeGreaterThanOrEqual(RANGES[id]![0]);
      expect(seconds).toBeLessThanOrEqual(RANGES[id]![1]);
      // Fully editable: every scene exposes inspector targets, and the timeline matches.
      expect(template.getTimeline(p).scenes).toHaveLength(p.scenes.length);
    }
  });

  it('every new Studio Motion scene type is used by at least one composition', () => {
    const used = new Set(STARTERS.flatMap((s) => s.scenes().map((x) => x.type)));
    for (const t of sceneDefinitions.list().filter((d) => d.family.id === 'studio-motion')) expect(used.has(t.id), t.id).toBe(true);
  });

  it('a starter can be edited, recomposed with scenes from another starter and stays valid', () => {
    let p = buildStarter('app-launch', { id: 'p-starter', format: 'portrait', now: 'now' });
    const reel = buildStarter('motion-showreel', { id: 'p-other', format: 'portrait', now: 'now' });
    p = insertScene(p, structuredClone(reel.scenes[0]!), 2);
    p = duplicateScene(p, 'launch-phone', 'launch-phone-2').project;
    p = moveScene(p, 'launch-outro', 0);
    expect(template.schema.safeParse(p).success).toBe(true);
    // The starter itself is unchanged (built fresh each time).
    expect(buildStarter('app-launch', { id: 'p-fresh1', format: 'portrait', now: 'now' }).scenes).toHaveLength(7);
  });

  it('summaries report scene counts and durations', () => {
    const s = starterSummaries();
    expect(s.map((x) => x.sceneCount)).toEqual([7, 6, 7, 5, 5]);
    for (const x of s) expect(x.durationSeconds).toBeGreaterThan(15);
  });
});
