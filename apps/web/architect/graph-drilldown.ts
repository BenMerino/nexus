import type { GraphQuery } from './graph-composer.types.js';

/* ── Graph Drill-down ───────────────────────────────────────
 * Pure helper: given a parent GraphQuery and a clicked bucket index,
 * derive a child GraphQuery that narrows to that bucket's natural span.
 * No server endpoint needed — drill-down is just a query mutation, the
 * same recompose endpoint serves the result.
 *
 * Atomic foundation: caller passes `daysPerBucket` — the number of days
 * each visible bucket represents at the parent's current fold factor.
 * Computed in the renderer from `(visibleAtomCount / totalBuckets)`
 * since atoms are day-level. The child's `windowDays = daysPerBucket`
 * and `asOf` lands on the clicked bucket's right edge.
 *
 * Returns null when:
 *   - daysPerBucket is 1 (already at finest granularity — can't drill further).
 *   - The clicked bucket is out of bounds.
 * ──────────────────────────────────────────────────────────── */

function isoToday(): string {
    return new Date().toISOString().split('T')[0];
}

/** Compute the end-of-bucket ISO date for the clicked index. Bucket N-1
 *  ends at `parentEnd`; earlier buckets step back by `daysPerBucket`. */
function computeBucketEnd(parent: GraphQuery, bucketIndex: number, totalBuckets: number, daysPerBucket: number): string {
    const stepBack = (totalBuckets - 1) - bucketIndex;
    const end = parent.asOf ? new Date(`${parent.asOf}T00:00:00Z`) : new Date();
    end.setUTCDate(end.getUTCDate() - stepBack * daysPerBucket);
    return end.toISOString().split('T')[0];
}

export function narrowQueryToBucket(
    parent: GraphQuery,
    bucketIndex: number,
    totalBuckets: number,
    daysPerBucket: number,
): GraphQuery | null {
    if (daysPerBucket <= 1) return null; // already at finest granularity
    if (bucketIndex < 0 || bucketIndex >= totalBuckets) return null;
    const asOf = computeBucketEnd(parent, bucketIndex, totalBuckets, daysPerBucket);
    return { ...parent, windowDays: Math.max(1, Math.round(daysPerBucket)), asOf };
}

/** Calendar-period drill-down. Decodes a chrome tier-group's `key`
 *  (e.g. `2026-04` for April, `2026-Q2`, `2026`, `2026-04-W2`) into
 *  the period's `[start, end)` boundaries via pure date math, then
 *  emits a child query whose window covers exactly that period.
 *
 *  Foundation-correct: calendar identity → calendar bounds. No fold-
 *  factor arithmetic, no anchoring to the parent's right edge, no
 *  off-by-one drift. Clicking "April" produces `windowDays = 30,
 *  asOf = 2026-04-30`. Clicking "2026" produces `windowDays = 365,
 *  asOf = 2026-12-31`.
 *
 *  Returns null when the key shape is unrecognized or the resulting
 *  window wouldn't actually narrow the parent. */
export function narrowQueryToPeriod(parent: GraphQuery, periodKey: string): GraphQuery | null {
    const bounds = periodBounds(periodKey);
    if (!bounds) return null;
    const { startISO, endISO } = bounds;
    const startMs = Date.parse(`${startISO}T00:00:00Z`);
    const endMs = Date.parse(`${endISO}T00:00:00Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    const spanDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
    if (parent.windowDays != null && spanDays >= parent.windowDays) return null;
    /* `asOf` is the period's last day (inclusive end - 1). */
    const asOfMs = endMs - 86_400_000;
    const asOf = new Date(asOfMs).toISOString().split('T')[0];
    return { ...parent, windowDays: spanDays, asOf };
}

/** Parse a tier-group key into half-open calendar bounds. Key shapes
 *  emitted by `chart-primitives-cartesian.ts` `tierKeyAndLabel`:
 *    year:    `YYYY`              → [YYYY-01-01, (YYYY+1)-01-01)
 *    quarter: `YYYY-Qn`           → [start of Qn,    start of Qn+1)
 *    month:   `YYYY-MM`           → [YYYY-MM-01,    next month-01)
 *    week:    `YYYY-MM-Wn`        → [Mon of Wn,     Mon of Wn+1)
 *  Returns null for unrecognized shapes. */
function periodBounds(key: string): { startISO: string; endISO: string } | null {
    /* Week: YYYY-MM-Wn — owner-month/year + week-of-month number.
     *  The week's Monday is at `weekStart`; end is +7 days. */
    const weekMatch = key.match(/^(\d{4})-(\d{2})-W(\d+)$/);
    if (weekMatch) {
        const yyyy = parseInt(weekMatch[1], 10);
        const mm = parseInt(weekMatch[2], 10);
        const wn = parseInt(weekMatch[3], 10);
        if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(wn)) return null;
        /* Find W1's Monday — week whose Thursday lands in (yyyy, mm).
         *  Step forward (wn - 1) weeks for Wn's Monday. */
        const w1Mon = firstWeekMondayOfMonth(yyyy, mm - 1);
        if (!w1Mon) return null;
        const start = new Date(w1Mon);
        start.setUTCDate(start.getUTCDate() + (wn - 1) * 7);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        return { startISO: start.toISOString().split('T')[0], endISO: end.toISOString().split('T')[0] };
    }
    /* Quarter: YYYY-Qn. */
    const quarterMatch = key.match(/^(\d{4})-Q(\d)$/);
    if (quarterMatch) {
        const yyyy = parseInt(quarterMatch[1], 10);
        const qn = parseInt(quarterMatch[2], 10);
        if (qn < 1 || qn > 4) return null;
        const startMonth = (qn - 1) * 3;
        const start = new Date(Date.UTC(yyyy, startMonth, 1));
        const end = new Date(Date.UTC(yyyy, startMonth + 3, 1));
        return { startISO: start.toISOString().split('T')[0], endISO: end.toISOString().split('T')[0] };
    }
    /* Month: YYYY-MM. */
    const monthMatch = key.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
        const yyyy = parseInt(monthMatch[1], 10);
        const mm = parseInt(monthMatch[2], 10);
        const start = new Date(Date.UTC(yyyy, mm - 1, 1));
        const end = new Date(Date.UTC(yyyy, mm, 1));
        return { startISO: start.toISOString().split('T')[0], endISO: end.toISOString().split('T')[0] };
    }
    /* Year: YYYY. */
    const yearMatch = key.match(/^(\d{4})$/);
    if (yearMatch) {
        const yyyy = parseInt(yearMatch[1], 10);
        const start = new Date(Date.UTC(yyyy, 0, 1));
        const end = new Date(Date.UTC(yyyy + 1, 0, 1));
        return { startISO: start.toISOString().split('T')[0], endISO: end.toISOString().split('T')[0] };
    }
    return null;
}

/** Monday of W1 of (yyyy, monthIdx) under the Thursday-owner convention.
 *  W1's Monday is the Monday whose Thursday is the earliest Thursday
 *  inside the target month. Used by `periodBounds` to resolve a
 *  `YYYY-MM-Wn` key into a calendar date. */
function firstWeekMondayOfMonth(yyyy: number, monthIdx: number): Date | null {
    /* Walk back to the Monday on/before the 1st; if its Thursday is in
     *  the target month, that's W1. Otherwise step forward one week. */
    const first = new Date(Date.UTC(yyyy, monthIdx, 1));
    const dow = (first.getUTCDay() + 6) % 7; // Mon=0
    const candidate = new Date(first);
    candidate.setUTCDate(candidate.getUTCDate() - dow);
    const thursday = new Date(candidate);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    if (thursday.getUTCMonth() !== monthIdx) {
        candidate.setUTCDate(candidate.getUTCDate() + 7);
    }
    return candidate;
}

/** Heatmap sibling of `narrowQueryToBucket`. The cell's `[startKey, endKey]`
 *  atom-key range maps directly to a window in days (atoms are hour-keyed)
 *  and an `asOf` anchor at the cell's last atom. Returns null when the
 *  resulting window is already at the minimum useful size — at that point
 *  drilling in is a no-op and the cartesian path takes over via cross-
 *  family drill (future). */
export function narrowQueryToAtomRange(
    parent: GraphQuery,
    startKey: number,
    endKey: number,
    anchorISO: string,
): GraphQuery | null {
    const HOURS_PER_DAY = 24;
    if (endKey < startKey) return null;
    const spanHours = endKey - startKey + 1;
    const spanDays = Math.max(1, Math.round(spanHours / HOURS_PER_DAY));
    // No-op if we'd be widening or staying put.
    if (parent.windowDays != null && spanDays >= parent.windowDays) return null;
    return { ...parent, windowDays: spanDays, asOf: anchorISO };
}

/** Inverse: given a child query that was the result of drilling, return the
 * parent. Hard to do robustly without breadcrumb history — controllers track
 * the parent themselves. Exported for symmetry / discoverability. */
export type DrillBreadcrumb = { query: GraphQuery; bucketLabel: string };
