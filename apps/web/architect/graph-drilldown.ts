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
 *  (e.g. `2026-04` for April, `2026`) into
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
    /* Carry the calendar identity (`periodKey`) on the child — the SINGLE
     *  source the breadcrumb + axis read, so they show "2020s"/"2024", never a
     *  reverse-engineered day-window range like "2007–2017". The window
     *  (windowDays/asOf) is just what the fetch/fold needs; the IDENTITY is the
     *  key. */
    const child = { ...parent, windowDays: spanDays, asOf, periodKey };
    /* Containment — not size — is the gate. A sibling period (Q1 → Q2)
     *  has the same width but a disjoint range, and clicking the year
     *  while inside a quarter widens; both must be rejected so the
     *  breadcrumb only ever descends. */
    return isContained(child, parent) ? child : null;
}

/** Period key for the bucket starting at `startISO` at fold `unit` — the
 *  inverse of formatLabel, producing the key shape `periodBounds` parses. Lets
 *  a BASE-bar click (which carries the bucket's startISO + the chart's fold
 *  unit) drill via the calendar-exact `narrowQueryToPeriod`, the same as an
 *  axis-tier click, instead of the fuzzy daysPerBucket bucket math. Returns
 *  null for units with no period-drill shape (hour) or a non-ISO start. */
export function periodKeyFor(startISO: string, unit: string): string | null {
    const m = startISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const yyyy = parseInt(m[1], 10);
    if (unit === 'century') return `${Math.floor(yyyy / 100) * 100}c`;
    if (unit === 'decade') return `${Math.floor(yyyy / 10) * 10}s`;
    if (unit === 'year') return String(yyyy);
    if (unit === 'month') return `${m[1]}-${m[2]}`;
    /* week/day/hour drill via the existing bucket path (week needs the
     *  Thursday-owner key; day/hour are at/below finest period drill). */
    return null;
}

/** Parse a tier-group key into half-open calendar bounds. Key shapes
 *  emitted by `chart-primitives-cartesian.ts` `tierKeyAndLabel`:
 *    year:    `YYYY`              → [YYYY-01-01, (YYYY+1)-01-01)
 *    month:   `YYYY-MM`           → [YYYY-MM-01,    next month-01)
 *    decade:  `YYYYs`             → [(…0)-01-01,    (…0+10)-01-01)
 *    century: `YYYYc`             → [(…00)-01-01,   (…00+100)-01-01)
 *  Returns null for unrecognized shapes. */
export function periodBounds(key: string): { startISO: string; endISO: string } | null {
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
    /* Decade / Century: `YYYYs` — the …0 (decade) or …00 (century) start year
     *  written with a trailing 's' (matches formatLabel: 2020s, 1900s). A bare
     *  4-digit-with-s is a decade; the century shape carries the same syntax but
     *  the calling fold unit decides the span, so we infer from the value: a
     *  multiple of 100 with no tens/units is ambiguous, so accept an explicit
     *  width via the key suffix. Decade = `YYYYs`, Century = `YYYYc`. */
    const decadeMatch = key.match(/^(\d{4})s$/);
    if (decadeMatch) {
        const dstart = Math.floor(parseInt(decadeMatch[1], 10) / 10) * 10;
        const start = new Date(Date.UTC(dstart, 0, 1));
        const end = new Date(Date.UTC(dstart + 10, 0, 1));
        return { startISO: start.toISOString().split('T')[0], endISO: end.toISOString().split('T')[0] };
    }
    const centuryMatch = key.match(/^(\d{4})c$/);
    if (centuryMatch) {
        const cstart = Math.floor(parseInt(centuryMatch[1], 10) / 100) * 100;
        const start = new Date(Date.UTC(cstart, 0, 1));
        const end = new Date(Date.UTC(cstart + 100, 0, 1));
        return { startISO: start.toISOString().split('T')[0], endISO: end.toISOString().split('T')[0] };
    }
    return null;
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
* ≤~8 days → the day (2026-04-15)
* ≤~100 → the month (Apr 2026)
 *    ≤~366 → the year (2026) · else → a year range (2010–2019). */
/** Human label for a calendar `periodKey` — the SAME identity the drill set, so
 *  the breadcrumb reads "2020s" / "2024" / "Mar 2024", matching the period the
 *  view actually descended into. `2020s` decade, `YYYY` year, `YYYY-MM` month. */
function periodLabel(key: string): string | null {
    const month = key.match(/^(\d{4})-(\d{2})$/);
    if (month) return `${MONTHS[parseInt(month[2], 10) - 1]} ${month[1]}`;
    if (/^\d{4}$/.test(key)) return key;                 // year
    if (/^\d{4}s$/.test(key)) return key;                // decade (2020s)
    if (/^\d{4}c$/.test(key)) return `${key.slice(0, 4)}s`; // century → 1900s
    return null;
}

export function windowLabel(q: GraphQuery): string {
    /* Prefer the calendar identity the drill carried — one source of truth, no
     *  reverse-engineering a range from the day window (which drifts and
     *  produced "2007–2017"). Falls back to the window only for un-drilled or
     *  atom-range queries that carry no periodKey. */
    if (q.periodKey) {
        const pl = periodLabel(q.periodKey);
        if (pl) return pl;
    }
    const endISO = q.asOf ?? isoToday();
    const end = new Date(`${endISO}T00:00:00Z`);
    if (Number.isNaN(end.getTime())) return endISO;
    const d = q.windowDays;
    if (d == null) return 'All';
    const y = end.getUTCFullYear();
    if (d <= 8) return endISO;
    if (d <= 100) return `${MONTHS[end.getUTCMonth()]} ${y}`;
    if (d <= 366) return String(y);
    const startY = new Date(end.getTime() - (d - 1) * DAY_MS).getUTCFullYear();
    return startY === y ? String(y) : `${startY}–${y}`;
}

/** Inverse: given a child query that was the result of drilling, return the
 * parent. Hard to do robustly without breadcrumb history — controllers track
 * the parent themselves. Exported for symmetry / discoverability. */
export type DrillBreadcrumb = { query: GraphQuery; bucketLabel: string };
