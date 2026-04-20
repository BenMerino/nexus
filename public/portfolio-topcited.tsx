import React from 'react';

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
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-dim)', minWidth: 18 }}>#{i + 1}</span>
                <span style={{ fontSize: 13, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {w.title || w.doi}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>{cites.toLocaleString()}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--fg-dim)' }}>{w.year || ''}</span>
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
  const widths = ['85%', '70%', '92%', '60%', '78%'];
  const bars = [88, 64, 50, 38, 22];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-dim)', minWidth: 18 }}>#{i + 1}</span>
              <span className="skel" style={{ display: 'inline-block', width: widths[i % widths.length], height: 13 }}>x</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
              <span className="skel" style={{ display: 'inline-block', width: 36, height: 14 }}>x</span>
              <span className="skel" style={{ display: 'inline-block', width: 28, height: 10 }}>x</span>
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
