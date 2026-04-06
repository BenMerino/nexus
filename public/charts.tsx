import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphRender } from '../graph-engine/index.js';
import type { GraphDirective } from '../architect/graph-composer.types.js';

interface DoiRecord {
  doi: string;
  title: string;
  authors: string[];
  journal: string;
  citation_count: number;
  type: string;
  published: string;
}

function App() {
  const [records, setRecords] = useState<DoiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(data => { setRecords(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!records.length) return <div>No records. Submit some DOIs first.</div>;

  const charts = buildCharts(records);

  return (
    <div>
      {charts.map((chart, i) => (
        <div key={i} style={{ marginBottom: '1rem' }}>
          <GraphRender chart={chart} />
        </div>
      ))}
    </div>
  );
}

function buildCharts(records: DoiRecord[]): GraphDirective[] {
  const charts: GraphDirective[] = [];

  // 1. Citations bar chart (top 20)
  const withCitations = records
    .filter(r => r.citation_count > 0)
    .sort((a, b) => b.citation_count - a.citation_count)
    .slice(0, 20);
  if (withCitations.length > 0) {
    charts.push({
      type: 'bar',
      title: 'Citations by Paper',
      yLabel: 'Citations',
      data: withCitations.map(r => ({
        label: (r.title || r.doi).substring(0, 25),
        value: r.citation_count,
      })),
    });
  }

  // 2. Papers by type (pie)
  const typeCounts = new Map<string, number>();
  for (const r of records) {
    const t = r.type || 'unknown';
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  }
  if (typeCounts.size > 0) {
    charts.push({
      type: 'donut',
      title: 'Papers by Type',
      data: Array.from(typeCounts.entries()).map(([label, value]) => ({ label, value })),
    });
  }

  // 3. Papers by journal (bar)
  const journalCounts = new Map<string, number>();
  for (const r of records) {
    if (r.journal) journalCounts.set(r.journal, (journalCounts.get(r.journal) || 0) + 1);
  }
  if (journalCounts.size > 0) {
    charts.push({
      type: 'bar',
      title: 'Papers by Journal',
      yLabel: 'Count',
      data: Array.from(journalCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([label, value]) => ({ label: label.substring(0, 25), value })),
    });
  }

  // 4. Publications timeline (bar by year)
  const yearCounts = new Map<string, number>();
  for (const r of records) {
    if (r.published) {
      const year = r.published.substring(0, 4);
      if (/^\d{4}$/.test(year)) yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  }
  if (yearCounts.size > 1) {
    charts.push({
      type: 'line',
      title: 'Publications by Year',
      yLabel: 'Papers',
      data: Array.from(yearCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({ label, value })),
    });
  }

  // 5. Top authors (bar)
  const authorCounts = new Map<string, number>();
  for (const r of records) {
    if (r.authors) {
      for (const a of r.authors) {
        authorCounts.set(a, (authorCounts.get(a) || 0) + 1);
      }
    }
  }
  const topAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 1)
    .slice(0, 15);
  if (topAuthors.length > 0) {
    charts.push({
      type: 'bar',
      title: 'Authors with Multiple Papers',
      yLabel: 'Papers',
      data: topAuthors.map(([label, value]) => ({ label: label.substring(0, 20), value })),
    });
  }

  return charts;
}

const root = createRoot(document.getElementById('chart-root')!);
root.render(<App />);
