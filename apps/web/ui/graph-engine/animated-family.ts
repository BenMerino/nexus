/**
 * Animated family contract — the engine's mathematical animation core.
 *
 * Every chart family exposes three operations:
 *
 *   sample(directive, layout) → State
 *     Pure function. From the current data, computes the family's
 *     "frame state" — the numeric values the family needs to draw
 *     itself. Bar charts return rect coords; arcs return angles and
 *     radii; etc. State is opaque to the engine.
 *
 *   lerp(prev, target, phase) → State
 *     Pure function. Eases each numeric field in `prev` toward the
 *     corresponding field in `target` using the supplied `AnimationPhase`.
 *     The phase carries five eased alphas — `alpha` (legacy single-clock,
 *     for families that don't stage dimensions), `alphaX`/`alphaY`
 *     (persistent bars: domain settles before range), `alphaEnter`
 *     (entering bars wait, then ascend), `alphaExit` (exiting bars
 *     descend, then drop). All five derive from one elapsed time so
 *     the staging IS the math made visible.
 *
 *   primitives(state, layout, directive) → Primitive[]
 *     Pure function. From an interpolated state, builds the
 *     `Primitive[]` the GPU pipeline draws. No animation logic here.
 *
 * The engine (ChartRender's rAF loop) drives the cycle:
 *
 *   1. Each frame: target = sample(currentDirective, layout)
 *   2. phase = computePhase(t) — t = elapsed / DURATION
 *   3. current = lerp(current ?? target, target, phase)
 *   4. primitives = primitives(current, layout, directive)
 *   5. If |current - target| < ε for all fields, snap and idle.
 *
 * Result: every chart family animates with the same math, the same
 * time constant, the same convergence threshold. No per-family tween
 * code — just data → state → primitive, with the state path eased.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { Primitive } from './chart-primitive.types.js';

/** Phase-shifted easing alphas for a single rAF frame.
 *
 *  Two groups of clocks:
 *
 *  STAGED (`alpha` / `alphaX` / `alphaY` / `alphaEnter` / `alphaExit`):
 *    All derived from a single main elapsed-time / duration. Used by
 *    bars and radial families. Stages the projection's two coordinate
 *    dimensions in sequence — domain (x, w) resolves FIRST, range
 *    (y, h) resolves SECOND. Inverse on hide: y descends to zero
 *    before x closes.
 *
 *  PER-QUANTITY (`alphaInstant` / `alphaShort` / `alphaScale`):
 *    Each derived from the SAME wall-time elapsed but mapped through
 *    its OWN duration — so the user's pointer (instant clock) can be
 *    at t=1.0 while the y-axis (scale clock) is still at t=0.4. Used
 *    by curve families to animate cursor-tied x positions, per-point
 *    y values, and the y-axis domain on separate timescales without
 *    interfering. Same elapsed → same phase, deterministic.
 *
 *  Families ignore whichever clocks they don't use. */
export interface AnimationPhase {
    /** Raw elapsed-time fraction in [0,1] on the MAIN clock. Passed
     *  through unmodified so families can compute per-item staggered
     *  offsets — each independent mathematical event (e.g. each
     *  entering bar) gets its own clock derived from this same raw
     *  clock. */
    tRaw: number;
    /** Legacy single-clock alpha (eased). Families that don't stage
     *  dimensions read this for full backward compatibility. */
    alpha: number;
    /** Domain phase — x and width interpolation. Runs t=0.0→0.7 of
     *  total duration. Persistent bars slide horizontally on this. */
    alphaX: number;
    /** Range phase — y and height interpolation for PERSISTENT bars.
     *  Runs t=0.45→1.0, so x finishes settling before y resolves. */
    alphaY: number;
    /** Entering bars' y-ascent — full duration t=0→1.0. Families that
     *  want a staggered cascade (each entering bar on its own clock)
     *  derive per-bar alphas from `tRaw` instead. */
    alphaEnter: number;
    /** Exiting bars' y-descent — full duration t=0→1.0. Same options
     *  as `alphaEnter`: shared clock or per-bar from `tRaw`. */
    alphaExit: number;
    /** Cursor-tracking clock — short duration (~60ms). Used for the
     *  visual quantity that must follow the user's pointer with no
     *  perceptible lag (curve xs during slider drag). Reaches 1.0
     *  long before the other clocks. */
    alphaInstant: number;
    /** Mid-duration clock (~150ms). Used for per-point y values during
     *  drag — long enough to absorb single-frame jitter, short enough
     *  that synchronized curve motion doesn't wobble like jello. */
    alphaShort: number;
    /** Axis-scale clock (~400ms). Used for the y-domain (yMax / yDom)
     *  so the chart "breathes" smoothly when peaks enter/leave the
     *  window — no flash, no clipping. Outlasts the other clocks. */
    alphaScale: number;
}

/** Per-clock wall-time durations for a single tween. Engine derives
 *  these once per directive update (from `__instantUpdate`, fold
 *  changes, discrete transitions) and passes them through to
 *  `computePhase` along with the elapsed wall time. */
export interface PhaseDurations {
    /** Duration of the STAGED main clock — drives `alpha`/`alphaX`/
     *  `alphaY`/`alphaEnter`/`alphaExit`. */
    main: number;
    /** Duration of `alphaInstant`. */
    instant: number;
    /** Duration of `alphaShort`. */
    short: number;
    /** Duration of `alphaScale`. */
    scale: number;
}

export interface AnimatedFamily<State> {
    /** Compute the family's frame state from current directive + layout. */
    sample: (chart: GraphDirective, layout: unknown) => State;
    /** Ease `prev` toward `target` by phase-shifted alphas. The phase
     *  object carries five clocks all derived from one elapsed time
     *  (see `AnimationPhase`). Returns the new state plus the maximum
     *  field-wise delta (caller uses it for convergence) and an optional
     *  `done` flag: when `false`, the family has per-element clocks
     *  still ticking (entering/exiting bars on wall-time per-bar
     *  schedules) and the engine should continue rAF beyond the main
     *  tween's `t=1` boundary. Omitted/`true` means the family is fully
     *  settled at this frame. */
    lerp: (prev: State, target: State, phase: AnimationPhase) => { state: State; maxDelta: number; done?: boolean };
    /** Build primitives from the (eased) state. */
    primitives: (state: State, layout: unknown, chart: GraphDirective) => Primitive[];
    /** Optional: returns true if the two states are sufficiently
     *  different to consider the chart "animating". When omitted the
     *  engine uses `lerp`'s maxDelta. Used for fast-path: if maxDelta
     *  is 0 on first frame, skip the rAF loop entirely. */
    isStable?: (prev: State, target: State) => boolean;
}

/** Helper: linearly interpolate two numbers and track max-delta. */
export function lerpNumber(
    prev: number, target: number, alpha: number,
    deltaRef: { value: number },
): number {
    const d = target - prev;
    const ad = Math.abs(d);
    if (ad > deltaRef.value) deltaRef.value = ad;
    return prev + d * alpha;
}

/** Helper: ease a per-index numeric track, resampling if lengths differ. */
export function lerpNumberArray(
    prev: ReadonlyArray<number>,
    target: ReadonlyArray<number>,
    alpha: number,
    deltaRef: { value: number },
): number[] {
    if (target.length === 0) return [];
    const cur = resampleNumbers(prev, target.length);
    const out: number[] = new Array(target.length);
    for (let i = 0; i < target.length; i++) {
        out[i] = lerpNumber(cur[i], target[i], alpha, deltaRef);
    }
    return out;
}

function resampleNumbers(arr: ReadonlyArray<number>, target: number): number[] {
    if (arr.length === target) return arr.slice();
    if (arr.length === 0) return new Array(target).fill(0);
    if (arr.length === 1) return new Array(target).fill(arr[0]);
    const out: number[] = new Array(target);
    const lastSrc = arr.length - 1;
    for (let i = 0; i < target; i++) {
        const t = target === 1 ? 0 : i / (target - 1);
        const srcPos = t * lastSrc;
        const lo = Math.floor(srcPos);
        const hi = Math.min(lastSrc, lo + 1);
        const frac = srcPos - lo;
        out[i] = arr[lo] + (arr[hi] - arr[lo]) * frac;
    }
    return out;
}

/** Chart-engine tween duration. Aligned with the canonical
 *  `TWEEN_DURATION_MS` in `ui/primitives/tween.ts` so weight tweens (which
 *  drive sampled targets) and geometry tweens (which interpolate frame-
 *  to-frame state toward those targets) finish on the same clock. Use a
 *  finite-duration ease, never an exponential tail — exponential decay
 *  asymptotically approaches the target and leaves a visible slow tail
 *  at the end of every animation. */
export const ANIMATION_DURATION_MS = 280;
/** Cursor-tracking clock duration. ~one frame at 60fps; the visual
 *  quantity that must read as "attached to the pointer" tweens through
 *  this so a single dropped frame doesn't cause a perceptible snap,
 *  but no further smoothing introduces lag. */
export const INSTANT_CLOCK_DURATION_MS = 60;
/** Mid-duration clock — long enough to soak up single-step jitter
 *  during slider drag, short enough that synchronized point motion
 *  doesn't compose into a perceptible wave. */
export const SHORT_CLOCK_DURATION_MS = 150;
/** Y-axis scale duration — outlasts the data clocks so the axis
 *  "breathes" under data that snaps to its new window position. The
 *  data is at rest while the axis catches up. */
export const SCALE_CLOCK_DURATION_MS = 400;
/** Convergence epsilon retained for legacy callers; the time-based tween
 *  in `useChartAnimation` snaps to target at t=1 regardless. */
export const ANIMATION_CONVERGE_EPS = 0.05;
