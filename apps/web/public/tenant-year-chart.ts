import type { GraphDirective } from '../architect/graph-composer.types';
import type { PublicStats } from './tenant-builders';

/* The "Publicaciones por año" chart — extracted from tenant-builders to keep
 * each file under the N5 line cap (its index/atom logic is the largest concern).
 *
 * Two shapes:
 *  - plain total bar (no index data): the replayable timeline (slider).
 *  - stacked-bar by index (WoS/Scopus/SciELO/DOAJ): prefers the Zincro-style
 *    per-series DAILY atoms (real ISO per day) so the legend toggle animates a
 *    uniform drop; falls back to year-grouped category rows for older payloads. */

const INDEXES = ['WoS', 'Scopus', 'SciELO', 'DOAJ'];

// Window toggle positions for the publications timeline. windowDays is the
// engine's unit; academic output is decade-scale, so offer year-equivalents.
function pubWindowToggle(_tenantId: number) {
  return {
    id: 'windowDays',
    field: 'windowDays' as const,
    valueType: 'numberOrNull' as const,
    current: 'null',
    options: [
      { value: '1825', label: '5y' },
      { value: '3650', label: '10y' },
      { value: '7305', label: '20y' },
      { value: 'null', label: 'All' },
    ],
  };
}

/** True when the tenant has indexation data — the page then renders the
 *  SERVER-COMPOSED stacked "Publicaciones por año" (publications.byIndex) via
 *  RecomposeChart, NOT a client-built chart. */
export function hasYearIndex(stats: PublicStats): boolean {
  return (stats.yearByIndex || []).some(r => INDEXES.includes(r.bucket));
}

/** The PLAIN-bar total timeline — built client-side ONLY when there is no
 *  indexation breakdown (so nothing to stack/toggle, no scan risk). When index
 *  data exists this returns null and the page uses the composed stacked chart. */
export function buildYearChart(stats: PublicStats, tenantId?: number): GraphDirective | null {
  if (hasYearIndex(stats)) return null;

  const byYearTotal = new Map<string, number>();
  for (const row of stats.yearSource) byYearTotal.set(row.year, (byYearTotal.get(row.year) || 0) + parseInt(row.count));
  const years = [...byYearTotal.keys()].filter(Boolean).sort();
  if (years.length <= 1) return null;

  // Replay slider on the total timeline. `persistKey` survives across sessions.
  const replay = tenantId != null
    ? { query: { kind: 'publications', tenantId: String(tenantId), windowDays: null as number | null }, toggles: [pubWindowToggle(tenantId)], persistKey: `tenant:${tenantId}:publications` }
    : {};
  return { type: 'bar', title: 'Publicaciones por año', xLabel: 'Año', yLabel: 'Artículos', ...replay,
    data: years.map(y => ({ label: y, value: byYearTotal.get(y) || 0 })) };
}
