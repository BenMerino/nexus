import React, { useMemo } from 'react';
import { buildCommunityColors, majorCommunities, effectiveKey, OTHER_KEY, OTHER_LABEL } from './communities';
import type { CommunityAdapter } from './types';

interface Props<N> {
  nodes: N[];
  adapter: CommunityAdapter<N>;
  primaryKey: string | null;
  minSize?: number;
}

export function CommunityLegend<N>({ nodes, adapter, primaryKey, minSize = 3 }: Props<N>) {
  const colors = useMemo(() => buildCommunityColors(nodes, adapter, primaryKey, minSize), [nodes, adapter, primaryKey, minSize]);
  const major = useMemo(() => majorCommunities(nodes, adapter, primaryKey, minSize), [nodes, adapter, primaryKey, minSize]);
  const items = useMemo(() => {
    const byKey = new Map<string, { name: string; count: number }>();
    for (const n of nodes) {
      const key = effectiveKey(n, adapter, major);
      if (!key) continue;
      const name = key === OTHER_KEY
        ? OTHER_LABEL
        : (adapter.getCommunityLabel?.(key, n) ?? key);
      const e = byKey.get(key) || { name, count: 0 };
      e.count += 1; byKey.set(key, e);
    }
    return [...byKey.entries()].sort((a, b) => {
      if (a[0] === primaryKey) return -1;
      if (b[0] === primaryKey) return 1;
      if (a[0] === OTHER_KEY) return 1;
      if (b[0] === OTHER_KEY) return -1;
      return b[1].count - a[1].count;
    });
  }, [nodes, adapter, major, primaryKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--fg-muted)' }}>
      {items.map(([key, info]) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.get(key), flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.name}</span>
          <span style={{ color: 'var(--fg-dim)', fontFamily: 'var(--mono)' }}>·{info.count}</span>
        </span>
      ))}
    </div>
  );
}
