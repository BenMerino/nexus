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
  /** When zooming to a node id, expand the target to include this set of
   *  related ids — so 1-hop neighbors don't fall off-canvas at the zoomed
   *  scale. Ignored when zooming to a community. */
  zoomToIdRelated?: Set<string> | null;
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

/** Fit the bounding box of `points` (in projected canvas space) into the
 *  viewport with `pad` margin. Cap zoom-in at `maxScale` so a tiny set
 *  doesn't blow up. */
function fitBbox(points: { x: number; y: number }[], width: number, height: number, maxScale: number, pad = 80): ViewTransform | null {
  if (points.length === 0) return null;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const fit = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh);
  const scale = Math.min(maxScale, Math.max(0.4, fit));
  return { tx: width / 2 - cx * scale, ty: height / 2 - cy * scale, scale };
}

function targetFor<N>(zoomToId: string | null | undefined, zoomToCommunityKey: string | null | undefined, zoomToIdRelated: Set<string> | null | undefined, nodes: SimN<N>[], adapter: CommunityAdapter<N>, zoomScale: number, width: number, height: number, camera: Camera): ViewTransform | null {
  if (zoomToId) {
    const target = nodes.find(n => adapter.getId(n) === zoomToId);
    if (!target) return null;
    if (zoomToIdRelated && zoomToIdRelated.size > 1) {
      const points: { x: number; y: number }[] = [];
      for (const n of nodes) if (zoomToIdRelated.has(adapter.getId(n))) points.push(project(n, camera));
      const fit = fitBbox(points, width, height, zoomScale);
      if (fit) return fit;
    }
    const p = project(target, camera);
    return { tx: width / 2 - p.x * zoomScale, ty: height / 2 - p.y * zoomScale, scale: zoomScale };
  }
  if (zoomToCommunityKey) {
    const points: { x: number; y: number }[] = [];
    for (const n of nodes) {
      if (adapter.getCommunityKey(n) !== zoomToCommunityKey) continue;
      points.push(project(n, camera));
    }
    return fitBbox(points, width, height, zoomScale);
  }
  return IDENTITY;
}

/** Drive the view transform per requestAnimationFrame instead of via a CSS
 *  transition. Each frame updates the computed style, so the browser's
 *  hit-test is always synced to the visible position — users can click
 *  a node even while a previous zoom is still easing toward another one. */
export function useViewTransform<N>({ override, zoomToId, zoomToCommunityKey, zoomToIdRelated, zoomScale, nodes, adapter, width, height, camera }: Args<N>): { t: ViewTransform | null } {
  const [, bump] = useState(0);
  const startRef = useRef<ViewTransform>(IDENTITY);
  const endRef = useRef<ViewTransform | null>(IDENTITY);
  const startTimeRef = useRef<number>(0);
  const currentRef = useRef<ViewTransform>(IDENTITY);
  const lastTargetRef = useRef<string>('');

  // Keep these fresh each render so the rAF loop sees the latest, without
  // restarting on every adapter / nodes-array identity change.
  const liveRef = useRef({ zoomToId, zoomToCommunityKey, zoomToIdRelated, zoomScale, nodes, adapter, width, height, camera });
  liveRef.current = { zoomToId, zoomToCommunityKey, zoomToIdRelated, zoomScale, nodes, adapter, width, height, camera };

  // Retarget when either the node id or community key changes. A composite
  // key disambiguates the two channels so switching from one to the other
  // restarts the ease.
  const targetKey = `${zoomToId ?? ''}|${zoomToCommunityKey ?? ''}`;
  if (lastTargetRef.current !== targetKey) {
    lastTargetRef.current = targetKey;
    startRef.current = { ...currentRef.current };
    endRef.current = targetFor(zoomToId, zoomToCommunityKey, zoomToIdRelated, nodes, adapter, zoomScale, width, height, camera);
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
      // After the ease lands, keep the view locked on the live target.
      // Single-node zooms re-resolve every frame so the camera follows the
      // node as the sim drifts. Bbox-fit zooms (community / node + neighbors)
      // are computed once at retarget and then frozen — re-fitting per frame
      // means iterating every node, which adds up on big graphs.
      if (p >= 1) {
        const l = liveRef.current;
        const isBboxFit = !!l.zoomToCommunityKey || (!!l.zoomToId && !!l.zoomToIdRelated && l.zoomToIdRelated.size > 1);
        if (!isBboxFit) {
          const live = targetFor(l.zoomToId, l.zoomToCommunityKey, l.zoomToIdRelated, l.nodes, l.adapter, l.zoomScale, l.width, l.height, l.camera);
          if (live) { endRef.current = live; currentRef.current = live; }
        }
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
