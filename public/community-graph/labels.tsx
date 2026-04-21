import React from 'react';
import type { CommunityAdapter } from './types';

type Positioned<N> = N & { x: number; y: number };

interface EgoProps<N> {
  ego: Positioned<N>;
  adapter: CommunityAdapter<N>;
}

export function EgoLabel<N>({ ego, adapter }: EgoProps<N>) {
  const r = adapter.getRadius(ego);
  const x = (ego as unknown as { x: number }).x;
  const y = (ego as unknown as { y: number }).y;
  return (
    <text
      x={x}
      y={y + r + 14}
      textAnchor="middle"
      style={{ pointerEvents: 'none', fontSize: 11, fill: 'rgba(255,255,255,0.85)', paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 3, strokeLinejoin: 'round' }}
    >
      {adapter.getLabel(ego)}
    </text>
  );
}

interface HoverProps<N> {
  node: Positioned<N>;
  adapter: CommunityAdapter<N>;
}

export function HoverTooltip<N>({ node, adapter }: HoverProps<N>) {
  const r = adapter.getRadius(node);
  const subtitle = adapter.getHoverSubtitle?.(node) ?? null;
  const footnote = adapter.getHoverFootnote?.(node) ?? null;
  const x = (node as unknown as { x: number }).x;
  const y = (node as unknown as { y: number }).y;
  const lines: string[] = [adapter.getLabel(node)];
  if (subtitle) lines.push(subtitle);
  if (footnote) lines.push(footnote);
  const topY = y - r - 10 - (lines.length - 1) * 14;
  return (
    <g style={{ pointerEvents: 'none' }}>
      {lines.map((line, i) => (
        <text key={i} x={x} y={topY + i * 14} textAnchor="middle"
          style={{
            fontSize: i === 0 ? 12 : 11,
            fill: i === 0 ? 'var(--fg)' : 'var(--fg-muted)',
            fontWeight: i === 0 ? 500 : 400,
            paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 3, strokeLinejoin: 'round',
          }}
        >{line}</text>
      ))}
    </g>
  );
}
