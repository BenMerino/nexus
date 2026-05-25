/**
 * Phase helpers for `useChartAnimation`. Extracted to keep the hook
 * file focused on the rAF loop and lifecycle. Three pure functions:
 *
 *   - `computePhase(elapsedMs, durations)` — derives every phase clock
 *     from one wall-time elapsed by mapping it through each clock's
 *     own duration. The STAGED clocks share the `main` duration; the
 *     PER-QUANTITY clocks (`alphaInstant` / `alphaShort` / `alphaScale`)
 *     each use their own. Same elapsed + same durations → same phase.
 *   - `computeCurrentEased` — mid-tween state snapshot for handoff
 *     when a new directive arrives before the current tween finishes.
 *   - `computeCurrentEasedChrome` — same handoff, but for chrome.
 */

import { easeOutCubic } from '../primitives/tween.js';
import type { ChartChrome } from './chart-chrome.types.js';
import type {
    AnimatedFamily, AnimationPhase, PhaseDurations,
} from './animated-family.js';
import { lerpChrome } from './chrome-lerp.js';

/** Legacy alias retained for any out-of-tree caller. Prefer
 *  `INSTANT_CLOCK_DURATION_MS` from `animated-family.ts`. */
export const INSTANT_TWEEN_DURATION_MS = 60;

/** Derive every phase clock from one wall-time elapsed + per-clock
 *  durations. Pure.
 *
 *  Math → animation mapping.
 *   - PERSISTENT bars: two events (domain x,w / range y,h) → alphaX
 *     leads, alphaY follows. The user sees "where" land before "how
 *     much" computes.
 *   - ENTERING bars: one event (appearance) → alphaEnter spans full.
 *   - EXITING bars: one event (disappearance) → alphaExit spans full.
 *   - PER-QUANTITY: each clock advances at its own rate, so e.g. the
 *     y-axis (alphaScale, ~400ms) keeps gliding after the cursor
 *     (alphaInstant, ~60ms) has already settled. */
export function computePhase(
    elapsedMs: number,
    durations: PhaseDurations,
): AnimationPhase {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const tMain = durations.main > 0 ? clamp(elapsedMs / durations.main) : 1;
    const tInstant = durations.instant > 0 ? clamp(elapsedMs / durations.instant) : 1;
    const tShort = durations.short > 0 ? clamp(elapsedMs / durations.short) : 1;
    const tScale = durations.scale > 0 ? clamp(elapsedMs / durations.scale) : 1;
    return {
        tRaw: tMain,
        alpha: easeOutCubic(tMain),
        alphaX: easeOutCubic(clamp(tMain / 0.7)),
        alphaY: easeOutCubic(clamp((tMain - 0.45) / 0.55)),
        alphaEnter: easeOutCubic(tMain),
        alphaExit: easeOutCubic(tMain),
        alphaInstant: easeOutCubic(tInstant),
        alphaShort: easeOutCubic(tShort),
        alphaScale: easeOutCubic(tScale),
    };
}

/** Reproduce the current eased chrome for handoff when a new target
 *  arrives mid-tween. Returns null on first run. Chrome rides the main
 *  staged clock — labels and bars share one physical animation, so the
 *  caller passes the main duration directly. */
export function computeCurrentEasedChrome(
    start: ChartChrome | null,
    target: ChartChrome | null,
    tweenStartMs: number,
    mainDurationMs: number,
): ChartChrome | null {
    if (!start || !target) return null;
    const elapsed = performance.now() - tweenStartMs;
    const t = Math.min(1, elapsed / mainDurationMs);
    return lerpChrome(start, target, easeOutCubic(t));
}

/** Reproduce the current eased state for handoff when a new target
 *  arrives mid-tween. Returns null on first run (no prior state). */
export function computeCurrentEased<State>(
    start: State | null,
    target: State | null,
    tweenStartMs: number,
    durations: PhaseDurations,
    family: AnimatedFamily<State>,
): State | null {
    if (!start || !target) return null;
    const elapsed = performance.now() - tweenStartMs;
    return family.lerp(start, target, computePhase(elapsed, durations)).state;
}
