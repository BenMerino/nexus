import type { TimelineSpan } from './useTimelineSpan.js';
import { axisToIso } from './useTimelineSpan.js';

/* ── Range Slider — Pure Logic ───────────────────────────────
 * Math primitives behind ChartRangeSlider. Extracted so the React
 * component stays a thin pointer-plumbing shell over tested-able
 * functions and so the file stays under NBR-15.
 * ──────────────────────────────────────────────────────────── */

export const MIN_WINDOW_DAYS = 1;

export type DragMode = 'left' | 'right' | 'middle';
export interface DragState {
    mode: DragMode;
    /** Axis values at gesture start (so middle-drag preserves window
     * width without floating-point drift). */
    startFromAxis: number;
    startToAxis: number;
    /** Pointer fraction at gesture start; subtracted from current
     * fraction during middle-drag to compute the delta. */
    startFraction: number;
}

export function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

export function fractionFromClientX(clientX: number, trackEl: HTMLElement): number {
    const rect = trackEl.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
}

export function fractionToAxis(fraction: number, totalDays: number): number {
    return Math.round(fraction * (totalDays - 1));
}

export function axisToFraction(axis: number, totalDays: number): number {
    if (totalDays <= 1) return 0;
    return clamp(axis / (totalDays - 1), 0, 1);
}

/** Convert axis-range `[fromAxis, toAxis]` back to `{windowDays, asOf}`.
 * `windowDays = null` (all-time) when from sits at genesis AND to sits
 * at today. `asOf = null` when to sits at today (server resolves to
 * "now" so stream time-travel keeps working). */
export function axisRangeToWindow(fromAxis: number, toAxis: number, span: TimelineSpan): { windowDays: number | null; asOf: string | null } {
    const todayAxis = span.totalDays - 1;
    const isAtToday = toAxis >= todayAxis;
    const isAtGenesis = fromAxis <= 0;
    const windowDays = isAtGenesis && isAtToday ? null : Math.max(MIN_WINDOW_DAYS, toAxis - fromAxis + 1);
    const asOf = isAtToday ? null : axisToIso(toAxis, span);
    return { windowDays, asOf };
}

/** Compute the next axis range during a drag, given the gesture mode,
 * the gesture's start state, and the current pointer's axis position.
 * Pure: no DOM, no React. The component calls this on every pointermove. */
export function nextAxisRangeForDrag(
    drag: DragState,
    pointerAxis: number,
    pointerFraction: number,
    totalDays: number,
): { from: number; to: number } {
    const trackMaxAxis = totalDays - 1;
    if (drag.mode === 'left') {
        const next = clamp(pointerAxis, 0, drag.startToAxis - (MIN_WINDOW_DAYS - 1));
        return { from: next, to: drag.startToAxis };
    }
    if (drag.mode === 'right') {
        const next = clamp(pointerAxis, drag.startFromAxis + (MIN_WINDOW_DAYS - 1), trackMaxAxis);
        return { from: drag.startFromAxis, to: next };
    }
    // middle: shift both edges together, preserving width.
    const widthAxis = drag.startToAxis - drag.startFromAxis;
    const deltaFraction = pointerFraction - drag.startFraction;
    const deltaAxis = Math.round(deltaFraction * trackMaxAxis);
    const minDelta = -drag.startFromAxis;
    const maxDelta = trackMaxAxis - drag.startToAxis;
    const clamped = clamp(deltaAxis, minDelta, maxDelta);
    return { from: drag.startFromAxis + clamped, to: drag.startFromAxis + clamped + widthAxis };
}

/** Pick the gesture mode for a fresh pointerdown. Handle hits win when
 * the pointer is within `tolerance` of either handle; otherwise the
 * pointer location decides middle (inside segment) vs. nearest edge. */
export function pickDragMode(
    pointerFraction: number,
    fromFraction: number,
    toFraction: number,
    tolerance: number,
): DragMode {
    const distLeft = Math.abs(pointerFraction - fromFraction);
    const distRight = Math.abs(pointerFraction - toFraction);
    if (distLeft < tolerance && distLeft <= distRight) return 'left';
    if (distRight < tolerance) return 'right';
    if (pointerFraction < fromFraction) return 'left';
    if (pointerFraction > toFraction) return 'right';
    return 'middle';
}

/** Compact date label. ISO `YYYY-MM-DD` → `MMM 'YY` for older dates,
 * `MMM DD` for the current year. */
export function formatDateLabel(iso: string): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [yyyy, mm, dd] = iso.split('-');
    const m = parseInt(mm, 10) - 1;
    const currentYear = String(new Date().getUTCFullYear());
    if (yyyy === currentYear) return `${months[m]} ${dd}`;
    return `${months[m]} '${yyyy.slice(2)}`;
}
