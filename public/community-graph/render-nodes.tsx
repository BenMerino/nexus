import React from 'react';
import type { CommunityAdapter } from './types';
import type { SimN } from './forces';
import { project, floorShadow, pitchLift, type Camera } from './projection';

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
  camera: Camera;
  /** Nodes to render invisible but keep in the sim. Used to hide authors
   *  until the user hovers a paper they're on. */
  hiddenIds?: Set<string>;
}

export function Nodes<N>({ nodes, adapter, hoverId, selectedId, connected, nodeColor, onHoverStart, onHoverEnd, onMouseDown, onClick, camera, hiddenIds }: NodesProps<N>) {
  // Painter's algorithm: lower Z first so higher layers stack on top when tilted.
  const zSorted = [...nodes].sort((a, b) => a.z - b.z);
  const lift = pitchLift(camera);
  const showShadows = lift > 0.02;
  return (
    <>
      {showShadows && (
        <g style={{ pointerEvents: 'none' }}>
          {zSorted.map(n => {
            if (n.z <= 0) return null;
            const id = adapter.getId(n);
            if (hiddenIds?.has(id)) return null;
            const r = adapter.getRadius(n);
            const dim = connected && !connected.has(id);
            const p = floorShadow(n.x, n.y, camera);
            const nodeLift = n.z * lift;
            const spread = Math.min(1.4, 1 + nodeLift / 180);
            return (
              <ellipse key={`sh-${id}`} cx={p.x} cy={p.y + 2}
                rx={r * spread} ry={r * 0.45 * spread}
                fill="url(#graph-node-shadow)"
                opacity={dim ? 0.1 : 0.35 * lift}
              />
            );
          })}
        </g>
      )}
      <g>
        {zSorted.map(n => {
          const id = adapter.getId(n);
          const hidden = hiddenIds?.has(id) ?? false;
          const r = adapter.getRadius(n);
          const isHov = id === hoverId;
          const isSel = id === selectedId;
          const dim = connected && !connected.has(id);
          const p = project(n, camera);
          const baseOpacity = hidden ? 0 : dim ? 0.25 : 1;
          return (
            <g key={id}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => onHoverStart(id)}
              onMouseLeave={onHoverEnd}
              onMouseDown={e => onMouseDown(e, n)}
              onClick={e => { e.stopPropagation(); e.preventDefault(); onClick(n); }}
              style={{ cursor: hidden ? 'default' : 'pointer', opacity: baseOpacity, pointerEvents: hidden ? 'none' : 'auto', transition: 'opacity 0.2s' }}
            >
              {(isHov || isSel) && <circle r={r + 10} fill="url(#community-glow)" />}
              <circle r={r} fill={nodeColor(n)}
                stroke={isHov || isSel ? '#fff' : 'rgba(255,255,255,0.2)'}
                strokeWidth={isHov || isSel ? 2 : 1}
              />
            </g>
          );
        })}
      </g>
    </>
  );
}
