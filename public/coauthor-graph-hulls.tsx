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

export function CommunityHulls({ nodes, myRor, colors }: Props) {
  const hulls: CommunityHull[] = [];
  for (const [key, group] of collectByCommunity(nodes, myRor)) {
    if (group.points.length < 3) continue;
    const hull = convexHull(group.points);
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
