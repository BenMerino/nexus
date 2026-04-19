import React, { useMemo } from 'react';
import type { CoauthorNode } from './dashboard-builders.js';
import { convexHull, paddedHullPath, type Point } from './convex-hull';

type Positioned = CoauthorNode & { x: number; y: number };

interface Props {
  nodes: Positioned[];
  myRor: string | null;
  colors: Map<string, string>;
}

interface HullBundle {
  ror: string;
  name: string;
  color: string;
  d: string;
}

function collectByRor(nodes: Positioned[], myRor: string | null) {
  const groups = new Map<string, { name: string; points: Point[] }>();
  for (const n of nodes) {
    if (n.isMe || !n.affiliation?.ror || n.affiliation.ror === myRor) continue;
    const existing = groups.get(n.affiliation.ror);
    if (existing) {
      existing.points.push({ x: n.x, y: n.y });
    } else {
      groups.set(n.affiliation.ror, { name: n.affiliation.name, points: [{ x: n.x, y: n.y }] });
    }
  }
  return groups;
}

export function CommunityHulls({ nodes, myRor, colors }: Props) {
  const bundles = useMemo<HullBundle[]>(() => {
    const result: HullBundle[] = [];
    for (const [ror, group] of collectByRor(nodes, myRor)) {
      if (group.points.length < 2) continue;
      const hull = convexHull(group.points);
      const d = paddedHullPath(hull, 18);
      if (!d) continue;
      result.push({ ror, name: group.name, color: colors.get(ror) || '#888', d });
    }
    return result;
  }, [nodes, myRor, colors]);

  return (
    <g>
      {bundles.map(b => (
        <path
          key={b.ror}
          d={b.d}
          fill={b.color}
          fillOpacity={0.1}
          stroke={b.color}
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}
