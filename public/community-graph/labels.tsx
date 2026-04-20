import React from 'react';
import type { CommunityAdapter } from './types';

type Positioned<N> = N & { x: number; y: number };

interface EgoProps<N> {
  ego: Positioned<N>;
  adapter: CommunityAdapter<N>;
}

export function EgoLabel<N>({ ego, adapter }: EgoProps<N>) {
  const r = adapter.getRadius(ego);
  return (
    <div
      style={{
        position: 'absolute',
        left: (ego as unknown as { x: number }).x,
        top: (ego as unknown as { y: number }).y + r + 6,
        transform: 'translate(-50%, 0)',
        pointerEvents: 'none',
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap',
        zIndex: 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      {adapter.getLabel(ego)}
    </div>
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
  return (
    <div
      style={{
        position: 'absolute',
        left: (node as unknown as { x: number }).x,
        top: (node as unknown as { y: number }).y - r - 8,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        borderRadius: 4,
        padding: '6px 10px',
        fontSize: 12,
        color: 'var(--fg)',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        zIndex: 2,
      }}
    >
      <div style={{ fontWeight: 500 }}>{adapter.getLabel(node)}</div>
      {subtitle && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{subtitle}</div>}
      {footnote && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>{footnote}</div>
      )}
    </div>
  );
}
