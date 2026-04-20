import React from 'react';
import type { CoauthorNode } from './dashboard-builders.js';
import { majorRors, communityKeyFor, OTHER_KEY, OTHER_LABEL } from './coauthor-communities';
import { convexHull, paddedHullPath, type Point } from './convex-hull';

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
}

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

/** Drop the furthest 20% of points from the community centroid, so a single
 *  drifting node can't pull the hull into a long diagonal sliver. */
function trimOutliers(points: Point[]): Point[] {
  if (points.length <= 3) return points;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const ranked = points
    .map(p => ({ p, d: Math.hypot(p.x - cx, p.y - cy) }))
    .sort((a, b) => a.d - b.d);
  const keep = Math.max(3, Math.ceil(ranked.length * 0.8));
  return ranked.slice(0, keep).map(r => r.p);
}

export function CommunityHulls({ nodes, myRor, colors }: Props) {
  const hulls: CommunityHull[] = [];
  for (const [key, group] of collectByCommunity(nodes, myRor)) {
    if (group.points.length < 3) continue;
    const trimmed = trimOutliers(group.points);
    const hull = convexHull(trimmed);
    const d = paddedHullPath(hull, 22);
    if (!d) continue;
    hulls.push({ key, name: group.name, color: colors.get(key) || '#888', d });
  }

  return (
    <g>
      {hulls.map(h => (
        <path
          key={h.key}
          d={h.d}
          fill={h.color}
          fillOpacity={0.1}
          stroke={h.color}
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}
