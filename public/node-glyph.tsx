import React from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS, BG_COLORS, nodeRadius } from './relationship-types';

function DiamondShape({ node, r, color, bg }: { node: EnrichedSimNode; r: number; color: string; bg: string }) {
  const d = r * 1.2;
  const points = `${node.x},${node.y - d} ${node.x + d},${node.y} ${node.x},${node.y + d} ${node.x - d},${node.y}`;
  return (
    <polygon points={points} fill={bg} stroke={color} strokeWidth={2} />
  );
}

export function NodeGlyph({
  node, highlighted, dimmed, selected, hovered, dense, pinIndex,
  onClick, onDragStart, onMouseEnter, onMouseLeave,
}: {
  node: EnrichedSimNode;
  highlighted: boolean; dimmed: boolean; selected: boolean; hovered: boolean;
  dense?: boolean;
  pinIndex: number | null;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const r = nodeRadius(node.weight || 0, node.role);
  const label = node.label.length > 28 ? node.label.substring(0, 25) + '...' : node.label;
  const fontSize = r >= 10 ? 11 : 10;
  const isBridge = node.role === 'bridge';
  const isHub = node.role === 'hub';
  const showDetail = !dense || selected || hovered;
  const cColor = COLORS[node.group] || '#666';
  const cBg = BG_COLORS[node.group] || '#eee';

  return (
    <g onClick={onClick}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ cursor: 'grab' }}
      opacity={dimmed ? 0.1 : 1}>

      {/* Halo for citation intensity — skip in dense mode */}
      {showDetail && node.haloIntensity && node.haloIntensity > 0 && !dimmed && (
        <circle cx={node.x} cy={node.y} r={r + 8 + node.haloIntensity * 6}
          fill={cColor} opacity={0.06 + node.haloIntensity * 0.04} />
      )}

      {/* Selection / highlight ring */}
      {(selected || highlighted || hovered) && (
        <circle cx={node.x} cy={node.y} r={r + 5}
          fill="none" stroke={cColor}
          strokeWidth={selected ? 2.5 : hovered ? 2 : 1.5}
          opacity={0.5}
          strokeDasharray={hovered && !selected ? '3 2' : undefined} />
      )}

      {/* Main shape — colored by category */}
      {isBridge
        ? <DiamondShape node={node} r={r} color={cColor} bg={cBg} />
        : <circle cx={node.x} cy={node.y} r={r}
            fill={selected ? cColor : cBg}
            stroke={cColor} strokeWidth={r >= 8 ? 2 : 1.5} />
      }

      {/* Open access indicator — skip in dense mode */}
      {showDetail && node.openAccess && !dimmed && (
        <circle cx={node.x + r * 0.6} cy={node.y - r * 0.6} r={2.5}
          fill="#2e7d32" stroke="#fff" strokeWidth={0.5} />
      )}

      {/* Weight label inside node */}
      {(node.weight || 0) > 1 && !dimmed && (
        <text x={node.x} y={node.y + 3.5} textAnchor="middle"
          fontSize={Math.max(7, Math.min(10, r))} fontFamily="monospace" fontWeight={700}
          fill={selected ? '#fff' : cColor} opacity={0.8}>
          {node.weight}
        </text>
      )}

      {/* Pin order badge — skip in dense mode */}
      {showDetail && pinIndex !== null && !dimmed && (
        <g>
          <circle cx={node.x - r * 0.5} cy={node.y - r - 4} r={7}
            fill={cColor} stroke="#fff" strokeWidth={1.5} />
          <text x={node.x - r * 0.5} y={node.y - r - 0.5} textAnchor="middle"
            fontSize={8} fontFamily="monospace" fontWeight={700} fill="#fff">
            {pinIndex + 1}
          </text>
        </g>
      )}

      {/* Label */}
      {!dimmed && (
        <text x={node.x + r + 4} y={node.y + 3.5} fontSize={fontSize} fontFamily="monospace"
          fontWeight={selected || isHub ? 700 : (node.weight || 0) >= 5 ? 600 : 400}
          fill={selected ? cColor : '#333'}>
          {label}
        </text>
      )}
    </g>
  );
}
