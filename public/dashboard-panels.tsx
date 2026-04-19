import React from 'react';
import { Tag, SectionHead, Ico } from './ui-primitives';
import type { DashboardData } from './dashboard-builders.js';

export function yearlyCounts(data: DashboardData): { year: string; count: number }[] {
  const byYear = new Map<string, number>();
  for (const r of data.yearSource) {
    const y = r.year;
    if (!y) continue;
    byYear.set(y, (byYear.get(y) || 0) + parseInt(r.count));
  }
  return [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([year, count]) => ({ year, count }));
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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

export function CoAuthorGraph({ data }: { data: DashboardData }) {
  const p = data.portfolio;
  const count = p?.collaborators.existing.length ?? 0;
  const shown = Math.min(count, 18);
  const W = 520, H = 220, cx = W / 2, cy = H / 2;
  const nodes = Array.from({ length: shown }, (_, i) => {
    const a = (i / shown) * Math.PI * 2 - Math.PI / 2;
    const r = 70 + ((i * 31) % 28);
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  return (
    <a href="/overview.html" className="card card-graph-preview" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <SectionHead eyebrow="Network" title="Your co-author graph" right={<span className="link-btn">Open explorer {Ico.arrow}</span>} />
      {count === 0 ? (
        <div className="muted">No co-authors detected yet.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
          {nodes.map((n, i) => (
            <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="rgba(255,255,255,0.12)" strokeWidth={0.7} />
          ))}
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={5} fill="var(--fg-muted)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
          ))}
          <circle cx={cx} cy={cy} r={10} fill="var(--accent)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        </svg>
      )}
    </a>
  );
}

export function RecentlyIndexed({ data }: { data: DashboardData }) {
  const papers = data.recentPapers || [];
  return (
    <section className="card card-span-2">
      <SectionHead eyebrow="Ledger" title="Recently indexed" right={<a className="link-btn" href="/explore.html">All papers {Ico.arrow}</a>} />
      {papers.length === 0 ? <div className="muted">No papers yet.</div> : (
        <table className="paper-table">
          <thead><tr><th>Title</th><th>Journal</th><th>Published</th><th>Cites</th></tr></thead>
          <tbody>
            {papers.map(p => (
              <tr key={p.doi}>
                <td className="paper-title">{p.title || '(untitled)'}<div className="mono paper-doi">{p.doi}</div></td>
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
