import React, { useMemo } from 'react';
import type { RawNode } from './relationship-types';

function yearOf(n: RawNode): number {
  if (n.group !== 'doi' || !n.published) return 0;
  const y = parseInt(n.published.substring(0, 4));
  return y > 1900 ? y : 0;
}

export function useTimeRange(nodes: RawNode[]) {
  return useMemo(() => {
    let min = 9999, max = 0;
    for (const n of nodes) {
      const y = yearOf(n);
      if (y) { min = Math.min(min, y); max = Math.max(max, y); }
    }
    return { min: min > max ? 0 : min, max };
  }, [nodes]);
}

export function useTimeFilter(rawNodes: RawNode[], rawEdges: { source: string; target: string }[], maxYear: number) {
  return useMemo(() => {
    if (!maxYear) return { nodes: rawNodes, edges: rawEdges };
    const keep = new Set<string>();
    const nodes = rawNodes.filter(n => {
      if (n.group !== 'doi') return true;
      const y = yearOf(n);
      const ok = !y || y <= maxYear;
      if (ok) keep.add(n.id);
      return ok;
    });
    const edges = rawEdges.filter(e => !e.source.startsWith('doi:') || keep.has(e.source));
    return { nodes, edges };
  }, [rawNodes, rawEdges, maxYear]);
}

export function TimeSlider({ min, max, value, onChange }: {
  min: number; max: number; value: number; onChange: (y: number) => void;
}) {
  if (!min || !max || min >= max) return null;
  const display = value || max;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 11, minWidth: 200 }}>
      <span style={{ color: '#999' }}>{min}</span>
      <input type="range" min={min} max={max} value={display}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ flex: 1, minWidth: 100, cursor: 'pointer' }} />
      <span style={{ color: '#333', fontWeight: 700, minWidth: 32 }}>{display}</span>
    </div>
  );
}
