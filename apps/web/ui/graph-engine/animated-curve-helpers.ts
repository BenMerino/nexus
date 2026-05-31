/**
 * Shared helpers for curve families (area, stacked-area, line,
 * multi-line). Each family stores its raw values + yDom in State and
 * projects through an eased yS at primitive-build time; the same edge-
 * neighbor lerp/project logic applies across all four. Extracted here
 * so the family files stay focused on sample/lerp/primitives orchestration.
 */

import { lerpNumber } from './animated-family.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import { extrapolateAtX } from './curve-edge-neighbors.js';

/** Off-window edge-neighbor state for single-series curves. `x` is
 *  pixel-space (cursor-tied via alphaInstant). `v` is the raw bucket
 *  value (alphaShort-lerped) when the neighbor is real; undefined when
 *  extrapolated — in that case the family derives y at primitive-build
 *  time from the eased visible curve's tangent. */
export interface EdgePtState {
    x: number;
    v: number | undefined;
    extrapolated: boolean;
}

/** Stacked-area variant — per-layer cumulative top/base raw values
 *  instead of pixel ys. The family projects through the eased yS each
 *  frame. */
export interface StackedEdgePtState {
    x: number;
    topV: number | undefined;
    baseV: number | undefined;
    extrapolated: boolean;
}

/** Interpolate an optional `EdgePtState`. When either side is
 *  undefined the result is undefined — "has neighbor" vs "no neighbor"
 *  is a layout-discrete event, not a value to crossfade. */
export function lerpEdgePt(
    prev: EdgePtState | undefined,
    target: EdgePtState | undefined,
    alphaX: number, alphaV: number,
    dRef: { value: number },
): EdgePtState | undefined {
    if (!target) return undefined;
    if (!prev) return target;
    return {
        x: lerpNumber(prev.x, target.x, alphaX, dRef),
        v: target.v === undefined || prev.v === undefined
            ? target.v
            : lerpNumber(prev.v, target.v, alphaV, dRef),
        extrapolated: target.extrapolated,
    };
}

/** Stacked variant of `lerpEdgePt`. */
export function lerpStackedEdgePt(
    prev: StackedEdgePtState | undefined,
    target: StackedEdgePtState | undefined,
    alphaX: number, alphaV: number,
    dRef: { value: number },
): StackedEdgePtState | undefined {
    if (!target) return undefined;
    if (!prev) return target;
    return {
        x: lerpNumber(prev.x, target.x, alphaX, dRef),
        topV: target.topV === undefined || prev.topV === undefined
            ? target.topV : lerpNumber(prev.topV, target.topV, alphaV, dRef),
        baseV: target.baseV === undefined || prev.baseV === undefined
            ? target.baseV : lerpNumber(prev.baseV, target.baseV, alphaV, dRef),
        extrapolated: target.extrapolated,
    };
}

/** Build an edge-neighbor state entry from the directive's payload.
 *  `xCenter` is normalized over the plot; we project to pixel space
 *  here. `value` becomes `v` for real neighbors; extrapolated ones
 *  leave `v` undefined and the family infers y at primitive-build time. */
export function makeEdgePt(
    neighbor: { xCenter: number; value: number; isExtrapolated: boolean } | undefined,
    layout: CartesianLayout,
): EdgePtState | undefined {
    if (!neighbor) return undefined;
    const plotW = layout.xR[1] - layout.xR[0];
    return {
        x: layout.xR[0] + neighbor.xCenter * plotW,
        v: neighbor.isExtrapolated ? undefined : neighbor.value,
        extrapolated: neighbor.isExtrapolated,
    };
}

/** Resolve an edge-neighbor to pixel-space (x, y) given the currently-
 *  eased yS and the visible curve's xs/ys (for extrapolation fallback).
 *
 *  `floorY` (optional) is the pixel row of the value floor — for AREA
 *  families this is `yS(0)`, the band's baseline. When given, an
 *  EXTRAPOLATED edge is clamped so it can never project BELOW the floor
 *  (larger pixel-y = lower value, so we cap y at floorY). Without this,
 *  a declining trailing series linearly extrapolates past zero and the
 *  area renders a negative dip beyond the last real bucket — the "future
 *  goes negative" artifact. Real (non-extrapolated) neighbors carry a
 *  true value and are never clamped; line families pass no floor so they
 *  keep legitimate sub-zero values. */
export function projectEdgePt(
    pt: EdgePtState | undefined,
    yS: (v: number) => number,
    visibleXs: number[],
    visibleYs: number[],
    side: 'left' | 'right',
    floorY?: number,
): { x: number; y: number } | undefined {
    if (!pt) return undefined;
    if (!pt.extrapolated && pt.v !== undefined) return { x: pt.x, y: yS(pt.v) };
    const y = extrapolateAtX(visibleXs, visibleYs, side, pt.x);
    if (y === undefined) return undefined;
    return { x: pt.x, y: floorY === undefined ? y : Math.min(y, floorY) };
}
