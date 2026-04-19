import React from 'react';
import { COLORS } from './relationship-types';

const ITEMS: { group: string; shape: string; label: string }[] = [
  { group: 'institution', shape: '\u25C6', label: 'Institution' },
  { group: 'author', shape: '\u2B21', label: 'Author' },
  { group: 'journal', shape: '\u25CF', label: 'Journal' },
];

export function GraphLegend() {
  return (
    <div style={{
      display: 'inline-flex', gap: 12, fontSize: 11, fontFamily: 'monospace',
      color: '#666', alignItems: 'center',
    }}>
      {ITEMS.map(({ group, shape, label }) => (
        <span key={group} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <span style={{ color: COLORS[group], fontSize: 13 }}>{shape}</span>
          <span>{label}</span>
        </span>
      ))}
      <span style={{ color: '#999', fontSize: 10 }}>size = paper count</span>
    </div>
  );
}
