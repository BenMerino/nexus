import React from 'react';
import type { PublicStats } from './tenant-builders';
import { ES } from './tenant-i18n';

export function SummaryCards({ summary }: { summary: PublicStats['summary'] }) {
  const oaPct = summary.totalPubs > 0 ? Math.round((summary.oaCount / summary.totalPubs) * 100) : 0;
  const cards = [
    { label: ES.summary.publications, value: summary.totalPubs.toLocaleString() },
    { label: ES.summary.citations,    value: summary.totalCitations.toLocaleString() },
    { label: ES.summary.openAccess,   value: `${oaPct}%` },
    { label: ES.summary.authors,      value: summary.authorCount.toLocaleString() },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
      {cards.map((c, i) => (
        <div key={i} className="card" style={{ textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 500, fontFamily: 'var(--display)' }}>{c.value}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 4, fontFamily: 'var(--mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

export function SectionPlaceholder({ label, error }: { label: string; error?: string | null }) {
  return (
    <div style={{ padding: 24, color: error ? 'var(--danger, #c00)' : 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>
      {error ? `${ES.failedPrefix}: ${error}` : ES.loadingLabel(label)}
    </div>
  );
}

// Lazy tab pane: not rendered until first activated, then kept mounted so
// per-tab state (pagination, search, scroll) survives switching away and
// back. `display: none` when inactive — never unmount-on-hide.
export function TabPane({ id, active, seen, children }: {
  id: string; active: string; seen: Set<string>; children: React.ReactNode;
}) {
  if (!seen.has(id)) return null;
  return <section id={id} style={{ display: active === id ? 'block' : 'none' }}>{children}</section>;
}
