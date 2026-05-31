/**
 * Atom-projection helper for `GraphRender`. Given a chart directive
 * with `atoms` populated, derive the visible-window bucket data,
 * placements, and `__yMax` for the current `windowDays`/`asOf`. This
 * is the foundation-correct path — atoms are primary; buckets are
 * visual envelopes derived from them.
 *
 * Extracted from `GraphRender.tsx` so the orchestrator file stays
 * under the line ceiling.
 */

import {
    foldByCalendar,
    pickAutoFoldUnit,
    HOURS_PER_DAY,
    type FoldUnit,
} from '../../architect/fold-atoms.js';
import { foldByCalendarGrid, pickAutoUnitPair } from '../../architect/fold-atoms-grid.js';
import { placeAtoms, bucketTops } from '../../architect/place-atoms.js';
import type { GraphDirective, ChartData, GraphQuery } from '../../architect/graph-composer.types.js';
import { maxLookbackForDirective } from './graph-features/index.js';

/** ISO YYYY-MM-DD → whole-day count between that date and today (UTC).
 *  Returns 0 when ISO is today or in the future. */
export function daysBeforeToday(iso: string): number {
    const todayMs = Date.parse(`${new Date().toISOString().split('T')[0]}T00:00:00Z`);
    const isoMs = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isFinite(todayMs) || !Number.isFinite(isoMs)) return 0;
    return Math.max(0, Math.round((todayMs - isoMs) / 86_400_000));
}

export interface ResolveExtras {
    activeSet: Set<string>;
    seriesWeights: Map<string, number>;
    colorClip: { lower: number; upper: number };
}

/** Build the runtime-resolved directive (atoms-clipped to window,
 *  buckets folded, placements computed, yMax derived). Returns the
 *  input directive with client-runtime fields populated. */
export function resolveAtomicDirective(
    chart: GraphDirective,
    extras: ResolveExtras,
): GraphDirective {
    const { activeSet, seriesWeights, colorClip } = extras;
    if (!chart.atoms || chart.atoms.length === 0) {
        return { ...chart, activeSeries: activeSet, seriesWeights, colorClip };
    }
    const q = chart.query as GraphQuery | undefined;
    const windowDays = q?.windowDays;
    const asOfDaysBefore = q?.asOf ? daysBeforeToday(q.asOf) : 0;
    /* Atom keys are hours-since-anchor. Slider's user-facing
     *  `windowDays` is in days — convert to atom-key axis once here. */
    const firstKey = chart.atoms[0].key;
    const lastKey = chart.atoms[chart.atoms.length - 1].key;
    /* `windowEndKey` is the END of the last visible day in atom-key
     *  (hour) space — hour 23, not hour 0. Daily atoms sit at hour 0
     *  of each day, so the end of that day is `key + HOURS_PER_DAY - 1`. */
    const lastDayEndKey = lastKey + HOURS_PER_DAY - 1;
    const windowEndKey = lastDayEndKey - asOfDaysBefore * HOURS_PER_DAY;
    const totalDays = (lastKey - firstKey + 1) / HOURS_PER_DAY;
    const visibleDays = windowDays ?? totalDays;
    const windowStartKey = windowEndKey - visibleDays * HOURS_PER_DAY + 1;
    /* Does any atom carry sub-day data? Drives whether 'hour' is in
     *  the fold ladder. Daily-only atoms never reach the hour rung. */
    const hasHourly = chart.atoms.some(a => typeof a.hour === 'number' && a.hour > 0);

    // Heatmap takes the 2D fold path; every other family folds 1D.
    if (chart.type === 'heatmap') {
        const [rowUnit, colUnit] = pickAutoUnitPair(visibleDays, hasHourly);
        const windowedAtoms = chart.atoms.filter(a => a.key >= windowStartKey && a.key <= windowEndKey);
        const cells = foldByCalendarGrid(windowedAtoms, rowUnit, colUnit, chart.aggregator ?? 'sum', chart.series ?? []);
        const { atoms: _atoms, ...rest } = chart;
        void _atoms;
        return {
            ...rest,
            data: cells.map(c => ({
                row: c.row, col: c.col, value: c.value,
                __startKey: c.startKey, __endKey: c.endKey,
            })) as ChartData,
            activeSeries: activeSet, seriesWeights, colorClip,
            __foldUnit: colUnit,
        } as GraphDirective;
    }

    const foldUnit: FoldUnit = q?.foldUnit ?? 'auto';
    const resolvedUnit = foldUnit === 'auto' ? pickAutoFoldUnit(visibleDays, hasHourly) : foldUnit;
    const buckets = foldByCalendar(chart.atoms, resolvedUnit, chart.aggregator ?? 'sum', chart.series ?? []);
    /* Edge anchoring: leftmost visible bucket pins its center to x=0,
     *  rightmost to x=1. Interior buckets place at their true midpoint.
     *  Without this, a partially-clipped bucket's center slides through
     *  the plot as the slider drags. */
    const winSpan = (windowEndKey - windowStartKey) || 1;
    const overlapping = buckets.filter(b => b.endKey >= windowStartKey && b.startKey <= windowEndKey);
    const data = overlapping.map((b, i) => {
        const rawStart = (b.startKey - windowStartKey) / winSpan;
        const rawEnd = (b.endKey + 1 - windowStartKey) / winSpan;
        const xStart = Math.max(0, Math.min(1, rawStart));
        const xEnd = Math.max(0, Math.min(1, rawEnd));
        const isFirst = i === 0;
        const isLast = i === overlapping.length - 1;
        const xCenter = isFirst ? xStart
            : isLast ? xEnd
            : (xStart + xEnd) / 2;
        const out: Record<string, unknown> = {
            label: b.label,
            value: b.value,
            __x: xCenter,
            __xStart: xStart,
            __xEnd: xEnd,
            __startISO: b.startISO,
            __endISO: b.endISO,
            /* Folded semantic status + presence — bar/curve families read
             *  these for status→style (dash/marker/rect) and gaps. */
            __status: b.status,
            __defined: b.defined,
        };
        for (const s of (chart.series ?? [])) out[s] = b[s];
        return out;
    }) as ChartData;
    /* Bucket-clip atoms: include EVERY atom belonging to any bucket
     *  that overlaps the window, even if that atom's own key sits
     *  outside the window. This makes edge buckets render at their
     *  TRUE value (Σ of all their atoms) rather than the truncated
     *  in-window sum — the visible curve no longer ramps up/down at
     *  the chart edge as the window crosses a partial bucket.
     *
     *  Since `overlapping` is the contiguous run of buckets that
     *  intersect the window, the union of their `[startKey, endKey]`
     *  ranges is just `[firstOverlap.startKey, lastOverlap.endKey]`.
     *  Filtering atoms by that interval pulls in the edge buckets'
     *  out-of-window atoms without touching wholly-out-of-window ones.
     *  The visible plot still clips at the window — only the bucket's
     *  height value changes, not its geometric extent. */
    const bucketRangeStart = overlapping.length > 0 ? overlapping[0].startKey : windowStartKey;
    const bucketRangeEnd = overlapping.length > 0 ? overlapping[overlapping.length - 1].endKey : windowEndKey;
    const windowedAtoms = chart.atoms.filter(a => a.key >= bucketRangeStart && a.key <= bucketRangeEnd);
    /* Anchor MUST be `chart.atoms[0].iso` — the ORIGINAL timeline
     *  anchor that atom keys are measured from. Using a windowed atom's
     *  iso would mix two time origins (atom.key is hours since the
     *  original anchor). Symptom of that bug: atoms within the same
     *  week land in TWO different `bucketKey`s, visually splitting each
     *  week into two polygons. */
    const anchorISO = chart.atoms[0].iso;
    const placements = placeAtoms(windowedAtoms, {
        foldUnit: resolvedUnit,
        windowStartKey, windowEndKey,
        anchorISO,
    });
    /* Y-domain max: tallest per-bucket sum at this fold. Stacked families
     *  (stacked-bar, stacked-area) reach Σ_series per bucket, so we pass
     *  the series list to `bucketTops`. Non-stacked families read
     *  `atom.value` (legacy behaviour). Multi-line is intentionally NOT
     *  stacked here — its yMax is per-series-max, computed downstream
     *  from `allVals` flattening in `chart-primitives-cartesian.ts`. */
    const isStacked = chart.type === 'stacked-area' || chart.type === 'stacked-bar';
    const stackSeries = isStacked ? (chart.series ?? []) : [];
    const tops = bucketTops(windowedAtoms, placements, stackSeries);
    let yMax = 0;
    for (const v of tops.values()) if (v > yMax) yMax = v;
    /* Off-window curve neighbors. Curve families (line, area, etc.)
     *  prepend/append these to their sampled point arrays so smoothed
     *  lines don't terminate with a sharp cut at the plot edges. When
     *  a real neighbor bucket exists in the full timeline (the bucket
     *  immediately before the leftmost visible one, or immediately
     *  after the rightmost), use its true value. When the window is at
     *  the timeline boundary (no earlier / no later data exists), fall
     *  back to linear extrapolation from the two visible edge points
     *  — done lazily inside the family because it needs the visible
     *  points' ys, which are layout-dependent. The composer just
     *  signals "no real neighbor here" via `value: NaN` so the family
     *  knows to extrapolate. */
    const firstVisibleIdx = buckets.findIndex(b => b.endKey >= windowStartKey && b.startKey <= windowEndKey);
    const lastVisibleIdx = (() => {
        for (let i = buckets.length - 1; i >= 0; i--) {
            if (buckets[i].endKey >= windowStartKey && buckets[i].startKey <= windowEndKey) return i;
        }
        return -1;
    })();
    const seriesList = chart.series ?? [];
    const neighborFor = (b: typeof buckets[number]): {
        xCenter: number; value: number;
        seriesValues?: Record<string, number>; isExtrapolated: boolean;
    } => {
        const xStart = (b.startKey - windowStartKey) / winSpan;
        const xEnd = (b.endKey + 1 - windowStartKey) / winSpan;
        const sv: Record<string, number> = {};
        for (const s of seriesList) {
            const v = (b as Record<string, unknown>)[s];
            if (typeof v === 'number') sv[s] = v;
        }
        return {
            xCenter: (xStart + xEnd) / 2,
            value: b.value,
            seriesValues: seriesList.length > 0 ? sv : undefined,
            isExtrapolated: false,
        };
    };
    const edgeNeighbors: GraphDirective['__edgeNeighbors'] = {};
    if (firstVisibleIdx > 0) {
        edgeNeighbors.left = neighborFor(buckets[firstVisibleIdx - 1]);
    } else if (firstVisibleIdx === 0 && overlapping.length >= 2) {
        /* No real neighbor — flag for in-family extrapolation. xCenter
         *  is one bucket-width to the left of the leftmost visible
         *  bucket. value=0 here is a placeholder; the family replaces
         *  it with the extrapolated y. */
        const lead = overlapping[0];
        const leadXStart = Math.max(0, (lead.startKey - windowStartKey) / winSpan);
        const leadXEnd = Math.min(1, (lead.endKey + 1 - windowStartKey) / winSpan);
        const leadW = leadXEnd - leadXStart;
        edgeNeighbors.left = {
            xCenter: leadXStart - leadW / 2,
            value: 0,
            seriesValues: seriesList.length > 0 ? Object.fromEntries(seriesList.map(s => [s, 0])) : undefined,
            isExtrapolated: true,
        };
    }
    if (lastVisibleIdx >= 0 && lastVisibleIdx < buckets.length - 1) {
        edgeNeighbors.right = neighborFor(buckets[lastVisibleIdx + 1]);
    } else if (lastVisibleIdx === buckets.length - 1 && overlapping.length >= 2) {
        const trail = overlapping[overlapping.length - 1];
        const trailXStart = Math.max(0, (trail.startKey - windowStartKey) / winSpan);
        const trailXEnd = Math.min(1, (trail.endKey + 1 - windowStartKey) / winSpan);
        const trailW = trailXEnd - trailXStart;
        edgeNeighbors.right = {
            xCenter: trailXEnd + trailW / 2,
            value: 0,
            seriesValues: seriesList.length > 0 ? Object.fromEntries(seriesList.map(s => [s, 0])) : undefined,
            isExtrapolated: true,
        };
    }
    /* Lookback support for features that need pre-window context (e.g.
     *  moving average filling its leading window cleanly at x=0). We
     *  ask the dispatcher how many prior buckets the active features
     *  need; zero means skip the slice entirely. Bucket entries are
     *  the same shape feature resolvers consume from `data`, minus the
     *  positional fields (prior buckets are not rendered, only summed). */
    const lookback = maxLookbackForDirective(chart);
    let priorBuckets: ChartData | undefined;
    if (lookback > 0) {
        const before = buckets.filter(b => b.endKey < windowStartKey);
        const slice = before.slice(Math.max(0, before.length - lookback));
        priorBuckets = slice.map(b => {
            const out: Record<string, unknown> = {
                label: b.label,
                value: b.value,
                __startISO: b.startISO,
                __endISO: b.endISO,
            };
            for (const s of (chart.series ?? [])) out[s] = b[s];
            return out;
        }) as ChartData;
    }
    return {
        ...chart,
        atoms: windowedAtoms,
        data,
        activeSeries: activeSet,
        seriesWeights,
        colorClip,
        __foldUnit: resolvedUnit,
        __placements: placements,
        __yMax: yMax,
        __priorBuckets: priorBuckets,
        __edgeNeighbors: (edgeNeighbors.left || edgeNeighbors.right) ? edgeNeighbors : undefined,
    } as GraphDirective;
}
