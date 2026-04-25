import { useEffect, useRef, useState } from 'react';
import type { CommunityAdapter } from './types';
import type { SimN } from './forces';
import { project, type Camera } from './projection';

export interface ViewTransform { tx: number; ty: number; scale: number }

interface Args<N> {
  override: ViewTransform | undefined;
  zoomToId: string | null | undefined;
  /** When set (and `zoomToId` is null), zoom to the centroid of the
   *  community whose adapter key matches this. */
  zoomToCommunityKey?: string | null;
  zoomScale: number;
  nodes: SimN<N>[];
  adapter: CommunityAdapter<N>;
  width: number;
  height: number;
  camera: Camera;
}

const EASE_MS = 400;
const IDENTITY: ViewTransform = { tx: 0, ty: 0, scale: 1 };

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function targetFor<N>(zoomToId: string | null | undefined, zoomToCommunityKey: string | null | undefined, nodes: SimN<N>[], adapter: CommunityAdapter<N>, zoomScale: number, width: number, height: number, camera: Camera): ViewTransform | null {
  if (zoomToId) {
    const target = nodes.find(n => adapter.getId(n) === zoomToId);
    if (!target) return null;
    const p = project(target, camera);
    return { tx: width / 2 - p.x * zoomScale, ty: height / 2 - p.y * zoomScale, scale: zoomScale };
  }
  if (zoomToCommunityKey) {
    let sx = 0; let sy = 0; let count = 0;
    for (const n of nodes) {
      if (adapter.getCommunityKey(n) !== zoomToCommunityKey) continue;
      const p = project(n, camera);
      sx += p.x; sy += p.y; count++;
    }
    if (count === 0) return null;
    const cx = sx / count; const cy = sy / count;
    // Lighter zoom for communities — they're spread over an area, so going
    // in as deep as a single node would crop most of them off-canvas.
    const scale = Math.max(1, zoomScale * 0.6);
    return { tx: width / 2 - cx * scale, ty: height / 2 - cy * scale, scale };
  }
  return IDENTITY;
}

/** Drive the view transform per requestAnimationFrame instead of via a CSS
 *  transition. Each frame updates the computed style, so the browser's
 *  hit-test is always synced to the visible position — users can click
 *  a node even while a previous zoom is still easing toward another one. */
export function useViewTransform<N>({ override, zoomToId, zoomToCommunityKey, zoomScale, nodes, adapter, width, height, camera }: Args<N>): { t: ViewTransform | null } {
  const [, bump] = useState(0);
  const startRef = useRef<ViewTransform>(IDENTITY);
  const endRef = useRef<ViewTransform | null>(IDENTITY);
  const startTimeRef = useRef<number>(0);
  const currentRef = useRef<ViewTransform>(IDENTITY);
  const lastTargetRef = useRef<string>('');

  // Keep these fresh each render so the rAF loop sees the latest, without
  // restarting on every adapter / nodes-array identity change.
  const liveRef = useRef({ zoomToId, zoomToCommunityKey, zoomScale, nodes, adapter, width, height, camera });
  liveRef.current = { zoomToId, zoomToCommunityKey, zoomScale, nodes, adapter, width, height, camera };

  // Retarget when either the node id or community key changes. A composite
  // key disambiguates the two channels so switching from one to the other
  // restarts the ease.
  const targetKey = `${zoomToId ?? ''}|${zoomToCommunityKey ?? ''}`;
  if (lastTargetRef.current !== targetKey) {
    lastTargetRef.current = targetKey;
    startRef.current = { ...currentRef.current };
    endRef.current = targetFor(zoomToId, zoomToCommunityKey, nodes, adapter, zoomScale, width, height, camera);
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
        const live = targetFor(l.zoomToId, l.zoomToCommunityKey, l.nodes, l.adapter, l.zoomScale, l.width, l.height, l.camera);
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
