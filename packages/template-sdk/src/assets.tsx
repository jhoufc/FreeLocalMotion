import { createContext, useContext, type ReactNode } from 'react';
import type { AssetRef, MotionProject } from '@lms/shared';

/**
 * Resolves project asset ids to URLs. The Studio resolves to `/api/...` (proxied by
 * Vite), the renderer to `http://127.0.0.1:<port>/api/...`. Same component code, same
 * files on disk — only the base URL differs.
 */
export interface AssetResolver {
  url(assetId: string | null | undefined): string | null;
  get(assetId: string | null | undefined): AssetRef | null;
}

const nullResolver: AssetResolver = { url: () => null, get: () => null };
const AssetContext = createContext<AssetResolver>(nullResolver);

export const createAssetResolver = (project: Pick<MotionProject, 'id' | 'assets'>, baseUrl: string): AssetResolver => {
  const byId = new Map(project.assets.map((a) => [a.id, a]));
  const base = baseUrl.replace(/\/+$/, '');
  return {
    get: (assetId) => (assetId ? (byId.get(assetId) ?? null) : null),
    url: (assetId) => {
      const asset = assetId ? byId.get(assetId) : undefined;
      if (!asset) return null;
      return `${base}/api/projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(asset.fileName)}`;
    },
  };
};

export const AssetProvider = ({ resolver, children }: { resolver: AssetResolver; children: ReactNode }) => (
  <AssetContext.Provider value={resolver}>{children}</AssetContext.Provider>
);

export const useAssets = (): AssetResolver => useContext(AssetContext);
