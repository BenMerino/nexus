import type { GraphDirective } from '../architect/graph-composer.types.js';

interface YearSource { year: string; source: string; count: string; }
interface Collab { value: string; count: string; }
interface Country { country: string; count: string; }

export interface TopJournal { value: string; key: string; count: string }
export interface RecentPaper { doi: string; title: string | null; published: string | null; citation_count: number | null; journal: string | null }

interface DashboardData {
  totalPubs: number;
  totalCitations: number;
  oaCount: number;
  authorCount: number;
  yearSource: YearSource[];
  collabs: Collab[];
  countries: Country[];
  topJournals?: TopJournal[];
  recentPapers?: RecentPaper[];
}

function buildYearSourceChart(data: DashboardData): GraphDirective | null {
  const byYear = new Map<string, Map<string, number>>();
  for (const row of data.yearSource) {
    if (!byYear.has(row.year)) byYear.set(row.year, new Map());
    byYear.get(row.year)!.set(row.source, parseInt(row.count));
  }
  const years = [...byYear.keys()].sort();
  if (years.length <= 1) return null;

  return {
    type: 'bar',
    title: 'Publications by Year',
    yLabel: 'Articles',
    data: years.map(year => {
      const sources = byYear.get(year)!;
      let total = 0;
      for (const c of sources.values()) total += c;
      return { label: year, value: total };
    }),
  };
}

function buildCollabChart(data: DashboardData): GraphDirective | null {
  const top = data.collabs.slice(0, 15);
  if (!top.length) return null;
  return {
    type: 'bar',
    title: 'Top Collaborating Institutions',
    yLabel: 'Co-authored Papers',
    data: top.map(c => ({ label: c.value.substring(0, 30), value: parseInt(c.count) })),
  };
}

function buildCountryChart(data: DashboardData): GraphDirective | null {
  if (!data.countries.length) return null;
  return {
    type: 'donut',
    title: 'Publications by Country',
    data: data.countries.slice(0, 12).map(c => ({
      label: c.country, value: parseInt(c.count),
    })),
  };
}

export function buildDashboardCharts(data: DashboardData): GraphDirective[] {
  return [
    buildYearSourceChart(data),
    buildCollabChart(data),
    buildCountryChart(data),
  ].filter((c): c is GraphDirective => c !== null);
}

export type { DashboardData };
