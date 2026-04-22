import { useEffect, useRef, useState } from 'react';
import type { CommunityAdapter } from './types';
import type { SimN } from './forces';
import { project } from './projection';

export interface ViewTransform { tx: number; ty: number; scale: number }

interface Args<N> {
  override: ViewTransform | undefined;
  zoomToId: string | null | undefined;
  zoomScale: number;
  nodes: SimN<N>[];
  adapter: CommunityAdapter<N>;
  width: number;
  height: number;
  tilt: number;
}

const EASE_MS = 400;
const IDENTITY: ViewTransform = { tx: 0, ty: 0, scale: 1 };

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function targetFor<N>(zoomToId: string | null | undefined, nodes: SimN<N>[], adapter: CommunityAdapter<N>, zoomScale: number, width: number, height: number, tilt: number): ViewTransform | null {
  if (!zoomToId) return IDENTITY;
  const target = nodes.find(n => adapter.getId(n) === zoomToId);
  if (!target) return null;
  const p = project(target, tilt);
  return { tx: width / 2 - p.x * zoomScale, ty: height / 2 - p.y * zoomScale, scale: zoomScale };
}

/** Drive the view transform per requestAnimationFrame instead of via a CSS
 *  transition. Each frame updates the computed style, so the browser's
 *  hit-test is always synced to the visible position — users can click
 *  a node even while a previous zoom is still easing toward another one. */
export function useViewTransform<N>({ override, zoomToId, zoomScale, nodes, adapter, width, height, tilt }: Args<N>): { t: ViewTransform | null } {
  const [, bump] = useState(0);
  const startRef = useRef<ViewTransform>(IDENTITY);
  const endRef = useRef<ViewTransform | null>(IDENTITY);
  const startTimeRef = useRef<number>(0);
  const currentRef = useRef<ViewTransform>(IDENTITY);
  const lastZoomIdRef = useRef<string | null | undefined>(null);

  // Keep these fresh each render so the rAF loop sees the latest, without
  // restarting on every adapter / nodes-array identity change.
  const liveRef = useRef({ zoomToId, zoomScale, nodes, adapter, width, height, tilt });
  liveRef.current = { zoomToId, zoomScale, nodes, adapter, width, height, tilt };

  // Retarget on zoom change — runs in render to be ready before the next frame.
  if (lastZoomIdRef.current !== zoomToId) {
    lastZoomIdRef.current = zoomToId;
    startRef.current = { ...currentRef.current };
    endRef.current = targetFor(zoomToId, nodes, adapter, zoomScale, width, height, tilt);
    startTimeRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const tick = (now: number) => {
      if (cancelled) return;
      const end = endRef.current;
      if (!end) return;
      const elapsed = now - startTimeRef.current;
      const p = Math.min(1, elapsed / EASE_MS);
      const e = easeOutCubic(p);
      currentRef.current = {
        tx: lerp(startRef.current.tx, end.tx, e),
        ty: lerp(startRef.current.ty, end.ty, e),
        scale: lerp(startRef.current.scale, end.scale, e),
      };
      // After the ease lands, keep the view locked on the live target position.
      if (p >= 1) {
        const l = liveRef.current;
        const live = targetFor(l.zoomToId, l.nodes, l.adapter, l.zoomScale, l.width, l.height, l.tilt);
        if (live) { endRef.current = live; currentRef.current = live; }
      }
      bump(v => (v + 1) % 1e9);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, []);

  if (override) return { t: override };
  return { t: currentRef.current };
}
