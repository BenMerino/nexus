import type { GraphDirective } from '../architect/graph-composer.types.js';

export interface YearSourceRow { year: string; source: string; count: string; }
export interface CollabRow { value: string; count: string; }
export interface CountryRow { country: string; count: string; }
export interface TypeRow { type: string; count: number; }
export interface JournalRow { journal: string; count: number; }
export interface SourceRow { source: string; count: number; }
export interface TypeYearRow { type: string; year: string; count: number; }
export interface YearIndexRow { year: string; bucket: string; count: number; }

export interface PublicStats {
  summary: { totalPubs: number; totalCitations: number; oaCount: number; authorCount: number };
  yearSource: YearSourceRow[];
  collabs: CollabRow[];
  countries: CountryRow[];
  types: TypeRow[];
  journals: JournalRow[];
  yearRange: { minYear: string | null; maxYear: string | null };
  bySource: SourceRow[];
  typeByYear: TypeYearRow[];
  yearByIndex: YearIndexRow[];
}

const INDEX_STACK = ['WoS', 'Scopus', 'SciELO', 'Other'];

function buildYearChart(stats: PublicStats): GraphDirective | null {
  const rows = stats.yearByIndex && stats.yearByIndex.length ? stats.yearByIndex : null;
  if (!rows) {
    const byYear = new Map<string, number>();
    for (const row of stats.yearSource) byYear.set(row.year, (byYear.get(row.year) || 0) + parseInt(row.count));
    const years = [...byYear.keys()].filter(Boolean).sort();
    if (years.length <= 1) return null;
    return { type: 'bar', title: 'Publications by Year', yLabel: 'Articles',
      data: years.map(y => ({ label: y, value: byYear.get(y) || 0 })) };
  }
  const grid = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!r.year) continue;
    if (!grid.has(r.year)) grid.set(r.year, { WoS: 0, Scopus: 0, SciELO: 0, Other: 0 });
    grid.get(r.year)![r.bucket] = (grid.get(r.year)![r.bucket] || 0) + r.count;
  }
  const years = [...grid.keys()].sort();
  if (years.length <= 1) return null;
  return {
    type: 'stacked-bar',
    title: 'Publications by Year',
    yLabel: 'Articles',
    series: INDEX_STACK,
    data: years.map(y => ({ label: y, ...grid.get(y)! })),
  };
}

function buildTypeChart(stats: PublicStats): GraphDirective | null {
  if (!stats.typeByYear.length) return null;
  const topTypes = stats.types.slice(0, 6).map(t => t.type);
  const typeSet = new Set(topTypes);
  const cells = stats.typeByYear
    .filter(r => typeSet.has(r.type) && r.year)
    .map(r => ({ row: r.type, col: r.year, value: r.count, label: `${r.type} ${r.year}` }));
  if (!cells.length) return null;
  return { type: 'heatmap', title: 'Publications by Type', data: cells as any };
}

function buildJournalChart(stats: PublicStats): GraphDirective | null {
  if (!stats.journals.length) return null;
  return {
    type: 'bar',
    title: 'Top Journals',
    yLabel: 'Papers',
    data: stats.journals.map(j => ({
      label: (j.journal || '').substring(0, 18),
      value: j.count,
    })),
  };
}

function buildSourceChart(stats: PublicStats): GraphDirective | null {
  if (!stats.bySource.length) return null;
  return {
    type: 'bar',
    title: 'Publications by Source',
    yLabel: 'Papers',
    data: stats.bySource.map(s => ({ label: s.source, value: s.count })),
  };
}

function buildCollabChart(stats: PublicStats): GraphDirective | null {
  const top = stats.collabs.slice(0, 15);
  if (!top.length) return null;
  return {
    type: 'bar',
    title: 'Top Collaborating Institutions',
    yLabel: 'Co-authored Papers',
    data: top.map(c => ({ label: (c.value || '').substring(0, 30), value: parseInt(c.count) })),
  };
}

function buildCountryChart(stats: PublicStats): GraphDirective | null {
  if (!stats.countries.length) return null;
  return {
    type: 'donut',
    title: 'Publications by Country',
    data: stats.countries.slice(0, 12).map(c => ({
      label: c.country, value: parseInt(c.count),
    })),
  };
}

export function buildTenantCharts(stats: PublicStats): GraphDirective[] {
  return [
    buildYearChart(stats),
    buildSourceChart(stats),
    buildTypeChart(stats),
    buildJournalChart(stats),
    buildCollabChart(stats),
    buildCountryChart(stats),
  ].filter((c): c is GraphDirective => c !== null);
}
