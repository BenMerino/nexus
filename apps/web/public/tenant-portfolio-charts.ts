/* ── Portfolio chart builders ────────────────────────────────
 * Directive builders for the two single-researcher portfolio charts on
 * the public profile (citation velocity, publication cadence). Split from
 * `tenant-builders.ts` (institution-level charts) so each file stays
 * under the size cap and the portfolio-specific status/color mapping
 * lives next to its types.
 * ──────────────────────────────────────────────────────────── */

import type { GraphDirective } from '../architect/graph-composer.types';
import type { Velocity } from './portfolio-velocity';
import type { Cadence } from './portfolio-cadence';
import { typeColor, typeRank } from './type-metals';

// Citation velocity — one continuous line over publication years. Full years
// are `observed` (solid, filled); the still-filling current year is `partial`
// and forecast years are `projected` — the engine's status→style table dashes
// them and drops/hollows their markers, so the tail reads as tentative without
// a second series. `valueLabels` prints each count above its point.
export function buildVelocityChart(v: Velocity, title: string): GraphDirective {
  const hist = v.series.map(p => ({
    label: String(p.year),
    value: p.partial && p.projected != null ? p.projected : p.total,
    status: p.partial ? ('partial' as const) : ('observed' as const),
  }));
  const fc = (v.forecast || []).map(p => ({
    label: String(p.year),
    value: p.total,
    status: 'projected' as const,
  }));
  return {
    type: 'line',
    title,
    xLabel: 'Año',
    yLabel: 'Citas',
    valueLabels: true,
    data: [...hist, ...fc] as any,
  };
}

// Publication cadence — stacked bar by work type per year. Colors bind to the
// type IDENTITY via `seriesColorMap` (so 'Artículo' is always gold regardless
// of stack position); `series`/`legendOrder` sort by the metal rank; the mean
// line rides in as a threshold. Each point also carries a flat `value` = year
// total so the engine's single-series value label prints the stack total.
export function buildCadenceChart(c: Cadence, title: string, typeLabel: (t: string) => string): GraphDirective {
  const ordered = [...c.types].sort((a, b) => typeRank(a) - typeRank(b));
  const data = c.series.map(p => {
    const row: Record<string, string | number> = { label: String(p.year), value: p.count };
    for (const seg of p.segments) row[seg.type] = seg.count;
    return row;
  });
  return {
    type: 'stacked-bar',
    title,
    xLabel: 'Año',
    yLabel: 'Artículos',
    series: ordered,
    legendOrder: ordered,
    legendLabels: Object.fromEntries(ordered.map(t => [t, typeLabel(t)])),
    colorScheme: {
      sentiment: 'neutral',
      primary: typeColor(ordered[0] || 'unknown'),
      fill: typeColor(ordered[0] || 'unknown'),
      seriesColorMap: Object.fromEntries(ordered.map(t => [t, typeColor(t)])),
    },
    thresholds: [{ value: c.meanPerYear, label: c.meanPerYear.toFixed(1), color: 'var(--fg-dim)' }],
    valueLabels: true,
    data: data as any,
  };
}
