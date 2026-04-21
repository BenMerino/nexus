import { useMemo } from 'react';
import type { CommunityAdapter } from './types';
import type { SimN } from './forces';

export interface ViewTransform { tx: number; ty: number; scale: number }

interface Args<N> {
  override: ViewTransform | undefined;
  zoomToId: string | null | undefined;
  zoomScale: number;
  nodes: SimN<N>[];
  adapter: CommunityAdapter<N>;
  width: number;
  height: number;
}

export function useViewTransform<N>({ override, zoomToId, zoomScale, nodes, adapter, width, height }: Args<N>): ViewTransform | null {
  return useMemo(() => {
    if (override) return override;
    if (!zoomToId) return null;
    const target = nodes.find(n => adapter.getId(n) === zoomToId);
    if (!target) return null;
    return {
      tx: width / 2 - target.x * zoomScale,
      ty: height / 2 - target.y * zoomScale,
      scale: zoomScale,
    };
  }, [override, zoomToId, zoomScale, nodes, adapter, width, height]);
}
