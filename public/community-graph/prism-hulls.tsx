import React, { useRef } from 'react';
import type { Point } from '../convex-hull';
import type { Camera } from './projection';
import { tickRing, projectRing, ringPath, wallsPath, type RingState } from './prism-geometry';

export interface PrismGroup {
  key: string;
  color: string;
  /** Logical (x, y) positions of the community's nodes, used to shape the hull. */
  points: Point[];
  /** Max Z among the community's nodes — the prism ceiling height. */
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
    const { floor, ceiling } = projectRing(ring, pad, g.topZ, camera);
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
        const floorFill = p.deemphasis ? 0.05 : p.emphasis ? 0.28 : 0.16;
        const wallFill = p.deemphasis ? 0.04 : p.emphasis ? 0.22 : 0.13;
        const ceilingFill = p.deemphasis ? 0.04 : p.emphasis ? 0.16 : 0.09;
        const stroke = p.deemphasis ? 0.2 : p.emphasis ? 0.9 : 0.55;
        const width = p.emphasis ? 1.8 : 1.2;
        return (
          <g key={p.key}
            onMouseEnter={onHoverKey ? () => onHoverKey(p.key) : undefined}
            onMouseLeave={onHoverKey ? () => onHoverKey(null) : undefined}
            style={{ cursor: onHoverKey ? 'pointer' : 'default' }}
          >
            <path d={ringPath(p.floor)} fill={p.color} fillOpacity={floorFill} stroke={p.color} strokeOpacity={stroke * 0.6} strokeWidth={width} style={{ pointerEvents: 'fill' }} />
            <path d={wallsPath(p.floor, p.ceiling)} fill={p.color} fillOpacity={wallFill} stroke={p.color} strokeOpacity={stroke * 0.45} strokeWidth={width * 0.8} style={{ pointerEvents: 'none' }} />
            <path d={ringPath(p.ceiling)} fill={p.color} fillOpacity={ceilingFill} stroke={p.color} strokeOpacity={stroke} strokeWidth={width} style={{ pointerEvents: 'none' }} />
          </g>
        );
      })}
    </g>
  );
}
