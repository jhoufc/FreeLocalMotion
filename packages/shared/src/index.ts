export * from './formats';
export * from './layout';
export * from './path';
export * from './api';
export * from './migrations';
export * from './schema/color';
export * from './schema/elements';
export * from './schema/project';

/** Short, URL- and filename-safe random id (not used inside compositions, so non-determinism is fine). */
export const createId = (prefix = ''): string => {
  const rand = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
  return `${prefix}${rand}`.toLowerCase();
};

export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'project';
