import type { GraphDirective } from '../architect/graph-composer.types';
import type { Velocity } from './portfolio-velocity';
import type { Cadence } from './portfolio-cadence';
import { buildYearChart } from './tenant-year-chart';

export interface YearSourceRow { year: string; source: string; count: string; }
export interface TypeRow { type: string; count: number; }
export interface TypeYearRow { type: string; year: string; count: number; }
export interface YearIndexRow { year: string; bucket: string; count: number; }

export interface PublicStats {
  summary: { totalPubs: number; totalCitations: number; oaCount: number; authorCount: number };
  yearSource: YearSourceRow[];
  types: TypeRow[];
  yearRange: { minYear: string | null; maxYear: string | null };
  typeByYear: TypeYearRow[];
  yearByIndex: YearIndexRow[];
  velocity?: Velocity;
  cadence?: Cadence;
  // journals/collabs/countries removed — those charts are server-COMPOSED
  // catalog kinds (publications.topJournals/.collaborators/.countries),
  // rendered via <RecomposeChart>; the client no longer holds their data.
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

// journal / collaborator / country charts are no longer shaped here — they are
// SERVER-COMPOSED catalog kinds (publications.topJournals / .collaborators /
// .countries) rendered via <RecomposeChart> in tenant-charts-tab. The client
// no longer builds their GraphDirective.data.

export function buildTenantCharts(stats: PublicStats, tenantId?: number): GraphDirective[] {
  return [
    buildYearChart(stats, tenantId),
    buildTypeChart(stats),
  ].filter((c): c is GraphDirective => c !== null);
}
