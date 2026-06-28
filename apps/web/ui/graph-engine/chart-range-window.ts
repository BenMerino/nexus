/**
 * Translation layer between the DateRangePicker's `{start, end}` value
 * and a GraphQuery's `(windowDays, asOf, periodKey)` window — the glue
 * that lets one shared picker drive chart time navigation without the
 * chart core knowing about pickers, and vice versa.
 *
 * `periodKeyForRange` is the range-shaped sibling of `periodKeyFor` in
 * `architect/graph-drilldown.ts` — SAME key grammar (`2024`, `2024-03`,
 * `2024-03-15`, `2020s`, `1900c`), parsed by the same `periodBounds`.
 * A picked range that lands exactly on a calendar period gets stamped
 * with its identity, so the chip/breadcrumb show "May 2026", never a
 * reverse-engineered day span.
 */

import type { GraphQuery } from '../../architect/graph-composer.types.js';
import type { DateRangeValue, DateRangePreset } from '../composed/DateRangePicker.js';
import type { Atom } from '../../architect/fold-atoms.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';

const DAY_MS = 86_400_000;

/** Noon-local Date for an ISO day — date-fns `format` (used by the
 *  picker presets' `resolve`) renders LOCAL dates, while our window math
 *  is UTC. Anchoring at local noon makes both name the same calendar
 *  day in any timezone. */
export function noonOf(todayISO: string): Date {
    return new Date(`${todayISO}T12:00:00`);
}

const isoToday = (): string => new Date().toISOString().split('T')[0];
const ms = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);
const toIso = (m: number): string => new Date(m).toISOString().split('T')[0];

/** Detect whether [startISO, endISO] (inclusive) is EXACTLY one calendar
 *  period, and return its periodKey — null otherwise. Checks fine→coarse
 *  so a single day is 'YYYY-MM-DD', never a degenerate month. */
export function periodKeyForRange(startISO: string, endISO: string): string | null {
    const s = ms(startISO), e = ms(endISO);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
    if (s === e) return startISO;                                       // single day
    const sd = new Date(s), ed = new Date(e);
    /* Whole-year spans: Jan 1 → Dec 31. Coarse first so a full year
     *  resolves as '2026', not as 12 unmatched months. */
    if (sd.getUTCMonth() === 0 && sd.getUTCDate() === 1 && ed.getUTCMonth() === 11 && ed.getUTCDate() === 31) {
        const y0 = sd.getUTCFullYear();
        const span = ed.getUTCFullYear() - y0 + 1;
        if (span === 1) return String(y0);
        if (span === 10 && y0 % 10 === 0) return `${y0}s`;
        if (span === 100 && y0 % 100 === 0) return `${y0}c`;
        return null;
    }
    /* Single month: starts on the 1st, ends on its own last day. */
    const nextDay = new Date(e + DAY_MS);
    const sameMonth = sd.getUTCFullYear() === ed.getUTCFullYear() && sd.getUTCMonth() === ed.getUTCMonth();
    if (sameMonth && sd.getUTCDate() === 1 && nextDay.getUTCDate() === 1) {
        return startISO.slice(0, 7);
    }
    return null;
}

/** GraphQuery window → the picker's inclusive `{start, end}` range.
 *  `windowDays == null` = all-time (picker 'all' convention: epoch→today).
 *  `asOf` absent anchors to today. */
export function rangeFromQuery(q: GraphQuery, todayISO: string = isoToday()): { start: string; end: string } {
    const end = q.asOf ?? todayISO;
    if (q.windowDays == null) return { start: '1970-01-01', end };
    const start = toIso(ms(end) - (q.windowDays - 1) * DAY_MS);
    return { start, end };
}

/** Picker value → the query window patch. Semantics:
 *  - end clamps to today (future data doesn't exist).
 *  - 'all' preset → `windowDays: null` (all-time).
 *  - a range ending TODAY anchors to "now" (`asOf: undefined`) so rolling
 *    presets keep rolling tomorrow; a historical end pins `asOf`.
 *  - a range that is exactly one calendar period stamps `periodKey`, so
 *    the chip/axis show the period's name — the same identity a drill
 *    into that period would carry. */
export function windowPatchFromRange(
    value: DateRangeValue, todayISO: string = isoToday(),
): { windowDays: number | null; asOf: string | undefined; periodKey: string | undefined } {
    if (value.preset === 'all') {
        return { windowDays: null, asOf: undefined, periodKey: undefined };
    }
    const end = ms(value.end) > ms(todayISO) ? todayISO : value.end;
    const start = ms(value.start) > ms(end) ? end : value.start;
    const windowDays = Math.max(1, Math.round((ms(end) - ms(start)) / DAY_MS) + 1);
    return {
        windowDays,
        asOf: end === todayISO ? undefined : end,
        periodKey: periodKeyForRange(start, end) ?? undefined,
    };
}

/** Current query window → the picker's controlled value: the matching
 *  preset key when the window IS a preset (resolved against today), else
 *  `'custom'`. Pass `presets: []` when the host renders presets
 *  elsewhere (the chart header pills) and only vessels custom dates. */
export function rangeValueFromQuery(
    q: GraphQuery, presets: ReadonlyArray<DateRangePreset>, todayISO: string = isoToday(),
): DateRangeValue {
    const r = rangeFromQuery(q, todayISO);
    if (q.windowDays == null) return { preset: 'all', ...r };
    const now = noonOf(todayISO);
    for (const p of presets) {
        const res = p.resolve(now);
        if (res.start === r.start && res.end === r.end) return { preset: p.key, ...r };
    }
    return { preset: 'custom', ...r };
}

/** Compact human range for the chip ("Mar 1 – Mar 31, 2026"). */
export function shortRangeLabel(startISO: string, endISO: string): string {
    const f = (iso: string) => {
        const d = new Date(`${iso}T00:00:00Z`);
        return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
    };
    return `${f(startISO)} – ${f(endISO)}, ${endISO.slice(0, 4)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Which range-toggle option values OVERSHOOT the loaded data — the set the
 *  range popover greys out + annotates "No data". A range of N days asks to see
 *  the last N days; when the data spans FEWER than N days, that range reaches
 *  back before the data starts and shows mostly empty time — it's no more
 *  informative than the next-smaller range (and ultimately than All time).
 *
 *  Rule: grey N when `N > availableDays` (data span shorter than the range). So
 *  with 90 days of data, "1 quarter" (90) fits, but "6 months"/"1 year"/"2
 *  years" overshoot → greyed; "All time" (null) always stays (it IS "show
 *  everything", honestly sized to the data). Span is the data extent
 *  [firstDay, lastDay], independent of `asOf`. Returns empty when there are no
 *  atoms (can't judge → grey nothing). `asOf` reserved for future as-of windows
 *  but not needed for the span test. */
export function emptyRangeValuesFor(
    toggle: ToggleSpec<GraphQuery> | undefined,
    atoms: ReadonlyArray<Atom>,
    _asOf?: string,
): Set<string> {
    const empty = new Set<string>();
    if (!toggle || atoms.length === 0) return empty;
    const firstDay = Math.floor(atoms[0].key / 24);
    const lastDay = Math.floor(atoms[atoms.length - 1].key / 24);
    const availableDays = lastDay - firstDay + 1;
    for (const o of toggle.options) {
        const v = String(o.value);
        if (v === 'null') continue;                 // all-time always fits the data
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) continue;
        if (n > availableDays) empty.add(v);         // range longer than the data we have
    }
    return empty;
}

/** Human label for the chip when the query carries a calendar identity.
 *  Returns null when there's no periodKey — the picker then derives its
 *  own label from the matched preset / raw dates. */
export function periodKeyLabel(periodKey: string | undefined): string | null {
    if (!periodKey) return null;
    const m = periodKey.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?([cs])?$/);
    if (!m) return null;
    const [, yyyy, mm, dd, era] = m;
    if (era === 'c') return `${yyyy}–${parseInt(yyyy, 10) + 99}`;
    if (era === 's') return `${yyyy}s`;
    if (dd) return `${MONTHS[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}, ${yyyy}`;
    if (mm) return `${MONTHS[parseInt(mm, 10) - 1]} ${yyyy}`;
    return yyyy;
}
