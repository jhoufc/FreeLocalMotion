/**
 * Minimal immutable path access used by the generic inspector. Paths are arrays of
 * object keys / array indexes, e.g. `['scenes', 0, 'texts', 'headline', 'content']`.
 */
export type FieldPath = readonly (string | number)[];

export const pathKey = (path: FieldPath): string => path.join('.');

export const getAtPath = (root: unknown, path: FieldPath): unknown => {
  let cur: unknown = root;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
};

/** Returns a structurally-shared copy of `root` with `value` written at `path`. */
export const setAtPath = <T>(root: T, path: FieldPath, value: unknown): T => {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path as [string | number, ...(string | number)[]];
  const container = root as unknown;
  if (Array.isArray(container)) {
    const idx = Number(head);
    if (!Number.isInteger(idx) || idx < 0 || idx >= container.length) {
      throw new Error(`Invalid array index "${String(head)}" in path ${pathKey(path)}`);
    }
    const copy = container.slice();
    copy[idx] = setAtPath(container[idx], rest, value);
    return copy as T;
  }
  if (container && typeof container === 'object') {
    const obj = container as Record<string, unknown>;
    const key = String(head);
    if (rest.length > 0 && !(key in obj)) {
      throw new Error(`Unknown key "${key}" in path ${pathKey(path)}`);
    }
    return { ...obj, [key]: setAtPath(obj[key], rest, value) } as T;
  }
  throw new Error(`Cannot write path ${pathKey(path)} through a primitive value`);
};
