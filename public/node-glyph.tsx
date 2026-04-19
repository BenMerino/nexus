import React from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS, BG_COLORS, nodeRadius } from './relationship-types';
import { shapePath } from './node-shapes';

function wrapLabel(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > maxChars) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) lines.push(line);
  return lines;
}

export function NodeGlyph({
  node, highlighted, collaboratorHint, dimmed, selected, hovered, expanded, showLabel = true, dense, pinIndex,
  onClick, onDragStart, onMouseEnter, onMouseLeave,
}: {
  node: EnrichedSimNode;
  highlighted: boolean; collaboratorHint?: boolean; dimmed: boolean; selected: boolean; hovered: boolean;
  expanded?: boolean; showLabel?: boolean; dense?: boolean; pinIndex: number | null;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const cColor = COLORS[node.group] || '#666';
  const cBg = BG_COLORS[node.group] || '#eee';
  const r = nodeRadius(node.weight || 0, node.role);
  const isDoi = node.group === 'doi';
  const label = isDoi
    ? (hovered || selected ? node.label : (node.label.length > 22 ? node.label.substring(0, 20) + '\u2026' : node.label))
    : (node.label.length > 28 ? node.label.substring(0, 25) + '...' : node.label);
  const fontSize = isDoi ? 9 : (r >= 10 ? 11 : 10);
  const d = shapePath(node.group, node.x, node.y, r);

  return (
    <g onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      style={{ cursor: 'grab', transition: 'opacity 200ms ease' }} opacity={dimmed ? 0.1 : 1}>
      {collaboratorHint && (
        d ? <path d={shapePath(node.group, node.x, node.y, r + 9)!} fill="none" stroke="#f9a825" strokeWidth={2} strokeDasharray="3 3" />
          : <circle cx={node.x} cy={node.y} r={r + 9} fill="none" stroke="#f9a825" strokeWidth={2} strokeDasharray="3 3" />
      )}
      {(selected || highlighted || hovered) && (
        d ? <path d={shapePath(node.group, node.x, node.y, r + 5)!} fill="none" stroke={cColor} strokeWidth={hovered ? 2 : 1.5} opacity={0.5} />
          : <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke={cColor} strokeWidth={hovered ? 2 : 1.5} opacity={0.5} />
      )}
      {d ? <path d={d} fill={selected ? cColor : cBg} stroke={cColor} strokeWidth={r >= 8 ? 2 : 1.5} />
         : <circle cx={node.x} cy={node.y} r={r} fill={selected ? cColor : cBg} stroke={cColor} strokeWidth={r >= 8 ? 2 : 1.5} />}
      {!dimmed && isDoi && (hovered || selected) && (
        <text x={node.x + r + 4} y={node.y - 4} fontSize={fontSize} fontFamily="monospace" fill="#333">
          {wrapLabel(label, 30).map((line, i) => (
            <tspan key={i} x={node.x + r + 4} dy={i === 0 ? 0 : 11}>{line}</tspan>
          ))}
        </text>
      )}
      {!dimmed && isDoi && !hovered && !selected && (
        <text x={node.x + r + 4} y={node.y + 3.5} fontSize={fontSize} fontFamily="monospace" fill="#333" opacity={0.5}>{label}</text>
      )}
      {!dimmed && !isDoi && (
        <text x={node.x + r + 4} y={node.y + 3.5} fontSize={fontSize} fontFamily="monospace"
          fontWeight={selected || node.role === 'hub' ? 700 : 400} fill={selected ? cColor : '#333'}>{label}</text>
      )}
    </g>
  );
}
