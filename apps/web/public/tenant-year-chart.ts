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

export function buildYearChart(stats: PublicStats, tenantId?: number): GraphDirective | null {
  const byYearTotal = new Map<string, number>();
  for (const row of stats.yearSource) byYearTotal.set(row.year, (byYearTotal.get(row.year) || 0) + parseInt(row.count));
  const years = [...byYearTotal.keys()].filter(Boolean).sort();
  if (years.length <= 1) return null;

  // Replay slider attaches to the PLAIN-bar (total) chart, whose atoms carry a
  // flat value. `persistKey` makes the window-toggle selection survive across
  // sessions (controller mirrors it to localStorage), stable per chart+tenant.
  const replay = tenantId != null
    ? { query: { kind: 'publications', tenantId: String(tenantId), windowDays: null as number | null }, toggles: [pubWindowToggle(tenantId)], persistKey: `tenant:${tenantId}:publications` }
    : {};

  const hasIndexData = (stats.yearByIndex || []).some(r => INDEXES.includes(r.bucket));
  if (!hasIndexData) {
    return { type: 'bar', title: 'Publicaciones por año', xLabel: 'Año', yLabel: 'Artículos', ...replay,
      data: years.map(y => ({ label: y, value: byYearTotal.get(y) || 0 })) };
  }

  // Preferred path (Zincro architecture): real time-series. The server emits
  // per-series DAILY atoms with real ISO dates; the engine folds them to years
  // at render time and pairs stacked segments by date, so the legend toggle
  // animates a UNIFORM drop instead of a left-to-right scan. `data` stays empty
  // (atoms are the source of truth); `aggregator: 'sum'` tells the engine how to
  // fold. 'auto' fold over a decade-scale span resolves to year buckets.
  const ia = stats.indexAtoms;
  if (ia && ia.atoms.length > 0 && ia.series.length > 0) {
    return {
      type: 'stacked-bar',
      title: 'Publicaciones por año',
      xLabel: 'Año',
      yLabel: 'Artículos',
      series: ia.series,
      aggregator: 'sum',
      atoms: ia.atoms,
      data: [],
    } as GraphDirective;
  }

  // Fallback (grandfather): year-grouped category rows. Animates as a scan, but
  // only reached when the server didn't supply atoms (older payloads).
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
  return {
    type: 'stacked-bar',
    title: 'Publicaciones por año',
    xLabel: 'Año',
    yLabel: 'Artículos',
    series: presentIndexes,
    data: years.map(y => ({ label: y, ...grid.get(y)! })),
  };
}
