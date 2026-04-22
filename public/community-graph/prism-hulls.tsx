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
/** Each community gets a prism at least this tall so same-layer groups
 *  still render as a real volume rather than a flat disc. */
const MIN_PRISM_HEIGHT = 120;

function polyPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d + ' Z';
}

/** Darkened version of a color by mixing toward black — used for face
 *  strokes so seams read slightly darker than the fill. */
function darken(color: string, amount: number): string {
  // Supports #rgb, #rrggbb, and leaves CSS functions / vars alone.
  if (!color.startsWith('#')) return color;
  const hex = color.length === 4
    ? color.slice(1).split('').map(c => c + c).join('')
    : color.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const t = Math.max(0, Math.min(1, amount));
  const mix = (c: number) => Math.round(c * (1 - t)).toString(16).padStart(2, '0');
  return `#${mix(r)}${mix(g)}${mix(b)}`;
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
    if (span < MIN_PRISM_HEIGHT) {
      const need = (MIN_PRISM_HEIGHT - span) / 2;
      bottomZ -= need;
      topZ += need;
    }
    const worldRing = ringToWorld(ring, pad);
    const stroke = darken(g.color, 0.5);
    allFaces.push(...prismFaces({ key: g.key, color: g.color, ring: worldRing, bottomZ, topZ }, camera, stroke));
    emphasisByKey.set(g.key, { fill: g.deemphasis ? 0.18 : g.emphasis ? 0.7 : 0.48 });
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
            stroke={f.stroke}
            strokeWidth={f.strokeWidth}
            strokeLinejoin="round"
            onMouseEnter={hoverable ? () => onHoverKey(communityKey) : undefined}
            onMouseLeave={hoverable ? () => onHoverKey(null) : undefined}
            style={{ cursor: hoverable ? 'pointer' : 'default', pointerEvents: hoverable ? 'fill' : 'none' }}
          />
        );
      })}
    </g>
  );
}
