import React from 'react';
import type { CoauthorNode } from './dashboard-builders.js';
import { majorRors, communityKeyFor } from './coauthor-communities';
import { SmoothedHulls, type HullGroup } from './smoothed-hulls';
import type { Point } from './convex-hull';

type Positioned = CoauthorNode & { x: number; y: number };

interface Props {
  nodes: Positioned[];
  myRor: string | null;
  colors: Map<string, string>;
}

function collectByCommunity(nodes: Positioned[], myRor: string | null) {
  const major = majorRors(nodes, myRor);
  const groups = new Map<string, Point[]>();
  for (const n of nodes) {
    const key = communityKeyFor(n, myRor, major);
    if (!key) continue;
    const points = groups.get(key);
    if (points) points.push({ x: n.x, y: n.y });
    else groups.set(key, [{ x: n.x, y: n.y }]);
  }
  return groups;
}

export function CommunityHulls({ nodes, myRor, colors }: Props) {
  const hullGroups: HullGroup[] = [];
  for (const [key, points] of collectByCommunity(nodes, myRor)) {
    hullGroups.push({
      key,
      color: colors.get(key) || '#888',
      points,
      emphasis: key === myRor,
    });
  }
  return <SmoothedHulls groups={hullGroups} />;
}
