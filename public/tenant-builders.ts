import type { GraphDirective } from '../architect/graph-composer.types.js';

export interface YearSourceRow { year: string; source: string; count: string; }
export interface CollabRow { value: string; count: string; }
export interface CountryRow { country: string; count: string; }
export interface TypeRow { type: string; count: number; }
export interface JournalRow { journal: string; count: number; }
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
  typeByYear: TypeYearRow[];
  yearByIndex: YearIndexRow[];
}

const INDEXES = ['WoS', 'Scopus', 'SciELO', 'DOAJ'];
const INDEX_COLOR: Record<string, string> = {
  WoS: 'var(--secondary)',
  Scopus: 'var(--primary)',
  SciELO: 'var(--journal)',
  DOAJ: 'var(--ok)',
};

function buildYearChart(stats: PublicStats): GraphDirective | null {
  const byYearTotal = new Map<string, number>();
  for (const row of stats.yearSource) byYearTotal.set(row.year, (byYearTotal.get(row.year) || 0) + parseInt(row.count));
  const years = [...byYearTotal.keys()].filter(Boolean).sort();
  if (years.length <= 1) return null;

  const hasIndexData = (stats.yearByIndex || []).some(r => INDEXES.includes(r.bucket));
  if (!hasIndexData) {
    return { type: 'bar', title: 'Publications by Year', yLabel: 'Articles',
      data: years.map(y => ({ label: y, value: byYearTotal.get(y) || 0 })) };
  }

  const presentIndexes = INDEXES.filter(k =>
    (stats.yearByIndex || []).some(r => r.bucket === k && r.count > 0));

  const grid = new Map<string, Record<string, number>>();
  for (const y of years) {
    const z: Record<string, number> = {};
    for (const k of presentIndexes) z[k] = 0;
    grid.set(y, z);
  }
  for (const r of stats.yearByIndex) {
    if (!r.year || !grid.has(r.year)) continue;
    if (!presentIndexes.includes(r.bucket)) continue;
    grid.get(r.year)![r.bucket] += r.count;
  }
  const seriesColors = presentIndexes.map(k => INDEX_COLOR[k]);
  return {
    type: 'stacked-bar',
    title: 'Publications by Year',
    yLabel: 'Articles',
    series: presentIndexes,
    data: years.map(y => ({ label: y, ...grid.get(y)! })),
    colorScheme: { sentiment: 'neutral', primary: seriesColors[0], fill: seriesColors[0], seriesColors },
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
