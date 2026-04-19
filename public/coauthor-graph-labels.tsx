import React from 'react';
import type { CoauthorNode } from './dashboard-builders.js';

type Positioned = CoauthorNode & { x: number; y: number };

export function EgoLabel({ me, radius }: { me: Positioned; radius: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: me.x,
        top: me.y + radius + 6,
        transform: 'translate(-50%, 0)',
        pointerEvents: 'none',
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
        whiteSpace: 'nowrap',
        zIndex: 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      {me.label}
    </div>
  );
}

export function HoverTooltip({ node, radius }: { node: Positioned; radius: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y - radius - 8,
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
      <div style={{ fontWeight: 500 }}>{node.label}</div>
      {node.affiliation && (
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{node.affiliation.name}</div>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-dim)', marginTop: 2 }}>
        {node.weight} shared {node.weight === 1 ? 'paper' : 'papers'}
      </div>
    </div>
  );
}
