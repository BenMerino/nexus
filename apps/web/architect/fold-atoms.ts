/* ── Atomic Data Foundation ─────────────────────────────────
 * The graph engine's single source of truth for time/ordinal
 * data: a stream of atoms at the finest meaningful granularity.
 * The client folds atoms into visible buckets at render time
 * via a pure aggregator. One math primitive replaces what was
 * three layered systems (server granularity ladder, client
 * compress-data, semantic-zoom level picker).
 *
 * Design principles:
 *   - Atoms are immutable, ordered, equally-spaced on their key axis.
 *   - Folding is mathematically correct: aggregators carry weights
 *     where needed (averages of averages are forbidden).
 *   - Folding is continuous: the fold factor can be any positive
 *     real, not just integer steps. Animation falls out for free.
 *   - No knowledge of pixels lives here. Caller decides the
 *     visible bucket count from layout; this file does math.
 *
 * Tested in __tests__/fold-atoms.test.ts.
 * ──────────────────────────────────────────────────────────── */

/** Aggregator: how to combine N atoms into one visible bucket.
 *
 *   sum   — additive metrics (revenue, count, total minutes)
 *   wavg  — weighted-average ratios. Each atom carries a numerator
 *           in `value` and a denominator in `weight`; the bucket's
 *           value is `Σ(value) / Σ(weight)`. Math-correct: averaging
 *           averages is wrong, this avoids it.
 *   min   — minimum across atoms
 *   max   — maximum across atoms
 *   first / last — boundary samples (useful for snapshots)
 */
export type Aggregator = 'sum' | 'wavg' | 'min' | 'max' | 'first' | 'last';

/** Calendar-aligned fold units for time-series atoms. The renderer
 * reads `iso` (+ optional `hour`) and groups atoms whose timestamps
 * fall within the same unit. `'auto'` lets the renderer pick based
 * on the visible-pixel budget; the rest are explicit user choices.
 *
 * Ordered ladder (fine → coarse):
 *   hour < day < month < year < decade < century
 *   (quarter + week removed — navigation goes year → month → day directly.)
 *
 * `'hour'` enables sub-day resolution for builders that ship hourly
 * atoms (`Atom.hour` set). Daily-only builders never reach this rung —
 * `eligibleFoldUnits` filters it out unless atoms expose hour data.
 *
 * `'decade'`/`'century'` are the coarsest rungs — 10 / 100 calendar years
 * per bucket, aligned to the …0 / …00 year (1990, 2000 / 1900, 2000). They
 * earn their place over multi-decade / multi-century spans (academic
 * publication histories spanning 100+ years) where even `decade` produces
 * an unreadable number of buckets. */
export type FoldUnit = 'auto' | 'hour' | 'day' | 'month' | 'year' | 'decade' | 'century';

/** The concrete fold units (no 'auto'). The single canonical list — callers
 *  that accept a persisted/wire foldUnit MUST validate against this so a stale
 *  value (e.g. a 'week'/'quarter' saved before they were dropped) falls back to
 *  'auto' instead of reaching the calendar walk (which would spin forever on an
 *  unknown unit). */
export const VALID_FOLD_UNITS: ReadonlySet<Exclude<FoldUnit, 'auto'>> =
    new Set(['hour', 'day', 'month', 'year', 'decade']);

/** True if `u` is a currently-supported concrete fold unit. */
export function isValidFoldUnit(u: unknown): u is Exclude<FoldUnit, 'auto'> {
    return typeof u === 'string' && VALID_FOLD_UNITS.has(u as Exclude<FoldUnit, 'auto'>);
}

/** Atom key resolution. `key` is hours-since-anchor (integer). Daily
 * atoms occupy hour 0 of each day (`key = dayIdx * HOURS_PER_DAY`);
 * hourly atoms fill the remaining 23 slots when builders opt in. The
 * slider's user-facing `windowDays` field multiplies by this constant
 * to span atom keys. Centralized so we never sprinkle `24`s. */
export const HOURS_PER_DAY = 24;

/* Semantic status + the aggregation kernel live in their own concern
 * files; status is re-exported so existing `from './fold-atoms.js'`
 * importers keep working. */
import type { DatumStatus } from './datum-status.js';
import { combineRange } from './fold-aggregate.js';
export { mergeStatus, type DatumStatus } from './datum-status.js';

/** A single atomic data point. `key` is a sortable numeric position
 * on the axis (hours-since-anchor for time series, ordinal index for
 * non-time). `iso` is the `YYYY-MM-DD` date; required for calendar-
 * aligned fold modes. `hour` (0-23) is set only by hourly-resolution
 * builders — when absent the atom lives at hour 0. `weight` is
 * required only for `wavg`. `status` (semantic — forecast/partial/…) and
 * `defined:false` (genuinely missing → curve breaks, not zero) fold into
 * the bucket. Extra series fields live via the `[seriesKey]` siblings. */
export interface Atom {
    key: number;
    label: string;
    iso?: string;
    hour?: number;
    value: number;
    weight?: number;
    status?: DatumStatus;
    defined?: boolean;
    [seriesKey: string]: string | number | boolean | undefined;
}

/** A folded atom — same shape as Atom but represents N atoms combined.
 * Carries `count` (atoms in this bucket, for tooltip / breakdown) and
 * `__x` (temporal midpoint in [0..1] across the source atom range, for
 * the renderer's time-axis positioning). */
export interface FoldedAtom extends Atom {
    count: number;
    __x?: number;
}

/** Calendar-aligned bucket: each visible bucket spans one unit
 * (day/week/month/year) AND carries the start/end keys so the
 * renderer can position it geometrically inside the visible window.
 *
 * `startKey` and `endKey` are atom keys (epoch-day indices). The bucket
 * may extend OUTSIDE the visible window — the renderer clips its pixel
 * width to the plot range. This is what makes drag continuous: as the
 * window edges sweep through a bucket, its pixel x and width interpolate
 * smoothly. No bucket-count snapping. */
export interface CalendarBucket extends FoldedAtom {
    /** First atom key included in this bucket (inclusive). */
    startKey: number;
    /** Last atom key included in this bucket (inclusive). */
    endKey: number;
    /** Calendar unit boundaries — used by the renderer for clipping
     * and label formatting. ISO `YYYY-MM-DD` half-open `[startISO, endISO)`. */
    startISO: string;
    endISO: string;
}

/** Pick a default fold unit based on the visible time span. Aims for
 * ~30 buckets across the plot, which gives bars wide enough to read
 * at 16-24px each. `hasHourly` controls whether the `'hour'` rung is
 * available — builders that ship daily-only atoms never get hour-fold
 * even when zoomed to a single day (their atoms have nothing finer). */
export function pickAutoFoldUnit(visibleDays: number, hasHourly: boolean = false): Exclude<FoldUnit, 'auto'> {
    if (hasHourly && visibleDays <= 5) return 'hour';
    if (visibleDays <= 90) return 'day';
    if (visibleDays <= 365 * 8) return 'month';
    if (visibleDays <= 365 * 40) return 'year';
    if (visibleDays <= 365 * 250) return 'decade';
    return 'century';
}

/** Which fold units make sense for a given visible window?
 *
 * Rule: a unit is allowed if its bucket count for `visibleDays` falls in
 * a readable range — not too dense (>~120 buckets, cells become invisible)
 * nor too sparse (<3 buckets, the chart looks empty). 'auto' is always
 * included as the default. `'hour'` only appears when `hasHourly` is true.
 *
 * Output order is coarse → fine, matching how a user typically thinks
 * about zooming in: "show me yearly, then monthly, then weekly". */
export function eligibleFoldUnits(visibleDays: number, hasHourly: boolean = false): Array<Exclude<FoldUnit, 'auto'> | 'auto'> {
    const out: Array<Exclude<FoldUnit, 'auto'> | 'auto'> = ['auto'];
    const centennial = visibleDays / 36500;
    const decadal = visibleDays / 3650;
    const yearly = visibleDays / 365;
    const monthly = visibleDays / 30;
    const daily = visibleDays;
    const hourly = visibleDays * HOURS_PER_DAY;
    if (centennial >= 3 && centennial <= 120) out.push('century');
    if (decadal >= 3 && decadal <= 120) out.push('decade');
    if (yearly >= 3 && yearly <= 120) out.push('year');
    if (monthly >= 3 && monthly <= 120) out.push('month');
    if (daily >= 3 && daily <= 120) out.push('day');
    if (hasHourly && hourly >= 3 && hourly <= 120) out.push('hour');
    return out;
}

/** Whether a bucket at this fold unit can OPEN — i.e. drilling into its
 *  period reveals finer buckets. The single drillability predicate for
 *  plot bucket clicks and axis base-row labels: a day bucket opens only
 *  when hourly atoms exist below it; an hour bucket never opens; every
 *  coarser unit always does. `undefined` (categorical x) never opens —
 *  categorical drills go through index math, not calendar periods. */
export function foldOpensFiner(unit: FoldUnit | undefined, hasHourly: boolean): boolean {
    if (!unit || unit === 'auto' || unit === 'hour') return false;
    return unit !== 'day' || hasHourly;
}

import { stepByUnit, alignToUnitStart, formatLabel } from './fold-atoms-calendar';

/** Calendar-aligned fold. Groups atoms by calendar unit (hour/day/week/
 * month/year). Each output bucket carries `startKey`/`endKey`
 * atom-key range AND `startISO`/`endISO` calendar boundaries, so the
 * renderer can position it geometrically inside the visible window via
 * linearScale.
 *
 * Atom keys are hours-since-anchor. Atoms whose `(iso, hour)` falls
 * inside the bucket's calendar window belong to the bucket. The first/
 * last bucket may have boundaries outside the atom array's range — that's
 * fine; their atom range is empty and they render as zero.
 *
 * Pure. */
export function foldByCalendar(atoms: Atom[], unit: Exclude<FoldUnit, 'auto'>, aggregator: Aggregator, seriesKeys: string[] = []): CalendarBucket[] {
    if (atoms.length === 0) return [];
    const firstISO = atoms[0].iso;
    const lastISO = atoms[atoms.length - 1].iso;
    if (!firstISO || !lastISO) {
        const folded = combineRange(atoms, 0, atoms.length, aggregator, seriesKeys);
        return [{
            ...folded,
            startKey: atoms[0].key, endKey: atoms[atoms.length - 1].key,
            startISO: '', endISO: '',
        }];
    }
    /* Atoms are keyed by hours-since-anchor where anchor is hour 0 of
     * the first atom's date. Build a (iso, hour) → atom map; daily-only
     * atoms register at hour 0. Walk calendar boundaries, slice atoms
     * by `(boundary date, boundary hour)`, fold. */
    const firstD = new Date(`${firstISO}T00:00:00Z`);
    const lastD = new Date(`${lastISO}T00:00:00Z`);
    const anchorMs = firstD.getTime();
    const atomsByHourKey = new Map<number, Atom>();
    for (const a of atoms) {
        if (a.iso == null) continue;
        const aD = new Date(`${a.iso}T00:00:00Z`);
        const k = Math.round((aD.getTime() - anchorMs) / HOUR_MS) + (a.hour ?? 0);
        atomsByHourKey.set(k, a);
    }

    let cur = alignToUnitStart(firstD, unit);
    /* Coarse units (year/month) may start before the first
     * atom's day — that's intentional, the bucket's atom range is just
     * empty before the timeline begins. End the loop one full day past
     * the last atom so a trailing partial bucket still gets emitted. */
    const after = new Date(lastD); after.setUTCDate(after.getUTCDate() + 1);
    const buckets: CalendarBucket[] = [];
    while (cur < after) {
        const next = stepByUnit(new Date(cur), unit);
        const startISO = cur.toISOString().split('T')[0];
        const endISO = next.toISOString().split('T')[0];
        const startKey = Math.round((cur.getTime() - anchorMs) / HOUR_MS);
        const endKey = Math.round((next.getTime() - anchorMs) / HOUR_MS) - 1;
        const slice: Atom[] = [];
        for (let k = startKey; k <= endKey; k++) {
            const a = atomsByHourKey.get(k);
            if (a) slice.push(a);
        }
        if (slice.length > 0) {
            const folded = combineRange(slice, 0, slice.length, aggregator, seriesKeys);
            folded.label = formatLabel(cur, unit);
            buckets.push({ ...folded, startKey, endKey, startISO, endISO });
        } else {
            // Empty bucket — keep position so the geometry stays continuous.
            buckets.push({
                key: (startKey + endKey) / 2, label: formatLabel(cur, unit), value: 0, count: 0,
                startKey, endKey, startISO, endISO,
            });
        }
        cur = next;
    }
    return buckets;
}

const HOUR_MS = 3_600_000;

