import { useEffect, useRef } from 'react';
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

/** Transform follows the live tick position so the target stays centered
 *  even as the sim settles. The CSS transition on the <g> node is only
 *  applied during the first ~500ms after a zoom change; after that the
 *  transform snaps per-tick so transitions don't keep restarting toward
 *  moving targets. Returns both the transform and whether to animate. */
export function useViewTransform<N>({ override, zoomToId, zoomScale, nodes, adapter, width, height }: Args<N>): { t: ViewTransform | null; animate: boolean } {
  const lastZoomIdRef = useRef<string | null | undefined>(null);
  const animateUntilRef = useRef<number>(0);

  if (lastZoomIdRef.current !== zoomToId) {
    lastZoomIdRef.current = zoomToId;
    animateUntilRef.current = typeof performance !== 'undefined' ? performance.now() + 500 : 500;
  }

  useEffect(() => { /* bind lifecycle; no-op */ }, [zoomToId]);

  if (override) return { t: override, animate: true };
  if (!zoomToId) return { t: null, animate: true };
  const target = nodes.find(n => adapter.getId(n) === zoomToId);
  if (!target) return { t: null, animate: false };
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  return {
    t: {
      tx: width / 2 - target.x * zoomScale,
      ty: height / 2 - target.y * zoomScale,
      scale: zoomScale,
    },
    animate: now < animateUntilRef.current,
  };
}
