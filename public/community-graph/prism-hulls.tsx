import React, { useRef } from 'react';
import type { Point } from '../convex-hull';
import type { Camera } from './projection';
import { tickRing, type RingState } from './prism-geometry';
import { prismFaces, ringToWorld, type Face } from './prism-faces';

export interface PrismGroup {
  key: string;
  color: string;
  points: Point[];
  bottomZ: number;
  topZ: number;
  emphasis?: boolean;
  deemphasis?: boolean;
}

interface Props {
  groups: PrismGroup[];
  camera: Camera;
  pad?: number;
  lerpAlpha?: number;
  onHoverKey?: (key: string | null) => void;
}

const DEFAULT_PAD = 32;
const DEFAULT_LERP_ALPHA = 0.18;
/** Prism heights scale with member count — bigger communities tower over
 *  smaller ones, so the 3D stack reads as a bar chart of community size
 *  instead of a row of identical columns. */
const MIN_PRISM_HEIGHT = 30;
const HEIGHT_PER_NODE = 14;
const MAX_PRISM_HEIGHT = 260;

function heightForPoints(count: number): number {
  return Math.min(MAX_PRISM_HEIGHT, MIN_PRISM_HEIGHT + count * HEIGHT_PER_NODE);
}

function polyPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d + ' Z';
}

/** Volumetric community hulls: each community renders as a real 3D prism.
 *  Triangulated into side quads + top/bottom caps, back-face culled, then
 *  all faces across all prisms painter-sorted by camera depth so closer
 *  faces correctly occlude farther ones. Flat colors, no shading. */
export function PrismHulls({ groups, camera, pad = DEFAULT_PAD, lerpAlpha = DEFAULT_LERP_ALPHA, onHoverKey }: Props) {
  const stateRef = useRef<Map<string, RingState>>(new Map());
  const state = stateRef.current;
  const seen = new Set<string>();
  const allFaces: Face[] = [];
  const emphasisByKey = new Map<string, { fill: number }>();

  for (const g of groups) {
    const ring = tickRing(state, g.key, g.points, lerpAlpha);
    if (!ring) continue;
    seen.add(g.key);

    let bottomZ = g.bottomZ;
    let topZ = g.topZ;
    const span = topZ - bottomZ;
    // If the community spans multiple layers, that natural span is already
    // meaningful. If it sits on a single layer, give it a member-count-based
    // height so the volume reflects how many nodes are inside.
    const target = Math.max(span, heightForPoints(g.points.length));
    if (target > span) {
      const need = (target - span) / 2;
      bottomZ -= need;
      topZ += need;
    }
    const worldRing = ringToWorld(ring, pad);
    allFaces.push(...prismFaces({ key: g.key, color: g.color, ring: worldRing, bottomZ, topZ }, camera, 'none'));
    emphasisByKey.set(g.key, { fill: g.deemphasis ? 0.55 : g.emphasis ? 0.95 : 0.85 });
  }
  for (const key of [...state.keys()]) if (!seen.has(key)) state.delete(key);

  // Painter's algorithm: farther faces first, nearer faces last.
  allFaces.sort((a, b) => b.depth - a.depth);

  return (
    <g>
      {allFaces.map(f => {
        const communityKey = f.key.split(':')[0];
        const fill = emphasisByKey.get(communityKey)?.fill ?? 0.4;
        const hoverable = f.role === 'top' && onHoverKey;
        return (
          <path
            key={f.key}
            d={polyPath(f.points)}
            fill={f.color}
            fillOpacity={fill}
            stroke="none"
            shapeRendering="crispEdges"
            onMouseEnter={hoverable ? () => onHoverKey(communityKey) : undefined}
            onMouseLeave={hoverable ? () => onHoverKey(null) : undefined}
            style={{ cursor: hoverable ? 'pointer' : 'default', pointerEvents: hoverable ? 'fill' : 'none' }}
          />
        );
      })}
    </g>
  );
}
