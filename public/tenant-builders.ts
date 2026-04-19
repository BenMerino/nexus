import type { GraphDirective } from '../architect/graph-composer.types.js';

export interface YearSourceRow { year: string; source: string; count: string; }
export interface CollabRow { value: string; count: string; }
export interface CountryRow { country: string; count: string; }
export interface TypeRow { type: string; count: number; }
export interface JournalRow { journal: string; count: number; }

export interface PublicStats {
  summary: { totalPubs: number; totalCitations: number; oaCount: number; authorCount: number };
  yearSource: YearSourceRow[];
  collabs: CollabRow[];
  countries: CountryRow[];
  types: TypeRow[];
  journals: JournalRow[];
  yearRange: { minYear: string | null; maxYear: string | null };
}

function buildYearChart(stats: PublicStats): GraphDirective | null {
  const byYear = new Map<string, number>();
  for (const row of stats.yearSource) {
    byYear.set(row.year, (byYear.get(row.year) || 0) + parseInt(row.count));
  }
  const years = [...byYear.keys()].filter(Boolean).sort();
  if (years.length <= 1) return null;
  return {
    type: 'bar',
    title: 'Publications by Year',
    yLabel: 'Articles',
    data: years.map(y => ({ label: y, value: byYear.get(y) || 0 })),
  };
}

function buildTypeChart(stats: PublicStats): GraphDirective | null {
  if (!stats.types.length) return null;
  return {
    type: 'donut',
    title: 'Publications by Type',
    data: stats.types.slice(0, 8).map(t => ({ label: t.type, value: t.count })),
  };
}

function buildJournalChart(stats: PublicStats): GraphDirective | null {
  if (!stats.journals.length) return null;
  return {
    type: 'bar',
    title: 'Top Journals',
    yLabel: 'Papers',
    data: stats.journals.map(j => ({
      label: (j.journal || '').substring(0, 30),
      value: j.count,
    })),
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
    buildTypeChart(stats),
    buildJournalChart(stats),
    buildCollabChart(stats),
    buildCountryChart(stats),
  ].filter((c): c is GraphDirective => c !== null);
}
