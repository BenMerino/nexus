/**
 * Gap- and dash-aware curve segmentation for line / multi-line / area
 * families. The pre-atomic engine built ONE polyline (lead + visible +
 * tail) and smoothed/clipped it whole. That assumption breaks for two
 * new cases:
 *
 *   - NULL GAPS — a `defined:false` bucket means "no data here": the
 *     curve must break, not dip to baseline. Smoothing across a gap
 *     would draw a phantom monotone-cubic arc through the void.
 *   - DASH RUNS — when adjacent buckets carry a different dash (e.g.
 *     solid observed history → dashed projected tail), the stroke must
 *     split at the boundary so each run gets its own dash primitive.
 *
 * `buildCurveSegments` partitions the per-bucket points into contiguous
 * RUNS, breaking on both signals, and smooths + clips each run on its
 * own so the spline never crosses a gap. Lead/tail edge neighbors attach
 * to the first/last run only (they continue the visible curve's ends).
 *
 * Pure geometry, no GL. The caller turns each `CurveSegment` into one
 * polyline primitive (with its `dash`).
 */

import { smoothPoints } from './curve-sampling.js';
import { clipPolylineX } from './curve-edge-neighbors.js';
import { projectEdgePt, type EdgePtState } from './animated-curve-helpers.js';

type Pt = { x: number; y: number };

/** One render run: a smoothed+clipped point list ready to become a
 *  polyline primitive, plus the dash it should carry. */
export interface CurveSegment {
    points: Pt[];
    dash?: [number, number];
}

/** Per-bucket input point. `defined:false` ⇒ a gap (the point is
 *  omitted and terminates the current run). `dash` is the bucket's
 *  resolved stroke pattern; a change between adjacent buckets starts a
 *  new run. */
export interface SegPoint {
    x: number;
    y: number;
    defined: boolean;
    dash?: [number, number];
}

function sameDash(a?: [number, number], b?: [number, number]): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a[0] === b[0] && a[1] === b[1];
}

/** Partition `pts` into runs (breaking at gaps + dash boundaries),
 *  smooth + clip each, and return the renderable segments. `lead`/`tail`
 *  attach to the first/last run respectively. `xMin`/`xMax` clip every
 *  run to the plot rect. A run of a single point is dropped (no line
 *  possible) — the caller still draws its marker separately. */
export function buildCurveSegments(
    pts: ReadonlyArray<SegPoint>,
    lead: Pt | undefined,
    tail: Pt | undefined,
    xMin: number,
    xMax: number,
): CurveSegment[] {
    /* 1. Split the defined points into raw runs. A run is a maximal
     *    stretch of consecutive defined points sharing one dash. */
    const rawRuns: { points: Pt[]; dash?: [number, number] }[] = [];
    let cur: { points: Pt[]; dash?: [number, number] } | null = null;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!p.defined) { cur = null; continue; }   // gap — terminate run
        if (cur && sameDash(cur.dash, p.dash)) {
            cur.points.push({ x: p.x, y: p.y });
        } else {
            cur = { points: [{ x: p.x, y: p.y }], dash: p.dash };
            rawRuns.push(cur);
        }
    }
    if (rawRuns.length === 0) return [];

    /* 2. Attach edge neighbors to the boundary runs ONLY. They extend
     *    the visible curve's ends toward off-window data; attaching to
     *    an interior run (across a gap) would be wrong. */
    if (lead) rawRuns[0].points.unshift(lead);
    if (tail) rawRuns[rawRuns.length - 1].points.push(tail);

    /* 3. Smooth + clip each run independently — the spline stays
     *    confined to real data, never bridging a gap. */
    const out: CurveSegment[] = [];
    for (const run of rawRuns) {
        if (run.points.length < 2) continue;        // lone point → marker only
        const clipped = clipPolylineX(smoothPoints(run.points), xMin, xMax);
        if (clipped.length >= 2) out.push({ points: clipped, dash: run.dash });
    }
    return out;
}

/** Full per-curve build shared by line + multi-line. Projects edge
 *  neighbors from the DEFINED points only (a gap at the edge mustn't
 *  seed the projection), assembles `SegPoint[]` from the pixel xs/ys +
 *  presence + per-bucket dash, and returns the renderable segments.
 *  Keeps the families thin and the gap/edge logic in one place. */
export function curveSegmentsFor(
    xs: ReadonlyArray<number>,
    ys: ReadonlyArray<number>,
    defined: ReadonlyArray<boolean>,
    dashByBucket: ReadonlyArray<[number, number] | undefined>,
    yS: (v: number) => number,
    leadPt: EdgePtState | undefined,
    tailPt: EdgePtState | undefined,
    xMin: number,
    xMax: number,
): CurveSegment[] {
    const defIdx: number[] = [];
    for (let i = 0; i < defined.length; i++) if (defined[i] !== false) defIdx.push(i);
    const dxs = defIdx.map(i => xs[i]);
    const dys = defIdx.map(i => ys[i]);
    const lead = defIdx.length ? projectEdgePt(leadPt, yS, dxs, dys, 'left') : undefined;
    const tail = defIdx.length ? projectEdgePt(tailPt, yS, dxs, dys, 'right') : undefined;
    const segPts: SegPoint[] = xs.map((x, i) => ({ x, y: ys[i], defined: defined[i], dash: dashByBucket[i] }));
    return buildCurveSegments(segPts, lead, tail, xMin, xMax);
}
