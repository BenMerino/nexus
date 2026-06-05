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
    return d;
}

/** Snap a Date to the start of its fold unit (UTC). Hour → top of
 * current hour. Day → no change. Month → first of month. Year → Jan 1.
 * Decade → Jan 1 of the …0 year (2003 → 2000). */
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
    return new Date(Date.UTC(r.getUTCFullYear(), 0, 1));
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** Format a bucket's start date as a label, by unit. Labels encode the
 *  natural identity of each bucket at its zoom level:
 *    - hour    → `09:00`             (24h clock)
 *    - day     → `Mon 03-25`        (weekday + date)
 *    - month   → `Mar 2026`         (month + 4-digit year)
 *    - year    → `2026`
 *    - decade  → `2020s`
 *  (week + quarter were dropped from the ladder.)
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
    return String(yyyy);
}
