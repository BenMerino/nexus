/**
 * Window math for `resolveAtomicDirective` — pure helpers that convert
 * between the query's day-denominated window (`windowDays`/`asOf`) and
 * the atom-key (hours-since-anchor) axis, snap windows to whole bucket
 * boundaries, and bound the fold's input span. Extracted from
 * `graph-resolve-atoms.ts` to keep that file under the line ceiling.
 */

import type { FoldUnit } from '../../architect/fold-atoms.js';
import { alignToUnitStart, stepByUnit } from '../../architect/fold-atoms-calendar.js';

export const HOUR_MS = 3_600_000;

/** Snap a [start,end] window (atom-key space, hours-since-anchor) outward to
 *  whole bucket boundaries for `unit`: start floors to its bucket's start, end
 *  ceils to its bucket's end (next bucket start − 1h). Keeps every visible
 *  bucket complete so all bars are equal width. `anchorISO` is the atom
 *  timeline origin the keys are measured from. */
export function snapWindowToBuckets(
    startKey: number, endKey: number, unit: Exclude<FoldUnit, 'auto'>, anchorISO: string,
): { start: number; end: number } {
    const anchorMs = Date.parse(`${anchorISO}T00:00:00Z`);
    if (!Number.isFinite(anchorMs)) return { start: startKey, end: endKey };
    const keyOf = (ms: number) => Math.round((ms - anchorMs) / HOUR_MS);
    const startBucket = alignToUnitStart(new Date(anchorMs + startKey * HOUR_MS), unit);
    const endBucket = alignToUnitStart(new Date(anchorMs + endKey * HOUR_MS), unit);
    const endNext = stepByUnit(new Date(endBucket), unit); // start of the bucket AFTER the end's bucket
    return { start: keyOf(startBucket.getTime()), end: keyOf(endNext.getTime()) - 1 };
}

/** ISO YYYY-MM-DD → whole-day count between that date and today (UTC).
 *  Returns 0 when ISO is today or in the future. */
export function daysBeforeToday(iso: string): number {
    const todayMs = Date.parse(`${new Date().toISOString().split('T')[0]}T00:00:00Z`);
    const isoMs = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isFinite(todayMs) || !Number.isFinite(isoMs)) return 0;
    return Math.max(0, Math.round((todayMs - isoMs) / 86_400_000));
}

/** Atom-key bounds for the fold's INPUT: the (bucket-aligned) window
 *  extended by `lookback + 1` whole buckets before (feature lookback +
 *  the left edge-neighbor) and one bucket after (right edge-neighbor).
 *  Folding more than this is wasted work — see the call site. Returns
 *  null when `anchorISO` doesn't parse (caller folds unclamped). */
export function foldClampKeys(
    windowStartKey: number, windowEndKey: number,
    unit: Exclude<FoldUnit, 'auto'>, anchorISO: string, lookback: number,
): { start: number; end: number } | null {
    const anchorMs = Date.parse(`${anchorISO}T00:00:00Z`);
    if (!Number.isFinite(anchorMs)) return null;
    let s = alignToUnitStart(new Date(anchorMs + windowStartKey * HOUR_MS), unit);
    for (let i = 0; i < lookback + 1; i++) {
        s = alignToUnitStart(new Date(s.getTime() - HOUR_MS), unit);
    }
    let e = alignToUnitStart(new Date(anchorMs + windowEndKey * HOUR_MS), unit);
    for (let i = 0; i < 2; i++) e = stepByUnit(e, unit);
    return {
        start: Math.round((s.getTime() - anchorMs) / HOUR_MS),
        end: Math.round((e.getTime() - anchorMs) / HOUR_MS) - 1,
    };
}
