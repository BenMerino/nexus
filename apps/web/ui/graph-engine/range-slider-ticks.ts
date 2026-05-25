/* ── Range Slider Ticks ──────────────────────────────────────
 * Generates tiered tick positions for `ChartRangeSlider`'s track:
 * a minor unit auto-picked from the timeline span, plus emphasized
 * major boundaries one step coarser. Pure date math — returns
 * normalized [0,1] fractions along the track, parallel to how the
 * slider draws handles and labels.
 *
 * Auto-pick policy aims for ~10–30 minor ticks across the track:
 *   span ≤ 90 days   → day minors,   week majors
 *   span ≤ 1 year    → week minors,  month majors
 *   span ≤ 3 years   → month minors, quarter majors
 *   span ≤ 8 years   → quarter minors, year majors
 *   span > 8 years   → year minors,  no major tier
 * ──────────────────────────────────────────────────────────── */

export type TickUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface SliderTick {
    /** Fractional position along the track, [0,1]. */
    fraction: number;
    /** `true` when this tick sits at a major-unit boundary. */
    major: boolean;
}

/** Auto-pick `(minor, major | null)` from total span in days. */
export function pickTickUnits(totalDays: number): { minor: TickUnit; major: TickUnit | null } {
    if (totalDays <= 90) return { minor: 'day', major: 'week' };
    if (totalDays <= 365) return { minor: 'week', major: 'month' };
    if (totalDays <= 365 * 3) return { minor: 'month', major: 'quarter' };
    if (totalDays <= 365 * 8) return { minor: 'quarter', major: 'year' };
    return { minor: 'year', major: null };
}

/** Generate tick positions for a `[earliestISO, today]` span. Ticks
 *  land at the START of each unit boundary in UTC. Endpoints (fraction
 *  0 and 1) are not emitted — the slider track already has visible
 *  edges. The `major` flag piggybacks the next-coarser unit so callers
 *  can style boundary ticks differently. */
export function generateTicks(
    earliestISO: string,
    totalDays: number,
): SliderTick[] {
    const { minor, major } = pickTickUnits(totalDays);
    const startMs = Date.parse(`${earliestISO}T00:00:00Z`);
    if (!Number.isFinite(startMs) || totalDays <= 1) return [];
    const spanMs = totalDays * 86_400_000;
    const out: SliderTick[] = [];
    /* Walk forward by minor unit. Start at the first boundary STRICTLY
     *  after `earliestISO` so the leftmost track edge stays clean. */
    let cursor = nextBoundary(startMs, minor);
    /* Safety cap so a misconfigured span can't infinite-loop. */
    const HARD_CAP = 500;
    while (cursor < startMs + spanMs && out.length < HARD_CAP) {
        const fraction = (cursor - startMs) / spanMs;
        if (fraction > 0.001 && fraction < 0.999) {
            const isMajor = major !== null && atUnitStart(cursor, major);
            out.push({ fraction, major: isMajor });
        }
        cursor = advance(cursor, minor);
    }
    return out;
}

/** Return the timestamp of the next boundary at-or-after `ms` for `unit`. */
function nextBoundary(ms: number, unit: TickUnit): number {
    const d = new Date(ms);
    const aligned = alignedStart(d, unit);
    if (aligned.getTime() <= ms) return advance(aligned.getTime(), unit);
    return aligned.getTime();
}

/** UTC unit-start: zeroes lower-order fields. */
function alignedStart(d: Date, unit: TickUnit): Date {
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const day = d.getUTCDate();
    const dow = d.getUTCDay(); /* 0 = Sun */
    switch (unit) {
        case 'day':     return new Date(Date.UTC(y, mo, day));
        case 'week':    return new Date(Date.UTC(y, mo, day - ((dow + 6) % 7))); /* Monday */
        case 'month':   return new Date(Date.UTC(y, mo, 1));
        case 'quarter': return new Date(Date.UTC(y, Math.floor(mo / 3) * 3, 1));
        case 'year':    return new Date(Date.UTC(y, 0, 1));
    }
}

/** Advance `ms` by one `unit`, UTC. */
function advance(ms: number, unit: TickUnit): number {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const day = d.getUTCDate();
    switch (unit) {
        case 'day':     return Date.UTC(y, mo, day + 1);
        case 'week':    return Date.UTC(y, mo, day + 7);
        case 'month':   return Date.UTC(y, mo + 1, day);
        case 'quarter': return Date.UTC(y, mo + 3, day);
        case 'year':    return Date.UTC(y + 1, mo, day);
    }
}

/** Is `ms` exactly at a `unit`-start boundary? Used to tag minor ticks
 *  that coincide with a major boundary so callers can style them. */
function atUnitStart(ms: number, unit: TickUnit): boolean {
    return alignedStart(new Date(ms), unit).getTime() === ms;
}
