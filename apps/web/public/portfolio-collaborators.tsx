import React from 'react';

export type Suggested = {
  orcid: string;
  name: string | null;
  faculty: string | null;
  sharedConcepts: string[];
  sharedCount: number;
};

export function CollaboratorsPanel({ suggested }: { suggested: Suggested[] }) {
  if (!suggested.length) {
    return (
      <p style={{ color: 'var(--fg-muted)' }}>
        No potential collaborators found yet. Backfill needs to run, or no one in your tenant
        shares your concepts (excluding existing co-authors).
      </p>
    );
  }
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 12 }}>
        Researchers in your institution working on similar concepts you haven&rsquo;t co-authored with yet.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {suggested.map(s => (
          <div key={s.orcid} style={{ borderLeft: '2px solid var(--accent)', padding: '10px 14px', background: 'var(--bg-inset)', borderRadius: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name || s.orcid}</div>
                {s.faculty && <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{s.faculty}</div>}
              </div>
              <a
                href={`/overview.html?highlight=${encodeURIComponent(s.orcid)}`}
                style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)' }}
              >On graph →</a>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {s.sharedConcepts.map(c => (
                <span key={c} style={{ fontSize: 10, background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '1px 8px', fontFamily: 'var(--mono)', color: 'var(--fg-muted)' }}>{c}</span>
              ))}
              <span style={{ fontSize: 10, color: 'var(--fg-dim)', marginLeft: 4 }}>{s.sharedCount} shared</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
