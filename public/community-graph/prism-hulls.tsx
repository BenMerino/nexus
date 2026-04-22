import React, { useRef } from 'react';
import type { Point } from '../convex-hull';
import type { Camera } from './projection';
import { tickRing, projectRing, ringPath, wallsPath, spokesPath, type RingState } from './prism-geometry';

export interface PrismGroup {
  key: string;
  color: string;
  /** Logical (x, y) positions of the community's nodes, used to shape the hull. */
  points: Point[];
  /** Lowest Z in the community — the prism floor. */
  bottomZ: number;
  /** Highest Z in the community — the prism ceiling. */
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
/** Even a single-layer community gets a prism this tall so the walls read
 *  as a visible 3D body rather than two overlapping rings. */
const MIN_PRISM_HEIGHT = 120;
/** Every Nth ring sample becomes a vertical spoke from floor to ceiling,
 *  reinforcing the 3D body. 72 samples / 12 = spoke every 30°. */
const SPOKE_STRIDE = 6;

interface Rendered { key: string; color: string; floor: Point[]; ceiling: Point[]; emphasis: boolean; deemphasis: boolean }

/** Volumetric community hulls: each community renders as a translucent prism
 *  — floor polygon at z=0, vertical walls, ceiling polygon at the tallest
 *  node's Z. Collapses to a flat ring when the camera is top-down. */
export function PrismHulls({ groups, camera, pad = DEFAULT_PAD, lerpAlpha = DEFAULT_LERP_ALPHA, onHoverKey }: Props) {
  const stateRef = useRef<Map<string, RingState>>(new Map());
  const state = stateRef.current;
  const seen = new Set<string>();
  const rendered: Rendered[] = [];

  for (const g of groups) {
    const ring = tickRing(state, g.key, g.points, lerpAlpha);
    if (!ring) continue;
    seen.add(g.key);
    // Ensure the prism is visibly tall even when every node shares one layer.
    // Sink the floor, lift the ceiling equally, so the community stays
    // vertically centered around its nodes.
    let bottomZ = g.bottomZ;
    let topZ = g.topZ;
    const span = topZ - bottomZ;
    if (span < MIN_PRISM_HEIGHT) {
      const need = (MIN_PRISM_HEIGHT - span) / 2;
      bottomZ -= need;
      topZ += need;
    }
    const { floor, ceiling } = projectRing(ring, pad, bottomZ, topZ, camera);
    rendered.push({ key: g.key, color: g.color, floor, ceiling, emphasis: !!g.emphasis, deemphasis: !!g.deemphasis });
  }
  for (const key of [...state.keys()]) if (!seen.has(key)) state.delete(key);

  // Painter's order by ceiling centroid Y — prisms closer to the camera
  // (higher screen Y after projection) paint last so they overlap correctly.
  rendered.sort((a, b) => {
    const ay = a.ceiling.reduce((s, p) => s + p.y, 0) / a.ceiling.length;
    const by = b.ceiling.reduce((s, p) => s + p.y, 0) / b.ceiling.length;
    return ay - by;
  });

  return (
    <g>
      {rendered.map(p => {
        const floorFill = p.deemphasis ? 0.08 : p.emphasis ? 0.35 : 0.22;
        const wallFill = p.deemphasis ? 0.06 : p.emphasis ? 0.28 : 0.18;
        const ceilingFill = p.deemphasis ? 0.04 : p.emphasis ? 0.18 : 0.10;
        const stroke = p.deemphasis ? 0.2 : p.emphasis ? 0.9 : 0.6;
        const width = p.emphasis ? 1.8 : 1.2;
        return (
          <g key={p.key}
            onMouseEnter={onHoverKey ? () => onHoverKey(p.key) : undefined}
            onMouseLeave={onHoverKey ? () => onHoverKey(null) : undefined}
            style={{ cursor: onHoverKey ? 'pointer' : 'default' }}
          >
            <path d={ringPath(p.floor)} fill={p.color} fillOpacity={floorFill} stroke={p.color} strokeOpacity={stroke * 0.6} strokeWidth={width} style={{ pointerEvents: 'fill' }} />
            <path d={wallsPath(p.floor, p.ceiling)} fill={p.color} fillOpacity={wallFill} stroke="none" style={{ pointerEvents: 'none' }} />
            <path d={spokesPath(p.floor, p.ceiling, SPOKE_STRIDE)} fill="none" stroke={p.color} strokeOpacity={stroke * 0.55} strokeWidth={width * 0.7} style={{ pointerEvents: 'none' }} />
            <path d={ringPath(p.ceiling)} fill={p.color} fillOpacity={ceilingFill} stroke={p.color} strokeOpacity={stroke} strokeWidth={width} style={{ pointerEvents: 'none' }} />
          </g>
        );
      })}
    </g>
  );
}
