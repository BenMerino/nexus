import { useEffect } from 'react';
import type { CommunityAdapter } from './types';
import type { SimN } from './forces';

export interface ViewTransform { tx: number; ty: number; scale: number }

/** While a node is the zoom target, pin it so the sim stops moving it.
 *  Otherwise the 400ms transform transition chases a drifting node and jitters. */
export function usePinZoomTarget<N>(nodes: SimN<N>[], adapter: CommunityAdapter<N>, zoomToId: string | null | undefined) {
  useEffect(() => {
    if (!zoomToId) return;
    const target = nodes.find(n => adapter.getId(n) === zoomToId);
    if (!target) return;
    target.fx = target.x;
    target.fy = target.y;
    return () => { target.fx = null; target.fy = null; };
  }, [zoomToId, nodes, adapter]);
}

interface Args<N> {
  override: ViewTransform | undefined;
  zoomToId: string | null | undefined;
  zoomScale: number;
  nodes: SimN<N>[];
  adapter: CommunityAdapter<N>;
  width: number;
  height: number;
}

/** Recomputed every render — the sim mutates node x/y in place, so memoizing
 *  by array reference would freeze the transform at click-time position and
 *  the selected node would drift out of center on subsequent ticks. */
export function useViewTransform<N>({ override, zoomToId, zoomScale, nodes, adapter, width, height }: Args<N>): ViewTransform | null {
  if (override) return override;
  if (!zoomToId) return null;
  const target = nodes.find(n => adapter.getId(n) === zoomToId);
  if (!target) return null;
  return {
    tx: width / 2 - target.x * zoomScale,
    ty: height / 2 - target.y * zoomScale,
    scale: zoomScale,
  };
}
