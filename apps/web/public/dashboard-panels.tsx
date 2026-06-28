import React from 'react';
import { SectionHead, Ico } from './ui-kit';
import type { DashboardData } from './dashboard-builders';
import { TYPE_DISPLAY_LABELS } from './type-labels';

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
