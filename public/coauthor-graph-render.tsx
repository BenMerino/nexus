import React from 'react';
import type { CoauthorNode, CoauthorEdge } from './dashboard-builders.js';

export type RenderNode = CoauthorNode & { x: number; y: number };
export type RenderLink = CoauthorEdge & { source: RenderNode | string; target: RenderNode | string };

export function radius(n: CoauthorNode) {
  return n.isMe ? 12 : 5 + Math.min(10, Math.sqrt(n.weight) * 1.5);
}

export function GraphDefs() {
  return (
    <defs>
      <radialGradient id="coauthor-glow">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

export function Links({ links, connected }: { links: RenderLink[]; connected: Set<string> | null }) {
  return (
    <g>
      {links.map((l, i) => {
        const s = typeof l.source === 'object' ? l.source : null;
        const t = typeof l.target === 'object' ? l.target : null;
        if (!s || !t) return null;
        const dim = connected && !(connected.has(s.id) && connected.has(t.id));
        return (
          <line
            key={i}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke={dim ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)'}
            strokeWidth={Math.min(2.5, 0.5 + l.weight * 0.3)}
          />
        );
      })}
    </g>
  );
}

interface NodesProps {
  nodes: RenderNode[];
  hoverId: string | null;
  connected: Set<string> | null;
  nodeColor: (n: CoauthorNode) => string;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onMouseDown: (e: React.MouseEvent, n: RenderNode) => void;
  onClick: (n: RenderNode) => void;
}

export function Nodes({ nodes, hoverId, connected, nodeColor, onHoverStart, onHoverEnd, onMouseDown, onClick }: NodesProps) {
  return (
    <g>
      {nodes.map(n => {
        const r = radius(n);
        const isHov = n.id === hoverId;
        const dim = connected && !connected.has(n.id);
        return (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            onMouseEnter={() => onHoverStart(n.id)}
            onMouseLeave={onHoverEnd}
            onMouseDown={e => onMouseDown(e, n)}
            onClick={e => { e.stopPropagation(); e.preventDefault(); onClick(n); }}
            style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity 0.2s' }}
          >
            {isHov && <circle r={r + 10} fill="url(#coauthor-glow)" />}
            <circle
              r={r}
              fill={nodeColor(n)}
              stroke={isHov ? '#fff' : 'rgba(255,255,255,0.2)'}
              strokeWidth={isHov ? 2 : 1}
            />
          </g>
        );
      })}
    </g>
  );
}
