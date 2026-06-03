import type { GraphDirective } from '../architect/graph-composer.types';
import type { Velocity } from './portfolio-velocity';
import type { Cadence } from './portfolio-cadence';
import { buildYearChart } from './tenant-year-chart';

export interface YearSourceRow { year: string; source: string; count: string; }
export interface YearIndexRow { year: string; bucket: string; count: number; }

export interface PublicStats {
  summary: { totalPubs: number; totalCitations: number; oaCount: number; authorCount: number };
  yearSource: YearSourceRow[];
  yearRange: { minYear: string | null; maxYear: string | null };
  yearByIndex: YearIndexRow[];
  velocity?: Velocity;
  cadence?: Cadence;
  // journals/collabs/countries/types/typeByYear removed — those charts are
  // server-COMPOSED catalog kinds (publications.topJournals/.collaborators/
  // .countries/.typeByYear), rendered via <RecomposeChart>. yearSource +
  // yearByIndex remain only for buildYearChart's no-index plain-bar fallback
  // (which carries replay-slider plumbing, not just data).
}

// All categorical charts are now server-COMPOSED catalog kinds. The only
// client builder left is buildYearChart — the no-index plain-bar fallback,
// which seeds a replay-slider directive (query/toggles), not a static data
// shape; its interactive data flows through the `publications` catalog kind.
export function buildTenantCharts(stats: PublicStats, tenantId?: number): GraphDirective[] {
  return [buildYearChart(stats, tenantId)].filter((c): c is GraphDirective => c !== null);
}
