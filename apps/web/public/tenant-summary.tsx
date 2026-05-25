import React from 'react';
import type { PublicStats } from './tenant-builders';

export function SummaryCards({ summary }: { summary: PublicStats['summary'] }) {
  const oaPct = summary.totalPubs > 0 ? Math.round((summary.oaCount / summary.totalPubs) * 100) : 0;
  const cards = [
    { label: 'Publications', value: summary.totalPubs.toLocaleString() },
    { label: 'Citations', value: summary.totalCitations.toLocaleString() },
    { label: 'Open access', value: `${oaPct}%` },
    { label: 'Authors', value: summary.authorCount.toLocaleString() },
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
      {error ? `Failed: ${error}` : `Loading ${label}…`}
    </div>
  );
}
