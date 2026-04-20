import React from 'react';

export type Concept = { name: string; works: number; score: number };

export function ConceptsPanel({ concepts }: { concepts: Concept[] }) {
  if (!concepts.length) {
    return <p style={{ color: 'var(--fg-muted)' }}>No concepts indexed yet — backfill needed.</p>;
  }
  const max = Math.max(1, ...concepts.map(c => c.works));
  const totalWorks = concepts.reduce((s, c) => s + c.works, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--fg-dim)', margin: '0 0 4px 0' }}>
        Topics on your works, by OpenAlex Concept (top {concepts.length}).
      </p>
      {concepts.map(c => {
        const pct = (c.works / max) * 100;
        const share = totalWorks > 0 ? Math.round((c.works / totalWorks) * 100) : 0;
        return (
          <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13 }}>{c.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-dim)', whiteSpace: 'nowrap' }}>
                {c.works} {c.works === 1 ? 'work' : 'works'} <span style={{ opacity: 0.6 }}>· {share}%</span>
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ConceptsPanelSkeleton({ rows = 6 }: { rows?: number }) {
  const widths = ['55%', '70%', '40%', '62%', '48%', '58%'];
  const bars = [92, 78, 64, 50, 36, 22];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 12, color: 'var(--fg-dim)', margin: '0 0 4px 0' }}>
        Topics on your works, by OpenAlex Concept.
      </p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span className="skel" style={{ display: 'inline-block', width: widths[i % widths.length], height: 13 }}>x</span>
            <span className="skel" style={{ display: 'inline-block', width: 80, height: 11, whiteSpace: 'nowrap' }}>x</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${bars[i % bars.length]}%`, height: '100%', background: 'var(--border-soft)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
