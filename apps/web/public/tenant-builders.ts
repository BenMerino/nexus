import type { GraphDirective } from '../architect/graph-composer.types';
import type { Velocity } from './portfolio-velocity';
import type { Cadence } from './portfolio-cadence';
import { buildYearChart } from './tenant-year-chart';

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
  velocity?: Velocity;
  cadence?: Cadence;
}

function buildTypeChart(stats: PublicStats): GraphDirective | null {
  if (!stats.typeByYear.length) return null;
  const topTypes = stats.types.slice(0, 6).map(t => t.type);
  const typeSet = new Set(topTypes);
  const cells = stats.typeByYear
    .filter(r => typeSet.has(r.type) && r.year)
    .map(r => ({ row: r.type, col: r.year, value: r.count, label: `${r.type} ${r.year}` }));
  if (!cells.length) return null;
  return { type: 'heatmap', title: 'Publicaciones por tipo', xLabel: 'Año', yLabel: 'Tipo', data: cells as any };
}

function buildJournalChart(stats: PublicStats): GraphDirective | null {
  if (!stats.journals.length) return null;
  return {
    type: 'bar',
    title: 'Principales revistas',
    xLabel: 'Revista',
    yLabel: 'Artículos',
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
    title: 'Principales instituciones colaboradoras',
    xLabel: 'Institución',
    yLabel: 'Artículos en colaboración',
    data: top.map(c => ({ label: (c.value || '').substring(0, 30), value: parseInt(c.count) })),
  };
}

function buildCountryChart(stats: PublicStats): GraphDirective | null {
  if (!stats.countries.length) return null;
  return {
    type: 'donut',
    title: 'Publicaciones por país',
    data: stats.countries.slice(0, 12).map(c => ({
      label: c.country, value: parseInt(c.count),
    })),
  };
}

export function buildTenantCharts(stats: PublicStats, tenantId?: number): GraphDirective[] {
  return [
    buildYearChart(stats, tenantId),
    buildTypeChart(stats),
    buildJournalChart(stats),
    buildCollabChart(stats),
    buildCountryChart(stats),
  ].filter((c): c is GraphDirective => c !== null);
}
