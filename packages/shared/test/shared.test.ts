import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  MigrationError,
  colorRefSchema,
  contrastRatio,
  findMissingAssets,
  getAtPath,
  migrateEnvelope,
  mixHex,
  resolveColor,
  secondsToFrames,
  setAtPath,
  slugify,
  textElementSchema,
} from '../src';

const theme = { background: '#080A10', foreground: '#F5F7FF', accent: '#B8FF35', secondary: '#6574FF', surface: '#151925' };

describe('colors', () => {
  it('accepts hex colors and theme tokens only', () => {
    expect(colorRefSchema.safeParse('#B8FF35').success).toBe(true);
    expect(colorRefSchema.safeParse('#B8FF35CC').success).toBe(true);
    expect(colorRefSchema.safeParse('$accent').success).toBe(true);
    expect(colorRefSchema.safeParse('$nope').success).toBe(false);
    expect(colorRefSchema.safeParse('red').success).toBe(false);
    expect(colorRefSchema.safeParse('#FFF').success).toBe(false);
  });

  it('resolves tokens against a palette', () => {
    expect(resolveColor('$accent', theme)).toBe('#B8FF35');
    expect(resolveColor('#123456', theme)).toBe('#123456');
  });

  it('mixes and measures contrast', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5).toLowerCase()).toBe('#808080');
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThan(15);
  });
});

describe('path helpers', () => {
  const doc = { a: { b: [{ c: 1 }, { c: 2 }] }, x: 'y' };

  it('reads nested values', () => {
    expect(getAtPath(doc, ['a', 'b', 1, 'c'])).toBe(2);
    expect(getAtPath(doc, ['a', 'missing', 'c'])).toBeUndefined();
  });

  it('writes immutably with structural sharing', () => {
    const next = setAtPath(doc, ['a', 'b', 0, 'c'], 42);
    expect(getAtPath(next, ['a', 'b', 0, 'c'])).toBe(42);
    expect(doc.a.b[0]!.c).toBe(1);
    expect(next.a.b[1]).toBe(doc.a.b[1]);
    expect(next.x).toBe('y');
  });

  it('refuses to invent structure', () => {
    expect(() => setAtPath(doc, ['a', 'nope', 'c'], 1)).toThrow();
    expect(() => setAtPath(doc, ['a', 'b', 5, 'c'], 1)).toThrow();
  });
});

describe('text element schema', () => {
  const valid = {
    visible: true,
    content: 'Hello',
    color: '$foreground',
    weight: 900,
    italic: false,
    uppercase: true,
    stretch: 'expanded',
    sizeScale: 1,
    tracking: 0,
    breaks: { portrait: 'words', landscape: 'single' },
    delay: 0,
  };
  it('validates bounds', () => {
    expect(textElementSchema.safeParse(valid).success).toBe(true);
    expect(textElementSchema.safeParse({ ...valid, sizeScale: 3 }).success).toBe(false);
    expect(textElementSchema.safeParse({ ...valid, weight: 1000 }).success).toBe(false);
    expect(textElementSchema.safeParse({ ...valid, breaks: { portrait: 'zigzag', landscape: 'single' } }).success).toBe(false);
    expect(textElementSchema.safeParse({ ...valid, content: 'x'.repeat(241) }).success).toBe(false);
  });
});

describe('migrations', () => {
  it('passes current documents through', () => {
    expect(migrateEnvelope({ schemaVersion: CURRENT_SCHEMA_VERSION, a: 1 })).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, a: 1 });
  });
  it('v1 -> v2 turns fixed scenes into enabled instances without touching their data', () => {
    const v1 = {
      schemaVersion: 1,
      name: 'Old',
      scenes: [
        { id: 'impact', name: 'Abertura', duration: 4.2, texts: { lineA: { content: 'O FUTURO' } } },
        { id: 'energy', name: 'Energy', duration: 3 },
      ],
    };
    const v2 = migrateEnvelope(structuredClone(v1));
    expect(v2.schemaVersion).toBe(3);
    expect(v2.scenes).toEqual([
      { id: 'impact', type: 'impact', enabled: true, name: 'Abertura', duration: 4.2, texts: { lineA: { content: 'O FUTURO' } } },
      { id: 'energy', type: 'energy', enabled: true, name: 'Energy', duration: 3 },
    ]);
    expect(v2.name).toBe('Old');
  });
  it('v2 -> v3 records the native template as origin', () => {
    const v3 = migrateEnvelope({ schemaVersion: 2, templateId: 'signature-001', templateVersion: '1.1.0', scenes: [] });
    expect(v3).toMatchObject({ schemaVersion: 3, origin: { kind: 'template', templateId: 'signature-001', version: '1.1.0' } });
  });
  it('rejects documents from the future and non-objects', () => {
    expect(() => migrateEnvelope({ schemaVersion: 999 })).toThrow(MigrationError);
    expect(() => migrateEnvelope([])).toThrow(MigrationError);
    expect(() => migrateEnvelope({})).toThrow(/No migration/);
  });
});

describe('misc', () => {
  it('finds dangling asset references', () => {
    const project = {
      assets: [{ id: 'a-111111', kind: 'image', fileName: 'a.png', originalName: 'a.png', mimeType: 'image/png', size: 1, createdAt: '' }] as const,
      scenes: [{ background: { image: { assetId: 'a-111111' } } }, { background: { image: { assetId: 'a-222222' } } }],
    };
    expect(findMissingAssets(project as never)).toEqual(['a-222222']);
  });
  it('converts seconds to frames and slugifies', () => {
    expect(secondsToFrames(3, 30)).toBe(90);
    expect(secondsToFrames(3, 60)).toBe(180);
    expect(slugify('Ação Ñandú — Teste!')).toBe('acao-nandu-teste');
  });
});
