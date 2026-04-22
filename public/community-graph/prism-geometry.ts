import { computeRawRadii, RING_SAMPLES } from '../convex-hull';
import type { Point } from '../convex-hull';
import { project, type Camera } from './projection';

export interface RingState { radii: number[]; cx: number; cy: number }
export interface RingXY { floor: Point[]; ceiling: Point[] }

const MIN_GROUP_SIZE = 1;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Advance the per-key rolling ring state one frame toward the target shape
 *  of `points`. Returns the updated ring or null if the group is empty. */
export function tickRing(state: Map<string, RingState>, key: string, points: Point[], alpha: number): RingState | null {
  if (points.length < MIN_GROUP_SIZE) return null;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const target = computeRawRadii(points, cx, cy);
  const prev = state.get(key);
  const radii = prev ? prev.radii.map((r, i) => lerp(r, target[i], alpha)) : target;
  const scx = prev ? lerp(prev.cx, cx, alpha) : cx;
  const scy = prev ? lerp(prev.cy, cy, alpha) : cy;
  state.set(key, { radii, cx: scx, cy: scy });
  return { radii, cx: scx, cy: scy };
}

/** Sample the ring at z=0 (floor) and z=topZ (ceiling), projected through
 *  the camera — so when pitch=0 floor and ceiling overlap exactly. */
export function projectRing(ring: RingState, pad: number, topZ: number, camera: Camera): RingXY {
  const floor: Point[] = [];
  const ceiling: Point[] = [];
  for (let i = 0; i < RING_SAMPLES; i++) {
    const angle = (i / RING_SAMPLES) * Math.PI * 2;
    const r = ring.radii[i] + pad;
    const x = ring.cx + Math.cos(angle) * r;
    const y = ring.cy + Math.sin(angle) * r;
    floor.push(project({ x, y, z: 0 }, camera));
    ceiling.push(project({ x, y, z: topZ }, camera));
  }
  return { floor, ceiling };
}

/** Smooth Catmull-Rom closed path through a ring of screen points. */
export function ringPath(pts: Point[]): string {
  const n = pts.length;
  if (n < 2) return '';
  const k = 0.5 / 6;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d + ' Z';
}

/** One quad per ring segment, connecting floor→ceiling as sub-paths. */
export function wallsPath(floor: Point[], ceiling: Point[]): string {
  let d = '';
  const n = floor.length;
  for (let i = 0; i < n; i++) {
    const f1 = floor[i];
    const f2 = floor[(i + 1) % n];
    const c2 = ceiling[(i + 1) % n];
    const c1 = ceiling[i];
    d += `M ${f1.x} ${f1.y} L ${f2.x} ${f2.y} L ${c2.x} ${c2.y} L ${c1.x} ${c1.y} Z `;
  }
  return d;
}
