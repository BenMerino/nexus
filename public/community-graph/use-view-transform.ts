import { useEffect, useRef, useState } from 'react';
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

const EASE_MS = 400;
const IDENTITY: ViewTransform = { tx: 0, ty: 0, scale: 1 };

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function targetFor<N>(zoomToId: string | null | undefined, nodes: SimN<N>[], adapter: CommunityAdapter<N>, zoomScale: number, width: number, height: number): ViewTransform | null {
  if (!zoomToId) return IDENTITY;
  const target = nodes.find(n => adapter.getId(n) === zoomToId);
  if (!target) return null;
  return { tx: width / 2 - target.x * zoomScale, ty: height / 2 - target.y * zoomScale, scale: zoomScale };
}

/** Drive the view transform per requestAnimationFrame instead of via a CSS
 *  transition. Each frame updates the computed style, so the browser's
 *  hit-test is always synced to the visible position — users can click
 *  a node even while a previous zoom is still easing toward another one. */
export function useViewTransform<N>({ override, zoomToId, zoomScale, nodes, adapter, width, height }: Args<N>): { t: ViewTransform | null } {
  const [, bump] = useState(0);
  const startRef = useRef<ViewTransform>(IDENTITY);
  const endRef = useRef<ViewTransform | null>(IDENTITY);
  const startTimeRef = useRef<number>(0);
  const currentRef = useRef<ViewTransform>(IDENTITY);
  const lastZoomIdRef = useRef<string | null | undefined>(null);
  const rafRef = useRef<number | null>(null);

  if (lastZoomIdRef.current !== zoomToId) {
    lastZoomIdRef.current = zoomToId;
    startRef.current = { ...currentRef.current };
    endRef.current = targetFor(zoomToId, nodes, adapter, zoomScale, width, height);
    startTimeRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }

  useEffect(() => {
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const end = endRef.current;
      if (!end) { rafRef.current = null; return; }
      const elapsed = now - startTimeRef.current;
      const p = Math.min(1, elapsed / EASE_MS);
      const e = easeOutCubic(p);
      currentRef.current = {
        tx: lerp(startRef.current.tx, end.tx, e),
        ty: lerp(startRef.current.ty, end.ty, e),
        scale: lerp(startRef.current.scale, end.scale, e),
      };
      // While zoomed, keep tracking the live target position after the ease lands.
      if (p >= 1 && zoomToId) {
        const live = targetFor(zoomToId, nodes, adapter, zoomScale, width, height);
        if (live) { endRef.current = live; currentRef.current = live; }
      }
      bump(v => (v + 1) % 1e9);
      if (p < 1 || zoomToId) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [zoomToId, zoomScale, width, height, nodes, adapter]);

  if (override) return { t: override };
  return { t: currentRef.current };
}
