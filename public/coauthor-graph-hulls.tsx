import React, { useRef } from 'react';
import type { CoauthorNode } from './dashboard-builders.js';
import { majorRors, communityKeyFor, OTHER_KEY, OTHER_LABEL } from './coauthor-communities';
import { computeRawRadii, radiiToPath, type Point } from './convex-hull';

type Positioned = CoauthorNode & { x: number; y: number };

interface Props {
  nodes: Positioned[];
  myRor: string | null;
  colors: Map<string, string>;
}

interface CommunityHull {
  key: string;
  name: string;
  color: string;
  d: string;
  isHome: boolean;
}

interface RingState {
  radii: number[];
  cx: number;
  cy: number;
}

const LERP_ALPHA = 0.18; // lower = smoother flow, higher = snappier follow
const HULL_PAD = 32;

function collectByCommunity(nodes: Positioned[], myRor: string | null) {
  const major = majorRors(nodes, myRor);
  const groups = new Map<string, { name: string; points: Point[] }>();
  for (const n of nodes) {
    const key = communityKeyFor(n, myRor, major);
    if (!key) continue;
    const name = key === OTHER_KEY ? OTHER_LABEL : (n.affiliation?.name || key);
    const existing = groups.get(key);
    if (existing) {
      existing.points.push({ x: n.x, y: n.y });
    } else {
      groups.set(key, { name, points: [{ x: n.x, y: n.y }] });
    }
  }
  return groups;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function CommunityHulls({ nodes, myRor, colors }: Props) {
  const stateRef = useRef<Map<string, RingState>>(new Map());
  const state = stateRef.current;

  const hulls: CommunityHull[] = [];
  const seenKeys = new Set<string>();

  for (const [key, group] of collectByCommunity(nodes, myRor)) {
    if (group.points.length < 3) continue;
    const cx = group.points.reduce((s, p) => s + p.x, 0) / group.points.length;
    const cy = group.points.reduce((s, p) => s + p.y, 0) / group.points.length;
    const targetRadii = computeRawRadii(group.points, cx, cy);
    const prev = state.get(key);

    let smoothRadii: number[];
    let smoothCx: number;
    let smoothCy: number;
    if (prev) {
      smoothRadii = prev.radii.map((r, i) => lerp(r, targetRadii[i], LERP_ALPHA));
      smoothCx = lerp(prev.cx, cx, LERP_ALPHA);
      smoothCy = lerp(prev.cy, cy, LERP_ALPHA);
    } else {
      smoothRadii = targetRadii;
      smoothCx = cx;
      smoothCy = cy;
    }
    state.set(key, { radii: smoothRadii, cx: smoothCx, cy: smoothCy });
    seenKeys.add(key);

    hulls.push({
      key, name: group.name,
      d: radiiToPath(smoothRadii, smoothCx, smoothCy, HULL_PAD),
      color: colors.get(key) || '#888',
      isHome: key === myRor,
    });
  }

  for (const key of [...state.keys()]) {
    if (!seenKeys.has(key)) state.delete(key);
  }

  return (
    <g>
      {hulls.map(h => (
        <path
          key={h.key}
          d={h.d}
          fill={h.color}
          fillOpacity={h.isHome ? 0.18 : 0.1}
          stroke={h.color}
          strokeOpacity={h.isHome ? 0.55 : 0.35}
          strokeWidth={h.isHome ? 1.5 : 1}
        />
      ))}
    </g>
  );
}

