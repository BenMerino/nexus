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

function calculateHIndex(citations: number[]): number {
  const sorted = citations.slice().sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

function buildHIndexChart(records: DoiRecord[]): GraphDirective | null {
  const authorPapers = new Map<string, number[]>();
  for (const r of records) {
    if (!r.authors) continue;
    for (const a of r.authors) {
      if (!authorPapers.has(a)) authorPapers.set(a, []);
      authorPapers.get(a)!.push(r.citation_count || 0);
    }
  }

  const hIndexes = Array.from(authorPapers.entries())
    .map(([name, papers]) => ({ name, h: calculateHIndex(papers) }))
    .filter(a => a.h > 0)
    .sort((a, b) => b.h - a.h)
    .slice(0, 20);

  if (!hIndexes.length) return null;

  return {
    type: 'bar',
    title: 'Author H-Index',
    yLabel: 'H-Index',
    data: hIndexes.map(a => ({
      label: a.name.substring(0, 20),
      value: a.h,
    })),
  };
}

function buildCitationsChart(records: DoiRecord[]): GraphDirective | null {
  const withCitations = records
    .filter(r => r.citation_count > 0)
    .sort((a, b) => b.citation_count - a.citation_count)
    .slice(0, 20);
  if (!withCitations.length) return null;
  return {
    type: 'bar',
    title: 'Citations by Paper',
    yLabel: 'Citations',
    data: withCitations.map(r => ({
      label: (r.title || r.doi).substring(0, 25),
      value: r.citation_count,
    })),
  };
}

function buildTypeChart(records: DoiRecord[]): GraphDirective | null {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.type || 'unknown', (counts.get(r.type || 'unknown') || 0) + 1);
  if (!counts.size) return null;
  return {
    type: 'donut',
    title: 'Papers by Type',
    data: Array.from(counts.entries()).map(([label, value]) => ({ label, value })),
  };
}

function buildJournalChart(records: DoiRecord[]): GraphDirective | null {
  const counts = new Map<string, number>();
  for (const r of records) if (r.journal) counts.set(r.journal, (counts.get(r.journal) || 0) + 1);
  if (!counts.size) return null;
  return {
    type: 'bar',
    title: 'Papers by Journal',
    yLabel: 'Count',
    data: Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([label, value]) => ({ label: label.substring(0, 25), value })),
  };
}

function buildTimelineChart(records: DoiRecord[]): GraphDirective | null {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (!r.published) continue;
    const year = r.published.substring(0, 4);
    if (/^\d{4}$/.test(year)) counts.set(year, (counts.get(year) || 0) + 1);
  }
  if (counts.size <= 1) return null;
  return {
    type: 'line',
    title: 'Publications by Year',
    yLabel: 'Papers',
    data: Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value })),
  };
}

function buildAuthorsChart(records: DoiRecord[]): GraphDirective | null {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.authors) for (const a of r.authors) counts.set(a, (counts.get(a) || 0) + 1);
  }
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 1)
    .slice(0, 15);
  if (!top.length) return null;
  return {
    type: 'bar',
    title: 'Authors with Multiple Papers',
    yLabel: 'Papers',
    data: top.map(([label, value]) => ({ label: label.substring(0, 20), value })),
  };
}

export function buildCharts(records: DoiRecord[]): GraphDirective[] {
  const builders = [
    buildCitationsChart, buildTypeChart, buildJournalChart,
    buildTimelineChart, buildAuthorsChart, buildHIndexChart,
  ];
  return builders.map(fn => fn(records)).filter((c): c is GraphDirective => c !== null);
}

export type { DoiRecord };
