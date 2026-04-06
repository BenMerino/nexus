import React, { useMemo } from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { BG_COLORS } from './relationship-types';

function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: { x: number; y: number }[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function paddedHullPath(hull: { x: number; y: number }[], pad: number): string {
  if (hull.length < 2) return '';
  if (hull.length === 2) {
    const [a, b] = hull;
    return `M ${a.x - pad} ${a.y - pad} L ${b.x + pad} ${b.y - pad} L ${b.x + pad} ${b.y + pad} L ${a.x - pad} ${a.y + pad} Z`;
  }
  // Offset hull outward by pad, then create rounded path
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  const expanded = hull.map(p => {
    const dx = p.x - cx; const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / dist) * pad, y: p.y + (dy / dist) * pad };
  });

  const pts = expanded;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]; const curr = pts[i];
    const mx = (prev.x + curr.x) / 2; const my = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1]; const first = pts[0];
  const mx = (last.x + first.x) / 2; const my = (last.y + first.y) / 2;
  d += ` Q ${last.x} ${last.y} ${mx} ${my} Z`;
  return d;
}

export function ClusterHulls({ layoutNodes }: { layoutNodes: EnrichedSimNode[] }) {
  const paths = useMemo(() => {
    const byGroup = new Map<string, { x: number; y: number }[]>();
    for (const n of layoutNodes) {
      const pts = byGroup.get(n.group) || [];
      pts.push({ x: n.x, y: n.y });
      byGroup.set(n.group, pts);
    }

    const result: { group: string; d: string }[] = [];
    for (const [group, points] of byGroup) {
      if (points.length < 3) continue;
      const hull = convexHull(points);
      const d = paddedHullPath(hull, 30);
      if (d) result.push({ group, d });
    }
    return result;
  }, [layoutNodes]);

  return (
    <g>
      {paths.map(({ group, d }) => (
        <path key={group} d={d} fill={BG_COLORS[group] || '#eee'} opacity={0.08}
          stroke={BG_COLORS[group] || '#eee'} strokeWidth={1} strokeOpacity={0.15} />
      ))}
    </g>
  );
}
