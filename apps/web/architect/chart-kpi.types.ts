/**
 * KPI headline types for `GraphDirective.kpi` — extracted from
 * `graph-composer.types.ts` to keep it under the line ceiling.
 *
 * A KPI headline renders ABOVE the chart: a large figure with an
 * uppercase caption and an optional rising/flat/falling trend chip.
 * Off by default. Two governed sources, split on the authoritative-vs-
 * cosmetic line:
 *
 *   • `reduce` — a COSMETIC reduction of the plotted series (mean/sum/
 *     slope/…). The engine derives the figure from the chart's own
 *     `__buckets` in `resolveAtomicDirective`, so it recomputes on
 *     window/fold and can never drift from what's on screen. Use for
 *     view-local headlines ("avg/year", "total visible").
 *   • `figure` — an AUTHORITATIVE value the composer owns server-side
 *     (a "score", a booked revenue total). Pre-formatted, presented
 *     as-is; never re-derived client-side.
 *
 * `trend.auto` classifies the reduction's slope into rising/flat/
 * falling (cosmetic path only). `trend` literal sets it explicitly.
 */

import type { ReductionKind } from '../ui/graph-engine/reduction.js';

export interface GraphKpi {
    /** Short uppercase caption under the figure, e.g. "score". */
    caption: string;
    /** Cosmetic path: which reduction of the plotted series to surface. */
    reduce?: ReductionKind;
    /** Authoritative path: composer-owned pre-formatted value. */
    figure?: string;
    /** Trend chip. `'auto'` derives direction from the reduction's
     *  slope (cosmetic path); a literal sets it explicitly. */
    trend?: 'auto' | { direction: 'rising' | 'flat' | 'falling'; label: string };
}
