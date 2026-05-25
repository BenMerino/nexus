/**
 * Per-directive tween-setup logic for `useChartAnimation`. Extracted
 * to keep the hook file focused on the rAF loop and React lifecycle.
 *
 * Two pure helpers:
 *   - `classifyGesture` — given previous/current `__instantUpdate` and
 *     fold-unit state, classify this update as gesture-continue,
 *     gesture-start, gesture-end, or discrete. The engine uses this to
 *     decide whether to keep the existing clock origin or reset it.
 *   - `pickDurations` — choose the per-clock durations for this tween
 *     given the gesture classification, then preserve any in-flight
 *     longer durations so a long tween that just started doesn't get
 *     truncated by a quickly-following short one.
 */

import {
    ANIMATION_DURATION_MS,
    INSTANT_CLOCK_DURATION_MS,
    SHORT_CLOCK_DURATION_MS,
    SCALE_CLOCK_DURATION_MS,
    type PhaseDurations,
} from './animated-family.js';

export interface GestureClassification {
    /** True when this is a continuous-input directive (same fold) AND
     *  a gesture was already in flight. The engine should retarget
     *  only, not reset clocks. */
    continues: boolean;
    /** True when a gesture is starting this frame. Engine resets
     *  clocks but expects more `__instantUpdate` frames to follow. */
    starting: boolean;
    /** True when a gesture just ended (drag-end snap). Engine runs a
     *  normal discrete tween to settle. */
    ending: boolean;
    /** True for any tween that is not a gesture-continuation —
     *  caller resets clocks. */
    discrete: boolean;
}

export function classifyGesture(
    isInstant: boolean,
    foldChanged: boolean,
    wasInGesture: boolean,
): GestureClassification {
    const continues = isInstant && !foldChanged && wasInGesture;
    const starting = isInstant && !foldChanged && !wasInGesture;
    const ending = !isInstant && wasInGesture;
    const discrete = !isInstant || foldChanged;
    return { continues, starting, ending, discrete };
}

/** Nominal per-clock durations for a tween that isn't a gesture
 *  continuation. Discrete transitions use the full
 *  `ANIMATION_DURATION_MS` for every clock; same-fold drag uses the
 *  per-quantity ergonomic timescales. */
function nominalDurations(isDiscrete: boolean): PhaseDurations {
    if (isDiscrete) {
        return {
            main: ANIMATION_DURATION_MS,
            instant: ANIMATION_DURATION_MS,
            short: ANIMATION_DURATION_MS,
            scale: ANIMATION_DURATION_MS,
        };
    }
    return {
        main: INSTANT_CLOCK_DURATION_MS,
        instant: INSTANT_CLOCK_DURATION_MS,
        short: SHORT_CLOCK_DURATION_MS,
        scale: SCALE_CLOCK_DURATION_MS,
    };
}

/** Choose this tween's per-clock durations. Preserves in-flight long
 *  tweens during fast drag: if the previous tween still has remaining
 *  time, the new tween inherits the longer of "remaining prev time"
 *  vs "this tween's nominal duration". Without this, rapid drag
 *  updates (each 60ms) would repeatedly truncate the 280ms fold-split
 *  animation back to nearly nothing — bars freeze near their pre-fold
 *  positions until the user slows down. */
export function pickDurations(
    isDiscrete: boolean,
    prevDur: PhaseDurations,
    elapsedSincePrev: number,
): PhaseDurations {
    const nominal = nominalDurations(isDiscrete);
    const remaining = (d: number) => Math.max(0, d - elapsedSincePrev);
    return {
        main: Math.max(nominal.main, remaining(prevDur.main)),
        instant: Math.max(nominal.instant, remaining(prevDur.instant)),
        short: Math.max(nominal.short, remaining(prevDur.short)),
        scale: Math.max(nominal.scale, remaining(prevDur.scale)),
    };
}
