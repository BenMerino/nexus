import React from 'react';
import type { CommunityAdapter } from './types';
import { project } from './projection';

type Positioned<N> = N & { x: number; y: number; z?: number };

interface EgoProps<N> {
  ego: Positioned<N>;
  adapter: CommunityAdapter<N>;
  scale: number;
  tilt: number;
}

export function EgoLabel<N>({ ego, adapter, scale, tilt }: EgoProps<N>) {
  const r = adapter.getRadius(ego);
  const p = project({ x: ego.x, y: ego.y, z: ego.z ?? 0 }, tilt);
  const x = p.x;
  const y = p.y;
  return (
    <text
      x={x}
      y={y + r + 14 / scale}
      textAnchor="middle"
      style={{ pointerEvents: 'none', fontSize: 11 / scale, fill: 'rgba(255,255,255,0.85)', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 3 / scale, strokeLinejoin: 'round' }}
    >
      {adapter.getLabel(ego)}
    </text>
  );
}

interface HoverProps<N> {
  node: Positioned<N>;
  adapter: CommunityAdapter<N>;
  scale: number;
  tilt: number;
}

export function HoverTooltip<N>({ node, adapter, scale, tilt }: HoverProps<N>) {
  const r = adapter.getRadius(node);
  const subtitle = adapter.getHoverSubtitle?.(node) ?? null;
  const footnote = adapter.getHoverFootnote?.(node) ?? null;
  const p = project({ x: node.x, y: node.y, z: node.z ?? 0 }, tilt);
  const x = p.x;
  const y = p.y;
  const lines: string[] = [adapter.getLabel(node)];
  if (subtitle) lines.push(subtitle);
  if (footnote) lines.push(footnote);
  const line = 14 / scale;
  const topY = y - r - 10 / scale - (lines.length - 1) * line;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {lines.map((l, i) => (
        <text key={i} x={x} y={topY + i * line} textAnchor="middle"
          style={{
            fontSize: (i === 0 ? 12 : 11) / scale,
            fill: i === 0 ? 'var(--fg)' : 'var(--fg-muted)',
            fontWeight: i === 0 ? 500 : 400,
            paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3 / scale, strokeLinejoin: 'round',
          }}
        >{l}</text>
      ))}
    </g>
  );
}
