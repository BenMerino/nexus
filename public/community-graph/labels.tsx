import React from 'react';
import type { CommunityAdapter } from './types';

type Positioned<N> = N & { x: number; y: number };

interface EgoProps<N> {
  ego: Positioned<N>;
  adapter: CommunityAdapter<N>;
  scale: number;
}

export function EgoLabel<N>({ ego, adapter, scale }: EgoProps<N>) {
  const r = adapter.getRadius(ego);
  const x = (ego as unknown as { x: number }).x;
  const y = (ego as unknown as { y: number }).y;
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
}

export function HoverTooltip<N>({ node, adapter, scale }: HoverProps<N>) {
  const r = adapter.getRadius(node);
  const subtitle = adapter.getHoverSubtitle?.(node) ?? null;
  const footnote = adapter.getHoverFootnote?.(node) ?? null;
  const x = (node as unknown as { x: number }).x;
  const y = (node as unknown as { y: number }).y;
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
