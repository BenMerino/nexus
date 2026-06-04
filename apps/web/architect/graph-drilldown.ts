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

const DAY_MS = 86_400_000;

/** Inclusive day-range `[startMs, endMs]` a query window covers.
 *  `asOf` (or today) is the inclusive right edge; the left edge is
 *  `windowDays - 1` days earlier. `windowDays == null` ⇒ all-time, so
 *  the left edge is -∞. */
function windowRange(q: GraphQuery): { startMs: number; endMs: number } {
    const endMs = Date.parse(`${q.asOf ?? isoToday()}T00:00:00Z`);
    const startMs = q.windowDays == null
        ? -Infinity
        : endMs - (q.windowDays - 1) * DAY_MS;
    return { startMs, endMs };
}

/** A drill is legitimate only when the child window is *strictly inside*
 *  the parent window — i.e. it actually descends the containment
 *  hierarchy. This is what keeps the breadcrumb honest: clicking a
 *  sibling period (Q1 → Q2), an ancestor (inside Q1, click the year),
 *  or the same period twice are all NOT drills and must be rejected so
 *  they never push a misleading crumb. Pure size comparison can't tell
 *  a sibling from a child (two quarters are ~equal width); containment
 *  can. The `asOf`-from-today fallback means an all-time parent still
 *  contains any bounded child ending on/before "now". */
function isContained(child: GraphQuery, parent: GraphQuery): boolean {
    const c = windowRange(child);
    const p = windowRange(parent);
    const insideLeft = c.startMs >= p.startMs;
    const insideRight = c.endMs <= p.endMs;
    const strictlyNarrower = c.startMs > p.startMs || c.endMs < p.endMs;
    return insideLeft && insideRight && strictlyNarrower;
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
    const child = { ...parent, windowDays: Math.max(1, Math.round(daysPerBucket)), asOf };
    return isContained(child, parent) ? child : null;
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
    const periodStartMs = Date.parse(`${bounds.startISO}T00:00:00Z`);
    /* Inclusive last day of the period (`endISO` is the half-open upper
     *  bound). */
    const periodEndMs = Date.parse(`${bounds.endISO}T00:00:00Z`) - DAY_MS;
    if (!Number.isFinite(periodStartMs) || !Number.isFinite(periodEndMs)) return null;
    /* Clamp the period to the parent window. Drilling "2026" from a view
     *  anchored in June must land on Jan 1 → Jun 3 (the part of 2026
     *  actually on screen), never Jan → Dec — a window full of months
     *  that haven't happened is exactly the "impossible view" we're
     *  fixing. The clamp keeps `asOf` from ever jumping past the data. */
    const p = windowRange(parent);
    const startMs = Math.max(periodStartMs, p.startMs);
    const endMs = Math.min(periodEndMs, p.endMs);
    if (endMs < startMs) return null; // period sits entirely outside the view
    const spanDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);
    const asOf = new Date(endMs).toISOString().split('T')[0];
    const child = { ...parent, windowDays: spanDays, asOf };
    /* Containment — not size — is the gate. A sibling period (Q1 → Q2)
     *  has the same width but a disjoint range, and clicking the year
     *  while inside a quarter widens; both must be rejected so the
     *  breadcrumb only ever descends. */
    return isContained(child, parent) ? child : null;
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
    const child = { ...parent, windowDays: spanDays, asOf: anchorISO };
    // Drill only when the cell's window sits strictly inside the parent.
    return isContained(child, parent) ? child : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A consistent, human breadcrumb label for a drilled window — derived from
 *  the RESULTING child query (windowDays + asOf), NOT the raw clicked axis
 *  text. The clicked label was whatever tier you hit (a date like `1986-05-01`
 *  from the base row, or a bare `Q1` from a tier row), so trails mixed formats
 *  and could repeat. Formatting the actual window picks the natural calendar
 *  unit from its span, so every crumb reads the same way and always reflects
 *  what was drilled to:
 *    ≤1 day → the day (2026-04-15) · ≤~8 days → week-of (Wk 2026-04-13)
 *    ≤~45 → the month (Apr 2026) · ≤~100 → the quarter (Q2 2026)
 *    ≤~366 → the year (2026) · else → a year range (2010–2019). */
export function windowLabel(q: GraphQuery): string {
    const endISO = q.asOf ?? isoToday();
    const end = new Date(`${endISO}T00:00:00Z`);
    if (Number.isNaN(end.getTime())) return endISO;
    const d = q.windowDays;
    if (d == null) return 'All';
    const y = end.getUTCFullYear();
    if (d <= 1) return endISO;
    if (d <= 8) return `Wk ${endISO}`;
    if (d <= 45) return `${MONTHS[end.getUTCMonth()]} ${y}`;
    if (d <= 100) return `Q${Math.floor(end.getUTCMonth() / 3) + 1} ${y}`;
    if (d <= 366) return String(y);
    const startY = new Date(end.getTime() - (d - 1) * DAY_MS).getUTCFullYear();
    return startY === y ? String(y) : `${startY}–${y}`;
}

/** Inverse: given a child query that was the result of drilling, return the
 * parent. Hard to do robustly without breadcrumb history — controllers track
 * the parent themselves. Exported for symmetry / discoverability. */
export type DrillBreadcrumb = { query: GraphQuery; bucketLabel: string };
