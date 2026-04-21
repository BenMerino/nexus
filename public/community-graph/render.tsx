import React from 'react';
import type { CommunityAdapter } from './types';
import type { SimN, SimL, BaseLink } from './forces';

export function GraphDefs() {
  return (
    <defs>
      <radialGradient id="community-glow">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
      <pattern id="graph-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-soft)" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

/** A very large rect filled with the grid pattern. Sits behind the
 *  graph content inside the transform group so it pans + scales with
 *  the rest of the scene — the canvas reads as a larger plane. */
export function GridBackdrop() {
  return <rect x={-5000} y={-5000} width={10000} height={10000} fill="url(#graph-grid)" style={{ pointerEvents: 'none' }} />;
}

interface LinksProps<N, L extends BaseLink & { weight?: number }> {
  links: SimL<L>[];
  connected: Set<string> | null;
}

export function Links<N, L extends BaseLink & { weight?: number }>({ links, connected }: LinksProps<N, L>) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {links.map((l, i) => {
        const s = typeof l.source === 'object' ? l.source : null;
        const t = typeof l.target === 'object' ? l.target : null;
        if (!s || !t) return null;
        const dim = connected && !(connected.has(s.id) && connected.has(t.id));
        const w = l.weight || 1;
        return (
          <line
            key={i}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke={dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={Math.min(2.5, 0.5 + w * 0.3)}
          />
        );
      })}
    </g>
  );
}

interface NodesProps<N> {
  nodes: SimN<N>[];
  adapter: CommunityAdapter<N>;
  hoverId: string | null;
  selectedId: string | null;
  connected: Set<string> | null;
  nodeColor: (n: SimN<N>) => string;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onMouseDown: (e: React.MouseEvent, n: SimN<N>) => void;
  onClick: (n: SimN<N>) => void;
}

export function Nodes<N>({ nodes, adapter, hoverId, selectedId, connected, nodeColor, onHoverStart, onHoverEnd, onMouseDown, onClick }: NodesProps<N>) {
  return (
    <g>
      {nodes.map(n => {
        const id = adapter.getId(n);
        const r = adapter.getRadius(n);
        const isHov = id === hoverId;
        const isSel = id === selectedId;
        const dim = connected && !connected.has(id);
        return (
          <g
            key={id}
            transform={`translate(${n.x}, ${n.y})`}
            onMouseEnter={() => onHoverStart(id)}
            onMouseLeave={onHoverEnd}
            onMouseDown={e => onMouseDown(e, n)}
            onClick={e => { e.stopPropagation(); e.preventDefault(); onClick(n); }}
            style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity 0.2s' }}
          >
            {(isHov || isSel) && <circle r={r + 10} fill="url(#community-glow)" />}
            <circle
              r={r}
              fill={nodeColor(n)}
              stroke={isHov || isSel ? '#fff' : 'rgba(255,255,255,0.2)'}
              strokeWidth={isHov || isSel ? 2 : 1}
            />
          </g>
        );
      })}
    </g>
  );
}
