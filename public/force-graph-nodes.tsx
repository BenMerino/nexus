import React from 'react';
import type { EnrichedSimNode } from './relationship-types';

type SimN = EnrichedSimNode & { x: number; y: number };

interface Props {
  nodes: SimN[];
  radius: (n: EnrichedSimNode) => number;
  color: (n: EnrichedSimNode) => string;
  hoverId: string | null;
  selectedId: string | null | undefined;
  connected: Set<string> | null;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onMouseDown: (e: React.MouseEvent, n: SimN) => void;
  onClick: (n: SimN) => void;
}

export function ForceGraphNodes({ nodes, radius, color, hoverId, selectedId, connected, onHoverStart, onHoverEnd, onMouseDown, onClick }: Props) {
  return (
    <g>
      {nodes.map(n => {
        const r = radius(n);
        const isSel = n.id === selectedId;
        const isHov = n.id === hoverId;
        const dim = connected && !connected.has(n.id);
        return (
          <g key={n.id} transform={`translate(${n.x || 0}, ${n.y || 0})`}
            onMouseEnter={() => onHoverStart(n.id)} onMouseLeave={onHoverEnd}
            onMouseDown={e => onMouseDown(e, n)}
            onClick={() => onClick(n)}
            style={{ cursor: 'pointer', opacity: dim ? 0.25 : 1, transition: 'opacity 0.2s' }}>
            {(isSel || isHov) && <circle r={r + 10} fill="url(#nodeGlow)" />}
            <circle r={r} fill={color(n)} stroke={isSel ? '#fff' : 'rgba(255,255,255,0.2)'} strokeWidth={isSel ? 2 : 1} />
            {(isHov || isSel || (n.weight && n.weight > 3)) && (
              <text x={0} y={r + 14} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={11} fontFamily="Inter, sans-serif" style={{ pointerEvents: 'none' }}>
                {n.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
