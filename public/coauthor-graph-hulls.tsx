import React from 'react';
import type { CoauthorNode } from './dashboard-builders.js';

type Positioned = CoauthorNode & { x: number; y: number };

interface Props {
  nodes: Positioned[];
  myRor: string | null;
  colors: Map<string, string>;
}

interface CommunityBubble {
  ror: string;
  name: string;
  color: string;
  cx: number;
  cy: number;
  r: number;
}

function collectByRor(nodes: Positioned[], myRor: string | null) {
  const groups = new Map<string, { name: string; points: { x: number; y: number }[] }>();
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

const MIN_COMMUNITY_SIZE = 3;

/** Centroid-anchored bounding circle, trimming the furthest 20% as outliers so
 *  one stray node can't inflate the whole area. */
function boundingCircle(points: { x: number; y: number }[], pad: number) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const distances = points.map(p => Math.hypot(p.x - cx, p.y - cy)).sort((a, b) => a - b);
  const keepIndex = Math.max(0, Math.ceil(distances.length * 0.8) - 1);
  const trimmedRadius = distances[keepIndex];
  return { cx, cy, r: trimmedRadius + pad };
}

export function CommunityHulls({ nodes, myRor, colors }: Props) {
  const bubbles: CommunityBubble[] = [];
  for (const [ror, group] of collectByRor(nodes, myRor)) {
    if (group.points.length < MIN_COMMUNITY_SIZE) continue;
    const { cx, cy, r } = boundingCircle(group.points, 18);
    bubbles.push({ ror, name: group.name, color: colors.get(ror) || '#888', cx, cy, r });
  }

  return (
    <g>
      {bubbles.map(b => (
        <circle
          key={b.ror}
          cx={b.cx}
          cy={b.cy}
          r={b.r}
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
