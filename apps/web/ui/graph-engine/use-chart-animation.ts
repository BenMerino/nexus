/**
 * Chart animation engine — the rAF loop that drives the AnimatedFamily
 * contract for one chart instance. Time-based ease (not exponential),
 * finite-duration, interrupt-safe (mid-tween retargeting snapshots the
 * current eased state as the new origin). Per-clock durations are
 * picked by `chart-animation-setup.ts` based on directive-update
 * classification (gesture-continue / start / end / discrete).
 */

import { useEffect, useRef, useState } from 'react';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { Primitive } from './chart-primitive.types.js';
import type { ChartChrome } from './chart-chrome.types.js';
import { featurePrimitivesFor } from './graph-features/index.js';
import type { AnimatedFamily, PhaseDurations } from './animated-family.js';
import { ANIMATION_DURATION_MS, INSTANT_CLOCK_DURATION_MS, SHORT_CLOCK_DURATION_MS, SCALE_CLOCK_DURATION_MS } from './animated-family.js';
import { lerpChrome } from './chrome-lerp.js';
import {
    computePhase,
    computeCurrentEased,
    computeCurrentEasedChrome,
} from './chart-animation-phase.js';
import { classifyGesture, pickDurations } from './chart-animation-setup.js';
import { traceEvent, traceMountId } from './chart-trace.js';

export interface ChartAnimationOpts<State> {
    family: AnimatedFamily<State>;
    chart: GraphDirective;
    layout: unknown;
    /** Chrome is non-animated — computed once per directive change. */
    chrome: ChartChrome;
    /** Container width in px. Used to detect resize/relayout: when this
     *  changes, the next sample snaps without tweening so resizes don't
     *  read as data animations. */
    width: number;
    /** Container height in px — paired with `width` for resize detection. */
    height: number;
}

export interface ChartAnimationResult {
    /** Data marks (bars/lines/areas) — rendered to the bloom-enabled
     *  canvas with full DNA tuning. */
    primitives: Primitive[];
    /** Feature overlays (trendline, MA, threshold, markers, average) —
     *  rendered to a SEPARATE bloom-disabled canvas so thin annotation
     *  strokes aren't swallowed by the data marks' glow halo. Empty
     *  when no features are active. */
    featurePrimitives: Primitive[];
    chrome: ChartChrome;
}

export function useChartAnimation<State>(opts: ChartAnimationOpts<State>): ChartAnimationResult {
    const { family, chart, layout, chrome, width, height } = opts;
    /* Tween endpoints: startRef = state at tween start, targetRef =
     * what we're easing toward. Both swap atomically on target change. */
    const startRef = useRef<State | null>(null);
    const targetRef = useRef<State | null>(null);
    /* Chrome snapshots ride the same tween clock as state. On each
     * directive change we capture the CURRENT (eased) chrome as the
     * new tween start and the freshly-built chrome as the target;
     * every rAF tick produces a chrome whose label positions sit at
     * the same `eased` fraction as the marks. No CSS transitions —
     * labels and bars share one physical animation. */
    const chromeStartRef = useRef<ChartChrome | null>(null);
    const chromeTargetRef = useRef<ChartChrome | null>(null);
    const tweenStartMsRef = useRef<number>(0);
    /* Active tween durations bag. Each animated quantity has its own
     * timescale derived from the SAME wall-time elapsed but mapped
     * through its own duration — so e.g. the cursor-tracking clock can
     * finish in 60ms while the y-axis-scale clock is still gliding at
     * 400ms. Stored so mid-tween handoffs reproduce the eased state at
     * the correct per-clock alpha regardless of which mode the prior
     * tween used. */
    const tweenDurationsRef = useRef<PhaseDurations>({
        main: ANIMATION_DURATION_MS,
        instant: INSTANT_CLOCK_DURATION_MS,
        short: SHORT_CLOCK_DURATION_MS,
        scale: SCALE_CLOCK_DURATION_MS,
    });
    /* Previous frame's fold-unit. Used to detect fold-transitions
     * (where bars split or merge) during slider drag — those tweens
     * need the full duration so the split/merge animation is visible,
     * even though they originated from continuous input. Same-fold
     * slider drags stay on the short tween for tight cursor tracking. */
    const prevFoldUnitRef = useRef<string | undefined>(undefined);
    /* Gesture-scoped clocks. A "gesture" is a contiguous stream of
     * `__instantUpdate` directives (slider drag). Across a gesture the
     * tween clocks DO NOT restart — they keep accumulating wall time
     * since gesture-start, and `targetRef` keeps retargeting to the
     * latest sampled state. This makes ease-out clocks (alphaScale,
     * 400ms) actually converge instead of resetting to t=0 every drag
     * step, which is what caused the y-axis wobble: with continuous
     * retargeting + restarted clock, each step moved yDom ~11% toward
     * a different target, producing visible jitter on the steady
     * curve. The principle: the data isn't moving, only the viewport
     * is. yMax is a viewport-derived quantity that should glide on a
     * single clock per gesture, not chase its own re-targets.
     *
     * When `isInstant` flips back to false (drag end / discrete
     * transition), the gesture ends — we snapshot the current eased
     * state as the new startRef and reset the clock for a normal
     * one-shot tween. */
    const inGestureRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    /* First-render flag — used to suppress the mount-time tween. The
     * initial useState sample runs with whatever container size React
     * has at that moment (may be a default seed before useLayoutEffect
     * fires). The next effect after layout-effect-measurement carries
     * the real geometry; we snap to it instead of tweening so charts
     * never visibly grow from a stale-size corner on mount. */
    const isFirstEffectRef = useRef(true);
    /* Previous container dimensions — used to detect resize. When width
     * or height changes (initial layout settling, window resize, font
     * load, parent reflow), the chart snaps to the new geometry without
     * tweening. Tweening on resize reads as "the chart is animating its
     * data" which is misleading — resizes are presentational, not
     * semantic. Series/data changes still tween normally. */
    const prevWHRef = useRef<{ w: number; h: number }>({ w: width, h: height });

    /* TRACE: this ref is created once per MOUNT. If a legend toggle makes a
     *  NEW mountId appear, the component remounted (= the "reload": refs
     *  discarded, useState initializer re-run, snap instead of tween). */
    const mountIdRef = useRef<number>(0);
    if (mountIdRef.current === 0) mountIdRef.current = traceMountId();
    const [primitives, setPrimitives] = useState<Primitive[]>(() => {
        traceEvent('useChartAnimation MOUNT', `mountId=${mountIdRef.current} type=${(chart as { type?: string }).type ?? '?'}`);
        const t = family.sample(chart, layout);
        startRef.current = t;
        targetRef.current = t;
        chromeStartRef.current = chrome;
        chromeTargetRef.current = chrome;
        return family.primitives(t, layout, chart);
    });
    const [featurePrimitives, setFeaturePrimitives] = useState<Primitive[]>(
        () => featurePrimitivesFor(chart, layout),
    );
    const [easedChrome, setEasedChrome] = useState<ChartChrome>(chrome);

    /* Helper: updates the data layer for one frame. Feature overlays
     *  (trendline/MA/threshold/markers/average) derive only from
     *  `chart` + `layout` — never from the eased per-frame state — so
     *  they're recomputed once per directive change in a dedicated
     *  effect below, not on every rAF tick. */
    const applyFrame = (state: State) => {
        setPrimitives(family.primitives(state, layout, chart));
    };

    /* Feature primitives recompute only when the directive or layout
     *  changes, not per animation frame — they take no eased state. */
    useEffect(() => {
        setFeaturePrimitives(featurePrimitivesFor(chart, layout));
    }, [chart, layout]);

    useEffect(() => {
        const nextTarget = family.sample(chart, layout);
        const sizeChanged = prevWHRef.current.w !== width || prevWHRef.current.h !== height;
        prevWHRef.current = { w: width, h: height };
        /* First mount and resize always snap — no prior state to tween
         *  from. */
        if (isFirstEffectRef.current || sizeChanged) {
            traceEvent('anim SNAP', `mountId=${mountIdRef.current} ${isFirstEffectRef.current ? 'firstEffect' : 'sizeChanged'}`);
            isFirstEffectRef.current = false;
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            startRef.current = nextTarget;
            targetRef.current = nextTarget;
            chromeStartRef.current = chrome;
            chromeTargetRef.current = chrome;
            /* Seed prev fold-unit so the FIRST post-mount directive
             *  doesn't see `undefined → 'month'` as a fold change. */
            prevFoldUnitRef.current = (chart as { __foldUnit?: string }).__foldUnit;
            applyFrame(nextTarget);
            setEasedChrome(chrome);
            return;
        }
        /* Classify this update: gesture-continue / start / end /
         *  discrete. See `classifyGesture` and `pickDurations` in
         *  chart-animation-setup.ts for the full rules. */
        const isInstant = (chart as { __instantUpdate?: boolean }).__instantUpdate === true;
        const currentFoldUnit = (chart as { __foldUnit?: string }).__foldUnit;
        const foldChanged = prevFoldUnitRef.current !== undefined && currentFoldUnit !== prevFoldUnitRef.current;
        prevFoldUnitRef.current = currentFoldUnit;
        const gesture = classifyGesture(isInstant, foldChanged, inGestureRef.current);
        traceEvent('anim TWEEN', `mountId=${mountIdRef.current} ${gesture.continues ? 'continue' : gesture.discrete ? 'discrete' : 'start/end'} instant=${isInstant}`);
        inGestureRef.current = isInstant && !foldChanged;

        let durations: PhaseDurations;
        if (gesture.continues) {
            /* MID-GESTURE: retarget only. KEEP the existing startRef and
             *  tweenStartMsRef so clocks keep accumulating wall time
             *  toward the (continuously updated) target — one wall-clock
             *  per gesture, not per drag step. Restarting per directive
             *  produced the y-axis wobble: continuous retargeting +
             *  restarted clock moved yDom ~11% toward a different
             *  target every step. */
            targetRef.current = nextTarget;
            chromeTargetRef.current = chrome;
            durations = tweenDurationsRef.current;
        } else {
            /* GESTURE-START / END / DISCRETE: snapshot current eased
             *  state as new origin, pick fresh durations. */
            const elapsedPrev = rafRef.current != null
                ? performance.now() - tweenStartMsRef.current
                : Infinity;
            const prevDur = tweenDurationsRef.current;
            durations = pickDurations(gesture.discrete, prevDur, elapsedPrev);
            const currentEased = computeCurrentEased(
                startRef.current, targetRef.current, tweenStartMsRef.current, prevDur, family,
            );
            const currentEasedChrome = computeCurrentEasedChrome(
                chromeStartRef.current, chromeTargetRef.current, tweenStartMsRef.current, prevDur.main,
            );
            startRef.current = currentEased ?? nextTarget;
            targetRef.current = nextTarget;
            chromeStartRef.current = currentEasedChrome ?? chrome;
            chromeTargetRef.current = chrome;
            tweenStartMsRef.current = performance.now();
            tweenDurationsRef.current = durations;
        }
        const gestureContinues = gesture.continues;

        /* Paint the t=0 frame synchronously BEFORE scheduling the rAF
         *  loop. Without this, the first visible frame lands at
         *  elapsed≈16ms (one frame's delay), and entering bars appear
         *  at ~27% of their target height instead of 0% — they'd seem
         *  to materialize at an arbitrary intermediate size. The t=0
         *  sample anchors them at h=0 (or whatever their phase-0 state
         *  is); the rAF tick then grows them smoothly from there.
         *
         *  Skipped during gesture-continuation — the clocks haven't
         *  reset, the current rAF tick will paint at the correct
         *  elapsed phase on the very next frame. Painting a t=0 frame
         *  here would snap the visible state backward to the gesture-
         *  start origin and undo all the easing accumulated so far. */
        if (!gestureContinues) {
            const phase0 = computePhase(0, durations);
            const { state: state0 } = family.lerp(startRef.current, nextTarget, phase0);
            applyFrame(state0);
            if (chromeStartRef.current && chromeTargetRef.current) {
                setEasedChrome(lerpChrome(chromeStartRef.current, chromeTargetRef.current, phase0.alpha));
            }
        }

        /* Tween is "alive" until every clock has reached its own t=1.
         *  Using the max duration as the gate lets the y-axis (scale
         *  clock, ~400ms) keep gliding after the cursor (instant clock,
         *  ~60ms) has already settled. */
        const totalDuration = Math.max(durations.main, durations.instant, durations.short, durations.scale);
        const tick = (nowMs: number) => {
            const start = startRef.current;
            const target = targetRef.current;
            if (!start || !target) return;
            const elapsed = nowMs - tweenStartMsRef.current;
            const phase = computePhase(elapsed, durations);
            const { state, done } = family.lerp(start, target, phase);
            applyFrame(state);
            if (chromeStartRef.current && chromeTargetRef.current) {
                /* Chrome rides the main staged clock — label positions
                 *  are domain (x), but staging the chrome would make
                 *  axis labels phase-lag visibly behind their bars and
                 *  read as desync. Chrome stays on alpha; bars stage. */
                setEasedChrome(lerpChrome(chromeStartRef.current, chromeTargetRef.current, phase.alpha));
            }
            /* Keep ticking while EITHER any clock is still running OR
             *  the family reports it has per-element clocks not yet
             *  settled (entering/exiting bars on per-bar wall-time
             *  schedules independent of the main tween). */
            const familySettled = done !== false;
            if (elapsed < totalDuration || !familySettled) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                /* Snap to target — guarantees the tween fully completes
                 * with no residual sub-pixel drift. */
                startRef.current = target;
                chromeStartRef.current = chromeTargetRef.current;
                rafRef.current = null;
            }
        };

        if (rafRef.current == null) {
            rafRef.current = requestAnimationFrame(tick);
        }
        return () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chart, layout, family, width, height, chrome]);

    return { primitives, featurePrimitives, chrome: easedChrome };
}

