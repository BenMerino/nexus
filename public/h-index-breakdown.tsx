import React from 'react';

const H_INDEX_TYPES: Array<{ key: string; label: string }> = [
  { key: 'journal-article', label: 'journal' },
  { key: 'conference-paper', label: 'conf' },
  { key: 'book-chapter', label: 'chapter' },
  { key: 'book', label: 'book' },
  { key: 'preprint', label: 'preprint' },
  { key: 'dataset', label: 'dataset' },
];

function entries(byType: Record<string, number>) {
  return H_INDEX_TYPES
    .map(t => ({ label: t.label, value: byType[t.key] }))
    .filter(e => e.value != null && e.value > 0);
}

export function HIndexBreakdown({ byType }: { byType?: Record<string, number> | null }) {
  if (!byType) return <>computed · real-time</>;
  const rows = entries(byType);
  if (rows.length === 0) return <>computed · real-time</>;
  return (
    <span className="hindex-breakdown">
      {rows.map((e, i) => (
        <span key={e.label}>
          {i > 0 ? ' · ' : ''}
          <strong>{e.value}</strong> {e.label}
        </span>
      ))}
    </span>
  );
}

export function hIndexTooltip(byType?: Record<string, number> | null): string | undefined {
  if (!byType) return undefined;
  const rows = entries(byType);
  if (rows.length === 0) return undefined;
  return rows.map(e => `${e.label}: ${e.value}`).join('\n');
}
