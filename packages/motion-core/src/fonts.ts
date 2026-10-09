import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';

export interface FontFaceSpec {
  family: string;
  url: string;
  /** e.g. "100 900" for variable weight */
  weight?: string;
  /** e.g. "62% 125%" for variable width */
  stretch?: string;
  style?: 'normal' | 'italic';
  unicodeRange?: string;
}

let fontsEpoch = 0;
const epochListeners = new Set<() => void>();

/** Increments whenever any font set finishes loading. Text measurement caches key on it. */
export const getFontsEpoch = (): number => fontsEpoch;
const bumpEpoch = () => {
  fontsEpoch++;
  for (const l of epochListeners) l();
};

export interface FontSet {
  /** Starts loading (idempotent). In the renderer this holds the frame via delayRender. */
  load(): Promise<void>;
  isReady(): boolean;
  /** Re-renders the caller once fonts are available, so measured layouts update. */
  useReady(): boolean;
}

/**
 * Loads local font files through the FontFace API. The same mechanism runs in the
 * Studio Player and in headless Chrome during rendering, so glyph metrics — and thus
 * auto-fitted text sizes — are identical in preview and MP4.
 */
export const createFontSet = (faces: readonly FontFaceSpec[]): FontSet => {
  let promise: Promise<void> | null = null;
  let ready = false;

  const load = () => {
    if (promise) return promise;
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
      promise = Promise.resolve();
      return promise;
    }
    const handle = delayRender('Loading template fonts', { timeoutInMilliseconds: 60_000 });
    promise = Promise.all(
      faces.map(async (f) => {
        const face = new FontFace(f.family, `url(${f.url}) format('woff2')`, {
          weight: f.weight ?? 'normal',
          stretch: f.stretch ?? 'normal',
          style: f.style ?? 'normal',
          ...(f.unicodeRange ? { unicodeRange: f.unicodeRange } : {}),
        });
        await face.load();
        document.fonts.add(face);
      }),
    )
      .then(() => document.fonts.ready)
      .then(() => {
        ready = true;
        bumpEpoch();
        continueRender(handle);
      })
      .catch((err: unknown) => {
        cancelRender(err instanceof Error ? err : new Error(String(err)));
      });
    return promise;
  };

  const useReady = () => {
    const [isReady, setReady] = useState(ready);
    if (!promise) void load();
    useEffect(() => {
      if (ready) {
        setReady(true);
        return;
      }
      let alive = true;
      void load().then(() => {
        if (alive) setReady(true);
      });
      return () => {
        alive = false;
      };
    }, []);
    return isReady;
  };

  return { load, isReady: () => ready, useReady };
};

/** Subscribes to the global font epoch (any font set). */
export const useFontsEpoch = (): number => {
  const [epoch, setEpoch] = useState(fontsEpoch);
  useEffect(() => {
    const l = () => setEpoch(fontsEpoch);
    epochListeners.add(l);
    l();
    return () => {
      epochListeners.delete(l);
    };
  }, []);
  return epoch;
};
