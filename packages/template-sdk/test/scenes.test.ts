import { describe, expect, it } from 'vitest';
import type { MotionProject } from '@lms/shared';
import {
  SceneOperationError,
  computeSceneRanges,
  duplicateScene,
  findScene,
  insertScene,
  moveScene,
  nextSceneName,
  projectDurationInFrames,
  removeScene,
  renameScene,
  sceneAtFrame,
  setSceneDuration,
  setSceneEnabled,
  toLocalFrame,
} from '../src';

/** Minimal project: only what the structural operations look at. */
const scene = (id: string, type: string, duration: number, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  name: type[0]!.toUpperCase() + type.slice(1),
  enabled: true,
  duration,
  texts: { headline: { content: id } },
  ...extra,
});
const project = (...scenes: ReturnType<typeof scene>[]) => ({ id: 'p-test01', fps: 30, scenes }) as unknown as MotionProject;
const ids = (p: MotionProject) => p.scenes.map((s) => s.id);
const text = (p: MotionProject, id: string) => (findScene(p.scenes, id) as unknown as { texts: { headline: { content: string } } }).texts.headline.content;

const base = () => project(scene('impact', 'impact', 3), scene('energy', 'energy', 3), scene('transformation', 'transformation', 4), scene('signature', 'signature', 5));
const hold = { duration: { default: 3, min: 2.4, max: 5, strategy: 'hold' as const, note: '' } };

describe('scene timing', () => {
  it('offsets are the running sum of previous durations', () => {
    const r = computeSceneRanges(base().scenes, 30);
    expect(r.map((x) => x.from)).toEqual([0, 90, 180, 300]);
    expect(projectDurationInFrames(base().scenes, 30)).toBe(450);
  });

  it('disabled scenes add no frames and keep their project index', () => {
    const p = setSceneEnabled(base(), 'energy', false);
    const r = computeSceneRanges(p.scenes, 30);
    expect(r.map((x) => [x.id, x.index, x.order, x.from])).toEqual([
      ['impact', 0, 0, 0],
      ['transformation', 2, 1, 90],
      ['signature', 3, 2, 210],
    ]);
    expect(projectDurationInFrames(p.scenes, 30)).toBe(360);
  });

  it('finds the active scene and the local frame', () => {
    const r = computeSceneRanges(base().scenes, 30);
    expect(sceneAtFrame(r, 0)?.id).toBe('impact');
    expect(sceneAtFrame(r, 89)?.id).toBe('impact');
    expect(sceneAtFrame(r, 90)?.id).toBe('energy');
    expect(sceneAtFrame(r, 9999)?.id).toBe('signature');
    expect(toLocalFrame(r, 95)).toMatchObject({ range: { id: 'energy' }, localFrame: 5 });
    expect(toLocalFrame(r, 300)?.localFrame).toBe(0);
  });
});

describe('structural operations', () => {
  it('duplicates right after the original with a deep, independent copy', () => {
    const p0 = base();
    const { project: p1, scene: copy } = duplicateScene(p0, 'impact', 'impact-copy01');
    expect(ids(p1)).toEqual(['impact', 'impact-copy01', 'energy', 'transformation', 'signature']);
    expect(copy).toMatchObject({ type: 'impact', duration: 3, name: 'Impact #2' });
    // Mutating the copy must not leak into the original (no shared references).
    (copy as unknown as { texts: { headline: { content: string } } }).texts.headline.content = '100% LOCAL';
    expect(text(p1, 'impact')).toBe('impact');
    expect(text(p0, 'impact')).toBe('impact');
    expect(projectDurationInFrames(p1.scenes, 30)).toBe(540);
  });

  it('duplicating three times yields unique ids and numbered names', () => {
    let p = base();
    for (let i = 0; i < 3; i++) p = duplicateScene(p, 'impact').project;
    expect(new Set(ids(p)).size).toBe(7);
    expect(p.scenes.filter((s) => s.type === 'impact').map((s) => s.name)).toEqual(['Impact', 'Impact #4', 'Impact #3', 'Impact #2']);
    expect(nextSceneName(p, 'Impact #3')).toBe('Impact #5');
  });

  it('inserts at the end or at an index and refuses duplicate ids', () => {
    const p = insertScene(base(), scene('energy-2', 'energy', 3) as never);
    expect(ids(p).at(-1)).toBe('energy-2');
    expect(ids(insertScene(base(), scene('x', 'energy', 3) as never, 1))[1]).toBe('x');
    expect(() => insertScene(base(), scene('impact', 'impact', 3) as never)).toThrow(SceneOperationError);
  });

  it('moves the last scene to the first position and recomputes offsets', () => {
    const p = moveScene(base(), 'signature', 0);
    expect(ids(p)).toEqual(['signature', 'impact', 'energy', 'transformation']);
    expect(computeSceneRanges(p.scenes, 30).map((r) => r.from)).toEqual([0, 150, 240, 330]);
    expect(projectDurationInFrames(p.scenes, 30)).toBe(450);
    expect(moveScene(base(), 'impact', 0)).toEqual(base());
  });

  it('removes an intermediate scene but never the last one', () => {
    const p = removeScene(base(), 'energy');
    expect(ids(p)).toEqual(['impact', 'transformation', 'signature']);
    expect(computeSceneRanges(p.scenes, 30).map((r) => r.from)).toEqual([0, 90, 210]);
    expect(() => removeScene(project(scene('a', 'impact', 3)), 'a')).toThrow(SceneOperationError);
    expect(() => removeScene(base(), 'nope')).toThrow(SceneOperationError);
  });

  it('renames, clamps durations to the type limits and keeps one scene enabled', () => {
    expect(findScene(renameScene(base(), 'impact', '  Abertura  ').scenes, 'impact')?.name).toBe('Abertura');
    expect(() => renameScene(base(), 'impact', '   ')).toThrow(SceneOperationError);
    expect(findScene(setSceneDuration(base(), 'impact', 9, hold).scenes, 'impact')?.duration).toBe(5);
    expect(findScene(setSceneDuration(base(), 'impact', 3.04, hold).scenes, 'impact')?.duration).toBe(3);
    expect(() => setSceneDuration(base(), 'impact', 4, { duration: { ...hold.duration, min: 3, max: 3, strategy: 'fixed' } })).toThrow(/fixa/);
    const single = project(scene('a', 'impact', 3));
    expect(() => setSceneEnabled(single, 'a', false)).toThrow(SceneOperationError);
  });
});
