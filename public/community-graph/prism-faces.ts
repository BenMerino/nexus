import { projectWithDepth, type Camera } from './projection';
import { RING_SAMPLES } from '../convex-hull';

export interface Face {
  /** Screen-space polygon to draw. */
  points: { x: number; y: number }[];
  /** Camera-forward depth of the face centroid — larger is farther away. */
  depth: number;
  /** Solid fill color. */
  color: string;
  /** Stroke color (usually same hue slightly darker / semi-transparent). */
  stroke: string;
  strokeWidth: number;
  /** Role for pointer-event routing (only the top cap catches hover). */
  role: 'top' | 'side' | 'bottom';
  key: string;
}

export interface PrismInput {
  key: string;
  color: string;
  /** Ring sample positions in world XY (padded ring). */
  ring: { x: number; y: number }[];
  bottomZ: number;
  topZ: number;
}

/** Dot product of the 2D cross-product "normal" of a polygon with the
 *  camera-forward direction. When > 0 the face points away from the camera
 *  and should be culled (back-face). Since we use orthographic projection
 *  with the camera looking along +depth, the screen-space signed area tells
 *  us face orientation: CCW → facing camera, CW → back-facing. */
function screenSignedArea(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    a += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return a;
}

function centroidDepth(verts: { depth: number }[]): number {
  let s = 0;
  for (const v of verts) s += v.depth;
  return s / verts.length;
}

/** Triangulate a prism into side quads + top cap + bottom cap. Back-face
 *  cull before returning — only faces visible to the camera make it out. */
export function prismFaces(input: PrismInput, cam: Camera, darkerStroke: string): Face[] {
  const { ring, bottomZ, topZ, color, key } = input;
  const n = ring.length;
  if (n === 0) return [];

  // Project every ring vertex at both Z levels once.
  const bottom = ring.map(p => projectWithDepth({ x: p.x, y: p.y, z: bottomZ }, cam));
  const top = ring.map(p => projectWithDepth({ x: p.x, y: p.y, z: topZ }, cam));

  const faces: Face[] = [];

  // Side quads — one per ring segment. Quad is bottom[i] → bottom[i+1] →
  // top[i+1] → top[i], wound CCW when facing the camera.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const verts = [bottom[i], bottom[j], top[j], top[i]];
    if (screenSignedArea(verts) <= 0) continue; // back-facing; skip.
    faces.push({
      points: verts.map(v => ({ x: v.x, y: v.y })),
      depth: centroidDepth(verts),
      color,
      stroke: darkerStroke,
      strokeWidth: 0.5,
      role: 'side',
      key: `${key}:side:${i}`,
    });
  }

  // Top cap: facing up in world space, visible whenever pitch > 0 (top tilts
  // toward camera). Still back-face cull — guarantees correct behavior at
  // extreme pitches or if yaw flips the orientation.
  const topVerts = top;
  if (screenSignedArea(topVerts) > 0) {
    faces.push({
      points: topVerts.map(v => ({ x: v.x, y: v.y })),
      depth: centroidDepth(topVerts),
      color, stroke: darkerStroke, strokeWidth: 0.8,
      role: 'top', key: `${key}:top`,
    });
  }

  // Bottom cap: only visible when looking up from below (negative pitch or
  // extreme tumbles). Usually culled.
  const bottomVerts = [...bottom].reverse();
  if (screenSignedArea(bottomVerts) > 0) {
    faces.push({
      points: bottomVerts.map(v => ({ x: v.x, y: v.y })),
      depth: centroidDepth(bottomVerts),
      color, stroke: darkerStroke, strokeWidth: 0.8,
      role: 'bottom', key: `${key}:bottom`,
    });
  }

  return faces;
}

/** Build the padded ring in world XY from a smoothed RingState. */
export function ringToWorld(ring: { radii: number[]; cx: number; cy: number }, pad: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < RING_SAMPLES; i++) {
    const angle = (i / RING_SAMPLES) * Math.PI * 2;
    const r = ring.radii[i] + pad;
    out.push({ x: ring.cx + Math.cos(angle) * r, y: ring.cy + Math.sin(angle) * r });
  }
  return out;
}
