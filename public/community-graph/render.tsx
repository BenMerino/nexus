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
}

/** Render every edge. Edges in the `connected` subgraph render highlighted
 *  (accent color, optionally dashed to trace a selection path); edges
 *  outside dim; edges with no focus render in base style. */
export function Links<L extends BaseLink & { weight?: number }>({ links, connected, camera, pathMode }: LinksProps<L>) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {links.map((l, i) => {
        const s = typeof l.source === 'object' ? l.source : null;
        const t = typeof l.target === 'object' ? l.target : null;
        if (!s || !t) return null;
        const inFocus = !!connected && connected.has(s.id) && connected.has(t.id);
        const dim = !!connected && !inFocus;
        const w = l.weight || 1;
        const sz = (s as unknown as { z?: number }).z ?? 0;
        const tz = (t as unknown as { z?: number }).z ?? 0;
        const ps = project({ x: s.x, y: s.y, z: sz }, camera);
        const pt = project({ x: t.x, y: t.y, z: tz }, camera);
        const baseWidth = Math.min(2.5, 0.5 + w * 0.3);
        if (inFocus) {
          return (
            <line key={i}
              x1={ps.x} y1={ps.y} x2={pt.x} y2={pt.y}
              stroke="var(--accent)" strokeOpacity={0.85}
              strokeWidth={baseWidth + 0.6}
              strokeDasharray={pathMode ? '5 4' : undefined}
              strokeLinecap="round"
            />
          );
        }
        return (
          <line key={i}
            x1={ps.x} y1={ps.y} x2={pt.x} y2={pt.y}
            stroke={dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={baseWidth}
          />
        );
      })}
    </g>
  );
}
