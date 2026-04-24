import React from 'react';
import type { SimL, BaseLink } from './forces';
import { project, type Camera } from './projection';

export { Nodes } from './render-nodes';

export function GraphDefs() {
  return (
    <defs>
      <radialGradient id="community-glow">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="graph-node-shadow">
        <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
      <pattern id="graph-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-soft)" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

/** A very large rect filled with the grid pattern. Sits behind the graph
 *  content inside the transform group so it pans + scales with the scene. */
export function GridBackdrop() {
  return <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#graph-grid)" style={{ pointerEvents: 'none' }} />;
}

interface LinksProps<L extends BaseLink & { weight?: number }> {
  links: SimL<L>[];
  connected: Set<string> | null;
  camera: Camera;
  /** True when the focus was a selection (multi-hop walk); edges in the
   *  `connected` set render as dashed accent lines to trace the path. On
   *  hover (false), edges in the connected set stay solid. */
  pathMode?: boolean;
  /** Skip edges touching a hidden endpoint. */
  hiddenIds?: Set<string>;
}

/** Two passes: every base edge renders as a solid line (faintly dimmed
 *  when a focus is active so the accent overlay stands out). Edges in the
 *  focused subgraph get a dashed accent line drawn on top — the "path"
 *  highlight. Non-focused edges keep only their solid pass. */
export function Links<L extends BaseLink & { weight?: number }>({ links, connected, camera, pathMode, hiddenIds }: LinksProps<L>) {
  const hasFocus = !!connected;
  interface Edge { key: number; x1: number; y1: number; x2: number; y2: number; w: number; inFocus: boolean }
  const edges: Edge[] = [];
  links.forEach((l, i) => {
    const s = typeof l.source === 'object' ? l.source : null;
    const t = typeof l.target === 'object' ? l.target : null;
    if (!s || !t) return;
    if (hiddenIds && (hiddenIds.has(s.id) || hiddenIds.has(t.id))) return;
    const sz = (s as unknown as { z?: number }).z ?? 0;
    const tz = (t as unknown as { z?: number }).z ?? 0;
    const ps = project({ x: s.x, y: s.y, z: sz }, camera);
    const pt = project({ x: t.x, y: t.y, z: tz }, camera);
    edges.push({
      key: i, x1: ps.x, y1: ps.y, x2: pt.x, y2: pt.y,
      w: l.weight || 1,
      inFocus: !!connected && connected.has(s.id) && connected.has(t.id),
    });
  });
  return (
    <g style={{ pointerEvents: 'none' }}>
      {edges.map(e => {
        const baseWidth = Math.min(2.5, 0.5 + e.w * 0.3);
        const solidOpacity = hasFocus ? (e.inFocus ? 0.25 : 0.05) : 0.14;
        return (
          <line key={`s-${e.key}`}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={`rgba(255,255,255,${solidOpacity})`}
            strokeWidth={baseWidth}
          />
        );
      })}
      {hasFocus && edges.filter(e => e.inFocus).map(e => {
        const baseWidth = Math.min(2.5, 0.5 + e.w * 0.3);
        return (
          <line key={`o-${e.key}`}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="var(--accent)" strokeOpacity={0.9}
            strokeWidth={baseWidth + 0.4}
            strokeDasharray={pathMode ? '5 4' : undefined}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}
