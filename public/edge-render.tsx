import React from 'react';
import type { ProjectedEdge, EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';

function edgeStrokeWidth(weight: number): number {
  return Math.min(6, 0.3 + Math.log2(weight + 1) * 1.5);
}

function edgeOpacity(weight: number, isConnected: boolean, hasSelection: boolean): number {
  if (hasSelection && !isConnected) return 0.03;
  if (hasSelection && isConnected) return Math.min(0.7, 0.15 + weight * 0.1);
  return Math.min(0.6, 0.08 + weight * 0.08);
}

function bezierControlPoint(
  x1: number, y1: number, x2: number, y2: number, offset: number,
): { cx: number; cy: number } {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { cx: mx + (-dy / len) * offset, cy: my + (dx / len) * offset };
}

export function EdgeDefs({ edges, nodeMap }: {
  edges: ProjectedEdge[];
  nodeMap: Map<string, EnrichedSimNode>;
}) {
  const seen = new Set<string>();
  const gradients: React.ReactNode[] = [];

  for (const e of edges) {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    if (!s || !t || s.group === t.group) continue;
    const key = s.group < t.group ? `${s.group}-${t.group}` : `${t.group}-${s.group}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [g1, g2] = s.group < t.group ? [s.group, t.group] : [t.group, s.group];
    gradients.push(
      <linearGradient key={key} id={`eg-${key}`} gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={COLORS[g1]} />
        <stop offset="100%" stopColor={COLORS[g2]} />
      </linearGradient>
    );
  }
  return <defs>{gradients}</defs>;
}

export function EdgeLine({ edge, nodeMap, selectedNodeId, connectedIds, hovered, onMouseEnter, onMouseLeave }: {
  edge: ProjectedEdge;
  nodeMap: Map<string, EnrichedSimNode>;
  selectedNodeId: string | null;
  connectedIds: Set<string>;
  hovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const s = nodeMap.get(edge.source);
  const t = nodeMap.get(edge.target);
  if (!s || !t) return null;

  const isConn = selectedNodeId ? connectedIds.has(edge.source) && connectedIds.has(edge.target) : true;
  const w = edge.weight;
  const sw = edgeStrokeWidth(w) + (hovered ? 2 : 0);
  const op = hovered ? 0.9 : edgeOpacity(w, isConn, !!selectedNodeId);

  // Gradient for cross-category edges, solid for same-category
  const gradKey = s.group !== t.group
    ? `eg-${s.group < t.group ? `${s.group}-${t.group}` : `${t.group}-${s.group}`}`
    : null;
  const stroke = gradKey ? `url(#${gradKey})` : (isConn && selectedNodeId ? COLORS[t.group] || '#ccc' : '#bbb');

  // Use bezier curve for strong edges
  if (w >= 3) {
    const offset = Math.min(20, w * 3);
    const { cx, cy } = bezierControlPoint(s.x, s.y, t.x, t.y, offset);
    return (
      <path d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={op}
        strokeLinecap="round"
        style={{ cursor: 'pointer', transition: 'opacity 150ms' }}
        onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
    );
  }

  return (
    <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
      stroke={stroke} strokeWidth={sw} opacity={op}
      style={{ cursor: 'pointer', transition: 'opacity 150ms' }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
  );
}
