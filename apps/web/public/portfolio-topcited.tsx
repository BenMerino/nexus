import React from 'react';
import { Skeleton } from '../ui/primitives';

export type TopCitedItem = { doi: string; title: string | null; year: string | null; citation_count: number | null };

export function TopCitedPanel({ items }: { items: TopCitedItem[] }) {
  if (!items.length) return <p style={{ color: 'var(--fg-muted)' }}>No citation data yet.</p>;
  const max = Math.max(1, ...items.map(i => i.citation_count || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((w, i) => {
        const cites = w.citation_count || 0;
        const pct = (cites / max) * 100;
        return (
          <div key={w.doi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0, flex: 1 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-micro)', color: 'var(--fg-dim)', minWidth: 18 }}>#{i + 1}</span>
                <span style={{ fontSize: 'var(--text-detail)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {w.title || w.doi}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-body)', color: 'var(--accent)', fontWeight: 'var(--weight-h3)' }}>{cites.toLocaleString()}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-micro)', color: 'var(--fg-dim)' }}>{w.year || ''}</span>
              </div>
            </div>
            <div style={{ height: 3, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', opacity: 0.7 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TopCitedPanelSkeleton({ rows = 5 }: { rows?: number }) {
  const titles = [
    'A representative paper title spanning roughly two lines for layout',
    'Another title placeholder of moderate length',
    'A longer placeholder title that fills the column nicely on a wider card',
    'Short title placeholder',
    'A medium-length title placeholder for ranking',
  ];
  const bars = [88, 64, 50, 38, 22];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-micro)', color: 'var(--fg-dim)', minWidth: 18 }}>#{i + 1}</span>
              <Skeleton as="span" style={{ fontSize: 'var(--text-detail)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {titles[i % titles.length]}
              </Skeleton>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
              <Skeleton as="span" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-body)', fontWeight: 'var(--weight-h3)' }}>0,000</Skeleton>
              <Skeleton as="span" style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-micro)' }}>0000</Skeleton>
            </div>
          </div>
          <div style={{ height: 3, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${bars[i % bars.length]}%`, height: '100%', background: 'var(--border-soft)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
