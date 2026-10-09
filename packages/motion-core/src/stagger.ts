import { randomAt } from './random';

export type StaggerOrigin = 'start' | 'end' | 'center' | 'edges' | 'random';

/**
 * Delay (seconds) for item `index` of `count`. `each` is the gap between neighbours.
 * Origins mirror what motion designers reach for in AE / GSAP.
 */
export const stagger = (
  index: number,
  count: number,
  opts: { each: number; from?: StaggerOrigin; seed?: string | number },
): number => {
  const { each, from = 'start' } = opts;
  if (count <= 1) return 0;
  const last = count - 1;
  switch (from) {
    case 'start':
      return index * each;
    case 'end':
      return (last - index) * each;
    case 'center':
      return Math.abs(index - last / 2) * each;
    case 'edges':
      return (last / 2 - Math.abs(index - last / 2)) * each;
    case 'random':
      return randomAt(opts.seed ?? 'stagger', index) * last * each;
  }
};
