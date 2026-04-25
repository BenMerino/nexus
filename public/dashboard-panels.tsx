import React from 'react';
import { Tag, SectionHead, Ico } from './ui-primitives';
import type { DashboardData } from './dashboard-builders.js';
import { TYPE_DISPLAY_LABELS } from './type-labels.js';

export function yearlyCounts(data: DashboardData): { year: string; count: number }[] {
  const byYear = new Map<string, number>();
  for (const r of data.yearSource) {
    const y = r.year;
    if (!y) continue;
    byYear.set(y, (byYear.get(y) || 0) + parseInt(r.count));
  }
  return [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([year, count]) => ({ year, count }));
}

export function BarChart({ rows, title }: { rows: { year: string; count: number }[]; title: string }) {
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <section className="card card-chart">
      <SectionHead eyebrow="Output" title={title} right={<Tag mono tone="muted">{rows[0]?.year}–{rows[rows.length - 1]?.year}</Tag>} />
      <div className="bar-chart">
        {rows.map(r => (
          <div key={r.year} className="bar-col">
            <div className="bar-wrap">
              <div className="bar" style={{ height: `${(r.count / max) * 100}%` }}>
                <span className="bar-val">{r.count}</span>
              </div>
            </div>
            <div className="bar-label">{r.year}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TopJournals({ data }: { data: DashboardData }) {
  const top = (data.topJournals || []).slice(0, 5);
  return (
    <section className="card">
      <SectionHead eyebrow="Venues" title="Top journals" />
      <ul className="ranked-list">
        {top.length === 0 && <li className="empty">No journal data yet.</li>}
        {top.map((j, i) => (
          <li key={j.key}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="rank-label">
              <span className="rank-title">{j.value}</span>
              <span className="rank-meta mono">{j.key !== j.value ? j.key : ''}</span>
            </span>
            <span className="rank-count">{j.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PartnerInstitutions({ data }: { data: DashboardData }) {
  const top = data.collabs.slice(0, 6);
  return (
    <section className="card">
      <SectionHead eyebrow="Collaborations" title="Partner institutions" />
      <ul className="ranked-list">
        {top.length === 0 && <li className="empty">No external co-authors detected yet.</li>}
        {top.map((c, i) => (
          <li key={i}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="rank-label"><span className="rank-title">{c.value}</span></span>
            <span className="rank-count">{c.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
