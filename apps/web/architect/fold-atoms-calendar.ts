/* ── Calendar helpers for foldByCalendar ─────────────────────
 * Pure UTC date math. Stepping, snap-to-start, and label
 * formatting per fold unit. Extracted from fold-atoms.ts to
 * keep the main module under the file-length ceiling.
 * ──────────────────────────────────────────────────────────── */

import type { FoldUnit } from './fold-atoms';

/** Step a Date by one fold unit (in UTC). Mutates and returns. */
export function stepByUnit(d: Date, unit: Exclude<FoldUnit, 'auto'>): Date {
    if (unit === 'hour')     d.setUTCHours(d.getUTCHours() + 1);
    if (unit === 'day')      d.setUTCDate(d.getUTCDate() + 1);
    if (unit === 'month')    d.setUTCMonth(d.getUTCMonth() + 1);
    if (unit === 'year')     d.setUTCFullYear(d.getUTCFullYear() + 1);
    if (unit === 'decade')   d.setUTCFullYear(d.getUTCFullYear() + 10);
    if (unit === 'century')  d.setUTCFullYear(d.getUTCFullYear() + 100);
    return d;
}

/** Snap a Date to the start of its fold unit (UTC). Hour → top of
 * current hour. Day → no change. Week → previous Monday. Month →
 * first of month. * Year → Jan 1. Decade → Jan 1 of the …0 year (2003 → 2000). */
export function alignToUnitStart(d: Date, unit: Exclude<FoldUnit, 'auto'>): Date {
    if (unit === 'hour') {
        return new Date(Date.UTC(
            d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(),
        ));
    }
    const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (unit === 'day') return r;
    if (unit === 'month') return new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), 1));
    if (unit === 'decade') {
        return new Date(Date.UTC(Math.floor(r.getUTCFullYear() / 10) * 10, 0, 1));
    }
    if (unit === 'century') {
        return new Date(Date.UTC(Math.floor(r.getUTCFullYear() / 100) * 100, 0, 1));
    }
    return new Date(Date.UTC(r.getUTCFullYear(), 0, 1));
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** Week-of-month, 1-indexed. A week's "owner month" is the month
 *  containing its **Thursday** (ISO-week convention) — this is what
 *  gives you W1, W2, W3, W4 (sometimes W5) inside each month with no
 *  gaps and no straddle confusion. A week starting Mon Apr 27 has its
 *  Thursday on Apr 30 → it's W5 of April. The next week, Mon May 4,
 *  has its Thursday on May 7 → W1 of May. So the first week visible
 *  inside any month is always W1.
 *
 *  Calendar weeks are anchored Mon→Sun (matches `alignToUnitStart`). */
/* Exported so chrome/axis builders (chart-primitives-cartesian) share
 * the single source of truth — the fold produces "W1" labels using
 * this convention, and the tier-row chrome must group/label using the
 * same one or labels misalign with their data. */
export function weekOfMonth(start: Date): number {
    // Thursday of the week starting at `start` (Mon).
    const thursday = new Date(start);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    const ownerMonth = thursday.getUTCMonth();
    const ownerYear = thursday.getUTCFullYear();
    /* Find the Monday whose Thursday lands in the same (ownerYear,
     *  ownerMonth) and is the EARLIEST such Monday — that's the start
     *  of W1. Step backward week-by-week until the Thursday leaves
     *  the owner month; the last valid week is W1. */
    let w = 1;
    let probe = new Date(start);
    probe.setUTCDate(probe.getUTCDate() - 7);
    while (true) {
        const t = new Date(probe);
        t.setUTCDate(t.getUTCDate() + 3);
        if (t.getUTCMonth() !== ownerMonth || t.getUTCFullYear() !== ownerYear) break;
        w++;
        probe.setUTCDate(probe.getUTCDate() - 7);
    }
    return w;
}

/** Format a bucket's start date as a label, by unit. Labels encode the
 *  natural identity of each bucket at its zoom level:
 *    - hour    → `09:00`             (24h clock)
 *    - day     → `Mon 03-25`        (weekday + date)
 *    - week    → `W13 Mar 25`       (ISO week + week-start date)
 *    - month   → `Mar 2026`         (month + 4-digit year)
 *    - year    → `2026`
 *    - decade  → `2020s`
 *  X-axis decimation truncates if needed; full label shows in tooltips. */
export function formatLabel(start: Date, unit: Exclude<FoldUnit, 'auto'>): string {
    const m = MONTHS[start.getUTCMonth()];
    const d = String(start.getUTCDate()).padStart(2, '0');
    const yyyy = start.getUTCFullYear();
    /* Base-row labels are minimal — month + year context comes from
     *  the stacked coarser tiers in the chrome (see `coarserTiersFor`
     *  in chart-primitives-cartesian). */
    if (unit === 'hour') {
        return `${String(start.getUTCHours()).padStart(2, '0')}:00`;
    }
    if (unit === 'day') {
        const dow = DAYS[start.getUTCDay()];
        return `${dow} ${d}`;
    }
    if (unit === 'month') return m;
    if (unit === 'decade') return `${Math.floor(yyyy / 10) * 10}s`;
    if (unit === 'century') return `${Math.floor(yyyy / 100) * 100}s`;
    return String(yyyy);
}
