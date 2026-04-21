import { useRef } from 'react';
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

const EASE_MS = 500;

/** On zoom change: capture the target's position once, hold it stable for
 *  EASE_MS so the CSS transition has a fixed endpoint to interpolate to.
 *  After the ease, track the live tick position (snap, no transition) so
 *  the centered node stays centered as the sim continues to settle. */
export function useViewTransform<N>({ override, zoomToId, zoomScale, nodes, adapter, width, height }: Args<N>): { t: ViewTransform | null; animate: boolean } {
  const lastZoomIdRef = useRef<string | null | undefined>(null);
  const frozenRef = useRef<ViewTransform | null>(null);
  const easeUntilRef = useRef<number>(0);

  const now = typeof performance !== 'undefined' ? performance.now() : 0;

  if (lastZoomIdRef.current !== zoomToId) {
    lastZoomIdRef.current = zoomToId;
    easeUntilRef.current = now + EASE_MS;
    if (zoomToId) {
      const target = nodes.find(n => adapter.getId(n) === zoomToId);
      frozenRef.current = target ? {
        tx: width / 2 - target.x * zoomScale,
        ty: height / 2 - target.y * zoomScale,
        scale: zoomScale,
      } : null;
    } else {
      frozenRef.current = null;
    }
  }

  if (override) return { t: override, animate: true };
  if (!zoomToId) return { t: null, animate: true };

  const easing = now < easeUntilRef.current;
  if (easing && frozenRef.current) return { t: frozenRef.current, animate: true };

  const target = nodes.find(n => adapter.getId(n) === zoomToId);
  if (!target) return { t: null, animate: false };
  return {
    t: {
      tx: width / 2 - target.x * zoomScale,
      ty: height / 2 - target.y * zoomScale,
      scale: zoomScale,
    },
    animate: false,
  };
}
