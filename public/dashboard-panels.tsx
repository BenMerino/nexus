import React from 'react';
import { Tag, SectionHead } from './ui-primitives';
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

export function sourceBreakdown(data: DashboardData): { source: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of data.yearSource) {
    const s = r.source || 'Other';
    m.set(s, (m.get(s) || 0) + parseInt(r.count));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count }));
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

export function RankedInstitutions({ data }: { data: DashboardData }) {
  const top = data.collabs.slice(0, 8);
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

export function RankedCountries({ data }: { data: DashboardData }) {
  const top = data.countries.slice(0, 8);
  return (
    <section className="card">
      <SectionHead eyebrow="Reach" title="Top countries" />
      <ul className="ranked-list">
        {top.length === 0 && <li className="empty">No country data yet.</li>}
        {top.map((c, i) => (
          <li key={i}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="rank-label"><span className="rank-title">{c.country}</span></span>
            <span className="rank-count">{c.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourceList({ sources }: { sources: { source: string; count: number }[] }) {
  return (
    <section className="card card-span-2">
      <SectionHead eyebrow="Ingestion" title="By source index" />
      <ul className="ranked-list">
        {sources.map((s, i) => (
          <li key={s.source}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="rank-label"><span className="rank-title">{s.source}</span></span>
            <span className="rank-count">{s.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
