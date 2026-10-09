import { useMemo } from 'react';
import { createRng, randomAt } from '../random';

const tileCache = new Map<string, string>();

/** Generates (once per seed) a seeded monochrome noise tile as a data URL. */
const noiseTile = (seed: string, size: number): string | null => {
  const key = `${seed}:${size}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const rng = createRng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rng() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  tileCache.set(key, url);
  return url;
};

/**
 * Film grain. The tile is generated from a seed and its offset changes at a fixed 24
 * "grain fps" from the timeline time, so any frame is reproducible and 30/60 fps match.
 */
export const Grain = ({ t, opacity = 0.06, seed = 'grain', scale = 1 }: { t: number; opacity?: number; seed?: string; scale?: number }) => {
  const url = useMemo(() => noiseTile(seed, 256), [seed]);
  if (!url || opacity <= 0) return null;
  const step = Math.floor(t * 24);
  const ox = Math.floor(randomAt(seed, step * 2) * 256);
  const oy = Math.floor(randomAt(seed, step * 2 + 1) * 256);
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${url})`,
        backgroundSize: `${256 * scale}px ${256 * scale}px`,
        backgroundPosition: `${ox}px ${oy}px`,
        mixBlendMode: 'overlay',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
