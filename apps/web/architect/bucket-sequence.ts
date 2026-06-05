/* ── Canonical Bucket Sequence ───────────────────────────────
 * ONE complete, index-stable bucket sequence for the visible window —
 * the single source every cartesian consumer reads (chrome labels, bar
 * geometry, curve points). Wraps `bucketAggregates` (which emits one
 * bucket per NON-EMPTY calendar unit) and splices in EMPTY buckets for
 * calendar units that contain no atoms, so the sequence matches
 * `foldByCalendar`'s empties-included view.
 *
 * Why this exists: `foldByCalendar` (→ `chart.data` + chrome) and
 * `bucketAggregates` (→ curve/bar geometry) were two independent
 * derivations of the same atoms that DISAGREED on empty buckets — on
 * sparse data their indices desynced, misaligning marks with axis
 * labels and leaving the bar animation without stable identity. This
 * collapses them into one sequence: every entry carries a stable
 * `bucketKey` (defined even for empties, which no atom-key could be),
 * `startISO`/`endISO`, and window-normalized `xStart/xEnd/xCenter`.
 *
 * `bucketAggregates`, `placeAtoms`, and `foldByCalendar` are unchanged.
 * ──────────────────────────────────────────────────────────── */

import type { Atom, FoldUnit } from './fold-atoms.js';
import { HOURS_PER_DAY } from './fold-atoms.js';
import { alignToUnitStart, stepByUnit } from './fold-atoms-calendar.js';
import {
    bucketAggregates,
    type AtomPlacement,
    type BucketAggregate,
} from './place-atoms.js';

const HOUR_MS = 3_600_000;

export interface BucketSequenceOptions {
    foldUnit: Exclude<FoldUnit, 'auto'>;
    /** Window edges in atom-key (hour) space — for xStart/xEnd normalization. */
    windowStartKey: number;
    windowEndKey: number;
    /** Original timeline anchor — `chart.atoms[0].iso`. Atom keys are
     *  hours since this date, so bucket calendar math must use it. */
    anchorISO: string;
    seriesKeys?: ReadonlyArray<string>;
}

/** Build the complete window bucket sequence: dense aggregates from
 *  `bucketAggregates`, with empty calendar units spliced in at their
 *  correct chronological position. Index-aligned with the `chart.data`
 *  the resolver builds from the same window. */
export function bucketSequence(
    atoms: ReadonlyArray<Atom>,
    placements: ReadonlyArray<AtomPlacement>,
    opts: BucketSequenceOptions,
): BucketAggregate[] {
    const { foldUnit, windowStartKey, windowEndKey, anchorISO, seriesKeys = [] } = opts;
    const dense = bucketAggregates(atoms, placements, seriesKeys);
    if (atoms.length === 0) return dense;

    const anchorMs = Date.parse(`${anchorISO}T00:00:00Z`);
    const byKey = new Map(dense.map(b => [b.bucketKey, b]));

    /* Enumerate the calendar units that intersect the VISIBLE WINDOW,
     *  mirroring foldByCalendar's `while (cur < after)` loop. For each,
     *  reuse the dense agg if present, else synthesize an empty bucket.
     *
     *  The walk is CLAMPED to the window, not the full atom span. The
     *  atom range can be centuries wide (a tenant's whole publication
     *  history); enumerating every fold unit across it at a fine unit
     *  ('day'/'month') materializes tens of thousands of empty buckets
     *  per render — all outside the window, x-clamped to [0,1] and culled
     *  downstream, yet each one allocated (with a `seriesValues` dict) and
     *  pushed through geometry. That is unbounded work that crashes the
     *  renderer. Buckets the window can't show are never built: clamp the
     *  start to max(firstAtom, windowStart) and the end to
     *  min(lastAtom+1d, windowEnd+1d), both in date space, before aligning
     *  to the fold unit. Visible output is identical. */
    const firstD = new Date(anchorMs + atoms[0].key * HOUR_MS);
    const lastD = new Date(anchorMs + atoms[atoms.length - 1].key * HOUR_MS);
    const windowStartD = new Date(anchorMs + windowStartKey * HOUR_MS);
    const windowEndD = new Date(anchorMs + windowEndKey * HOUR_MS);
    /* Walk floor: latest of the first atom and the window's left edge,
     *  snapped back to its fold-unit start so the first bucket is whole. */
    const walkStart = firstD > windowStartD ? firstD : windowStartD;
    let cur = alignToUnitStart(walkStart, foldUnit);
    /* Walk ceiling: earliest of (last atom, window right edge), +1 day so
     *  the bucket containing that final instant is included. */
    const walkEnd = lastD < windowEndD ? lastD : windowEndD;
    const after = new Date(walkEnd); after.setUTCDate(after.getUTCDate() + 1);
    /* MUST match `placeAtoms`'s winSpan (place-atoms.ts:76,
     *  `windowEndKey + 1 - windowStartKey`) — empties interleave with
     *  placement-derived aggregates, so they must share the same
     *  denominator or the gap x-span won't abut its neighbours. */
    const winSpan = (windowEndKey + 1 - windowStartKey) || 1;

    const out: BucketAggregate[] = [];
    while (cur < after) {
        const next = stepByUnit(new Date(cur), foldUnit);
        const startISO = cur.toISOString().split('T')[0];
        const endISO = next.toISOString().split('T')[0];
        const bucketKey = `${foldUnit}-${startISO}`;
        const hit = byKey.get(bucketKey);
        if (hit) {
            if (hit.endISO === undefined) hit.endISO = endISO;
            out.push(hit);
        } else {
            const startKey = Math.round((cur.getTime() - anchorMs) / HOUR_MS);
            const endKey = Math.round((next.getTime() - anchorMs) / HOUR_MS) - 1;
            /* UNCLAMPED, matching `placeAtoms`/`bucketAggregates`
             *  (place-atoms.ts:140-141). The resolver clamps to [0,1]
             *  uniformly when it builds `data`, so empties must enter
             *  this sequence in the same raw space as non-empties. */
            const xStart = (startKey - windowStartKey) / winSpan;
            const xEnd = (endKey + 1 - windowStartKey) / winSpan;
            const empty: BucketAggregate = {
                bucketKey,
                xCenter: (xStart + xEnd) / 2,
                xStart, xEnd,
                value: 0,
                seriesValues: Object.fromEntries(seriesKeys.map(s => [s, 0])),
                startKey, endKey,
                startISO, endISO,
                /* A bucket with no atoms is genuinely missing → gap. */
                status: 'observed',
                defined: false,
            };
            out.push(empty);
        }
        cur = next;
    }
    return out;
}
