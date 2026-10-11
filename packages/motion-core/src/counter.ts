import { ease, type EasingFn } from './easing';
import { progress } from './tween';

/** Deterministic count-up: the value at scene time `t`. */
export const countValue = (t: number, start: number, duration: number, from: number, to: number, easing: EasingFn = ease.outQuart): number =>
  from + (to - from) * easing(progress(t, start, duration));

export type ThousandsSeparator = 'comma' | 'dot' | 'space' | 'none';

/** Formats a number with fixed decimals and a thousands separator (the decimal mark is the other of comma/dot). */
export const formatNumber = (value: number, opts: { decimals: number; separator: ThousandsSeparator }): string => {
  const fixed = Math.abs(value).toFixed(opts.decimals);
  const [int, dec] = fixed.split('.');
  const sep = opts.separator === 'comma' ? ',' : opts.separator === 'dot' ? '.' : opts.separator === 'space' ? ' ' : '';
  const mark = opts.separator === 'dot' ? ',' : '.';
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return `${value < 0 ? '−' : ''}${grouped}${dec ? mark + dec : ''}`;
};
