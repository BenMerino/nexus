import React from 'react';
import { Tag, Skeleton } from './ui-kit';

/* Shared types + leaf components between tenant-journals.tsx (area grid) and
 * tenant-journal-area.tsx (area drill-in) — split out so neither file grows
 * past N5 on its own. */

export type Journal = {
  id: number; issn: string | null; name: string; type: string; area: string | null;
  paperCount: number; citationCount: number;
  indexation: { wos: boolean; scopus: boolean; doaj: boolean; scielo: boolean };
};
export type Area = { name: string; count: number };
export type JournalsResponse = {
  ok: boolean; journals: Journal[]; page: number; pageSize: number; totalCount: number; areas?: Area[];
};

export const PAGE_SIZE = 24;

const FLAGS: { key: keyof Journal['indexation']; label: string }[] = [
  { key: 'wos', label: 'WoS' }, { key: 'scopus', label: 'Scopus' },
  { key: 'doaj', label: 'DOAJ' }, { key: 'scielo', label: 'SciELO' },
];

function Indexation({ ix }: { ix: Journal['indexation'] }) {
  const on = FLAGS.filter(f => ix[f.key]);
  if (on.length === 0) return <span className="muted">—</span>;
  return <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{on.map(f => <Tag key={f.key} mono>{f.label}</Tag>)}</span>;
}

const num: React.CSSProperties = { textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' };

// A journal ROW on the roster's .admin-table (same table UI as AuthorsTable —
// not the plain .paper-table the top-level views use).
export function JournalRow({ j }: { j: Journal }) {
  return (
    <tr>
      <td>{j.name}</td>
      <td style={num}>{j.paperCount.toLocaleString()}</td>
      <td style={num}>{j.citationCount.toLocaleString()}</td>
      <td>{j.issn
        ? <span className="mono" style={{ fontSize: 'var(--text-micro)' }}>{j.issn}</span>
        : <span className="text-muted text-small">—</span>}</td>
      <td><Indexation ix={j.indexation} /></td>
    </tr>
  );
}

export function JournalRowSkeleton() {
  return (
    <tr>
      <td><Skeleton as="span">Revista Médica de Chile</Skeleton></td>
      <td style={num}><Skeleton as="span">00</Skeleton></td>
      <td style={num}><Skeleton as="span">000</Skeleton></td>
      <td><Skeleton as="span">0000-0000</Skeleton></td>
      <td><Skeleton as="span">Scopus · WoS</Skeleton></td>
    </tr>
  );
}
