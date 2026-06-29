import React from 'react';
import { SectionHead, Ico, Skeleton } from './ui-kit';
import type { DashboardData } from './dashboard-builders';
import { TYPE_DISPLAY_LABELS } from './type-labels';

const SKELETON_TITLES = [
  'A representative paper title for the recently indexed table layout',
  'Another placeholder title with a typical length',
  'A longer placeholder title that may wrap to two lines on narrow widths',
  'Short placeholder title',
  'Medium-length placeholder title for a recent paper',
];

export function RecentlyIndexed({ data }: { data: DashboardData }) {
  const papers = data.recentPapers || [];
  return (
    <section className="card card-span-2">
      <SectionHead eyebrow="Ledger" title="Recently indexed" right={<a className="link-btn" href="/explore.html">All papers {Ico.arrow}</a>} />
      {papers.length === 0 ? <div className="muted">No papers yet.</div> : (
        <table className="paper-table">
          <thead><tr><th>Title</th><th>Type</th><th>Journal</th><th>Published</th><th>Cites</th></tr></thead>
          <tbody>
            {papers.map(p => (
              <tr key={p.doi}>
                <td className="paper-title">{p.title || '(untitled)'}<div className="mono paper-doi">{p.doi}</div></td>
                <td>{p.type ? <span className="tag type mono">{TYPE_DISPLAY_LABELS[p.type] || p.type}</span> : '—'}</td>
                <td>{p.journal || '—'}</td>
                <td>{p.published?.slice(0, 4) || '—'}</td>
                <td>{p.citation_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Loading state, co-located: same card + table shell as RecentlyIndexed, each
 *  cell ghosted by the Skeleton primitive so the geometry matches the real row. */
RecentlyIndexed.Skeleton = function RecentlyIndexedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section className="card card-span-2">
      <SectionHead eyebrow="Ledger" title="Recently indexed" />
      <table className="paper-table">
        <thead><tr><th>Title</th><th>Type</th><th>Journal</th><th>Published</th><th>Cites</th></tr></thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="paper-title">
                <Skeleton as="span">{SKELETON_TITLES[i % SKELETON_TITLES.length]}</Skeleton>
                <div className="mono paper-doi"><Skeleton as="span">10.0000/example.0000.000000</Skeleton></div>
              </td>
              <td><Skeleton as="span" className="tag type mono">Article</Skeleton></td>
              <td><Skeleton as="span">Revista Médica de Chile</Skeleton></td>
              <td><Skeleton as="span">2024</Skeleton></td>
              <td><Skeleton as="span">000</Skeleton></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
