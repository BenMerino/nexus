/* ── Window-picker pure logic ────────────────────────────────
 * Date math + preset mapping for WindowPickerMolecule. No React.
 * The named presets replace the old "1w"-style labels: each maps a
 * windowDays span to a calendar-natural name. "Custom" is the escape
 * hatch — any window that matches no preset (e.g. a start+end range
 * picked from the calendar) reads as Custom.
 * ──────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;

/** Named window presets. `days = null` is all-time. Order = display order.
 *  Spans mirror the prior ladder (7/30/91/365) but read as names, not "1w". */
export interface WindowPreset {
    id: string;
    label: string;
    days: number | null;
}

export const WINDOW_PRESETS: WindowPreset[] = [
    { id: 'week', label: 'Week', days: 7 },
    { id: 'month', label: 'Month', days: 30 },
    { id: 'quarter', label: 'Quarter', days: 91 },
    { id: 'year', label: 'Year', days: 365 },
    { id: 'all', label: 'All', days: null },
];

export const CUSTOM_ID = 'custom';

/** Which preset id does the current window match? A preset matches when
 *  its `days` equals the window AND the window ends at "now" (asOf null) —
 *  a preset is always a trailing window to today. Anything else (a fixed
 *  asOf, or an off-ladder span) is Custom. */
export function activePresetId(windowDays: number | null, asOf: string | null): string {
    if (asOf != null) return CUSTOM_ID; // anchored end ⇒ not a trailing preset
    const hit = WINDOW_PRESETS.find(p => p.days === windowDays);
    return hit ? hit.id : CUSTOM_ID;
}

/** Inclusive day-count between two ISO dates (`start`..`end`). */
export function spanDays(startISO: string, endISO: string): number {
    const s = Date.parse(`${startISO}T00:00:00Z`);
    const e = Date.parse(`${endISO}T00:00:00Z`);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 1;
    return Math.max(1, Math.round((e - s) / DAY_MS) + 1);
}

/** Order a picked [a, b] pair into [start, end] (earlier first). */
export function orderRange(a: string, b: string): [string, string] {
    return Date.parse(`${a}T00:00:00Z`) <= Date.parse(`${b}T00:00:00Z`) ? [a, b] : [b, a];
}

/** Human label for a custom range — "Apr 3 – Jun 10, 2026" style, collapsing
 *  the year when both ends share it. Used for the picker's collapsed summary. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function rangeLabel(startISO: string, endISO: string): string {
    const s = new Date(`${startISO}T00:00:00Z`);
    const e = new Date(`${endISO}T00:00:00Z`);
    const sY = s.getUTCFullYear();
    const eY = e.getUTCFullYear();
    const sPart = `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}`;
    const ePart = `${MONTHS[e.getUTCMonth()]} ${e.getUTCDate()}, ${eY}`;
    return sY === eY ? `${sPart} – ${ePart}` : `${sPart}, ${sY} – ${ePart}`;
}
