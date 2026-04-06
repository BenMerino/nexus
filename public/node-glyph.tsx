import React from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS, BG_COLORS, nodeRadius } from './relationship-types';

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function CategoryRing({ node, r }: { node: EnrichedSimNode; r: number }) {
  const profile = node.categoryProfile;
  if (!profile.length || r < 6) return null;
  const total = profile.reduce((s, p) => s + p.weight, 0);
  if (total === 0) return null;

  const ringR = r + 3;
  let angle = -Math.PI / 2;
  return (
    <g>
      {profile.map((p, i) => {
        const sweep = (p.weight / total) * Math.PI * 2;
        if (sweep < 0.05) { angle += sweep; return null; }
        const start = angle;
        angle += sweep;
        return (
          <path key={i} d={arcPath(node.x, node.y, ringR, start, angle)}
            fill="none" stroke={COLORS[p.category] || '#999'}
            strokeWidth={2.5} opacity={0.7} strokeLinecap="round" />
        );
      })}
    </g>
  );
}

function DiamondShape({ node, r }: { node: EnrichedSimNode; r: number }) {
  const d = r * 1.2;
  const points = `${node.x},${node.y - d} ${node.x + d},${node.y} ${node.x},${node.y + d} ${node.x - d},${node.y}`;
  return (
    <polygon points={points}
      fill={BG_COLORS[node.group] || '#eee'}
      stroke={COLORS[node.group]} strokeWidth={2} />
  );
}

export function NodeGlyph({
  node, highlighted, dimmed, selected, hovered, pinIndex,
  onClick, onDragStart, onMouseEnter, onMouseLeave,
}: {
  node: EnrichedSimNode;
  highlighted: boolean; dimmed: boolean; selected: boolean; hovered: boolean;
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

  return (
    <g onClick={onClick}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ cursor: 'grab', transition: 'opacity 200ms ease' }}
      opacity={dimmed ? 0.1 : 1}>

      {/* Halo for citation intensity */}
      {node.haloIntensity && node.haloIntensity > 0 && !dimmed && (
        <circle cx={node.x} cy={node.y} r={r + 8 + node.haloIntensity * 6}
          fill={COLORS[node.group]} opacity={0.06 + node.haloIntensity * 0.04} />
      )}

      {/* Selection / highlight ring */}
      {(selected || highlighted || hovered) && (
        <circle cx={node.x} cy={node.y} r={r + 5}
          fill="none" stroke={COLORS[node.group]}
          strokeWidth={selected ? 2.5 : hovered ? 2 : 1.5}
          opacity={0.5}
          strokeDasharray={hovered && !selected ? '3 2' : undefined} />
      )}

      {/* Category profile ring */}
      {!isBridge && <CategoryRing node={node} r={r} />}

      {/* Hub double ring */}
      {isHub && !dimmed && (
        <circle cx={node.x} cy={node.y} r={r + 6}
          fill="none" stroke={COLORS[node.group]} strokeWidth={1} opacity={0.3} />
      )}

      {/* Main shape */}
      {isBridge
        ? <DiamondShape node={node} r={r} />
        : <circle cx={node.x} cy={node.y} r={r}
            fill={selected ? COLORS[node.group] : BG_COLORS[node.group] || '#eee'}
            stroke={COLORS[node.group]} strokeWidth={r >= 8 ? 2 : 1.5} />
      }

      {/* Open access indicator */}
      {node.openAccess && !dimmed && (
        <circle cx={node.x + r * 0.6} cy={node.y - r * 0.6} r={2.5}
          fill="#2e7d32" stroke="#fff" strokeWidth={0.5} />
      )}

      {/* Weight label inside node */}
      {(node.weight || 0) > 1 && !dimmed && (
        <text x={node.x} y={node.y + 3.5} textAnchor="middle"
          fontSize={Math.max(7, Math.min(10, r))} fontFamily="monospace" fontWeight={700}
          fill={selected ? '#fff' : COLORS[node.group]} opacity={0.8}>
          {node.weight}
        </text>
      )}

      {/* Pin order badge */}
      {pinIndex !== null && !dimmed && (
        <g>
          <circle cx={node.x - r * 0.5} cy={node.y - r - 4} r={7}
            fill={COLORS[node.group]} stroke="#fff" strokeWidth={1.5} />
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
          fill={selected ? COLORS[node.group] : '#333'}>
          {label}
        </text>
      )}
    </g>
  );
}
