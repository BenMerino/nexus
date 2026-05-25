/**
 * Polyline stroke tessellation — triangle-strip with miter joins and
 * bevel fallback at sharp turns. Used by line/multi-line chart
 * strokes; produces a clean stroke without visible spikes at sharp
 * data peaks.
 */

import { writeVertex, type RGBA } from './chart-vertices.js';

/** Maximum miter scale before falling back to a bevel join. The miter
 *  scale is `1/cos(θ/2)` where θ is the exterior angle; at θ ≈ 158° the
 *  scale hits ~5.7. Beyond that the miter spike is visually wrong, so
 *  bevel handles the joint instead. */
const MITER_LIMIT = 4;

/** Tessellate a polyline as a stroke. Each segment is two triangles
 *  between perpendicular offset pairs. Interior joints are mitered when
 *  the bisector miter length stays under `MITER_LIMIT`; sharper turns
 *  fall back to bevel — the two segments end at their own offset
 *  vertices, and one extra triangle bridges the gap. Caps are butt.
 *
 *  Triangle count per polyline = `polylineStrokeTriangles(points)`.
 *  Buffer-size estimation in `ChartGeometryCanvas.trianglesFor` uses
 *  the same function so no over- or under-allocation. */
export function writePolylineStroke(
    out: Float32Array,
    vIdx: number,
    points: ReadonlyArray<{ x: number; y: number }>,
    strokeWidth: number,
    color: RGBA,
): number {
    if (points.length < 2) return vIdx;
    const half = strokeWidth * 0.5;

    /* Per-vertex offset pair. For mitered joints, `outerL/R` is unset
     * (== inner). For bevel joints, `outer` is the offset on the
     * outgoing-segment side; `inner` is the bend's inner side that all
     * geometry sharing the joint can use. */
    interface Joint {
        cx: number; cy: number;
        innerLX: number; innerLY: number;
        innerRX: number; innerRY: number;
        bevel: boolean;
        bevelInLX: number; bevelInLY: number; bevelInRX: number; bevelInRY: number;
        bevelOutLX: number; bevelOutLY: number; bevelOutRX: number; bevelOutRY: number;
        /** True when the joint bends toward the LEFT side (left side is
         *  inner; right side is outer/exterior). False when bend is
         *  toward right. Determines which triangle pair the bevel emits. */
        bendLeft: boolean;
    }
    const joints: Joint[] = [];
    for (let i = 0; i < points.length; i++) {
        const prev = i > 0 ? points[i - 1] : null;
        const cur = points[i];
        const next = i < points.length - 1 ? points[i + 1] : null;
        if (!prev) {
            /* Start cap: butt — perpendicular to outgoing segment. */
            const dx = next!.x - cur.x, dy = next!.y - cur.y;
            const l = Math.hypot(dx, dy) || 1;
            const nx = -dy / l, ny = dx / l;
            joints.push(simpleJoint(cur, nx, ny, half));
            continue;
        }
        if (!next) {
            /* End cap: butt — perpendicular to incoming segment. */
            const dx = cur.x - prev.x, dy = cur.y - prev.y;
            const l = Math.hypot(dx, dy) || 1;
            const nx = -dy / l, ny = dx / l;
            joints.push(simpleJoint(cur, nx, ny, half));
            continue;
        }
        const d1x = cur.x - prev.x, d1y = cur.y - prev.y;
        const l1 = Math.hypot(d1x, d1y) || 1;
        const n1x = -d1y / l1, n1y = d1x / l1;
        const d2x = next.x - cur.x, d2y = next.y - cur.y;
        const l2 = Math.hypot(d2x, d2y) || 1;
        const n2x = -d2y / l2, n2y = d2x / l2;
        let mx = n1x + n2x, my = n1y + n2y;
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml; my /= ml;
        const dot = mx * n1x + my * n1y;
        const miterScale = dot > 0.0001 ? 1 / dot : Infinity;
        if (miterScale <= MITER_LIMIT) {
            /* Miter: bisector scaled so the offset distance stays half-width. */
            const nx = mx * miterScale, ny = my * miterScale;
            joints.push(simpleJoint(cur, nx, ny, half));
        } else {
            /* Bevel: each segment owns its own offset pair at this
             * joint; a triangle bridges the outer corners. The "bend
             * direction" is the sign of the cross-product of incoming
             * and outgoing segments — positive cross (in y-down screen
             * coords) means a clockwise turn → bend toward the LEFT
             * side of motion (where left is the +n direction). */
            const bendLeft = (d1x * d2y - d1y * d2x) < 0;
            joints.push({
                cx: cur.x, cy: cur.y,
                /* Inner side: snap both segments to the bisector at
                 * full half-width (no miter inflation) so the inside of
                 * the bend stays clean. Cap miter at MITER_LIMIT to
                 * avoid the same spike on the inner side. */
                innerLX: cur.x + mx * half, innerLY: cur.y + my * half,
                innerRX: cur.x - mx * half, innerRY: cur.y - my * half,
                bevel: true,
                /* Outer-side offsets per segment: each segment butts
                 * against its own perpendicular at this vertex. */
                bevelInLX: cur.x + n1x * half, bevelInLY: cur.y + n1y * half,
                bevelInRX: cur.x - n1x * half, bevelInRY: cur.y - n1y * half,
                bevelOutLX: cur.x + n2x * half, bevelOutLY: cur.y + n2y * half,
                bevelOutRX: cur.x - n2x * half, bevelOutRY: cur.y - n2y * half,
                bendLeft,
            });
        }
    }

    let i = vIdx;
    for (let k = 0; k < joints.length - 1; k++) {
        const a = joints[k];
        const b = joints[k + 1];
        /* Segment quad: from a's outgoing-side offsets to b's
         * incoming-side offsets. For mitered joints the "in" pair == the
         * stored inner pair (no second pair stored); we read accordingly. */
        const aL = a.bevel
            ? { x: a.bevelOutLX, y: a.bevelOutLY }
            : { x: a.innerLX, y: a.innerLY };
        const aR = a.bevel
            ? { x: a.bevelOutRX, y: a.bevelOutRY }
            : { x: a.innerRX, y: a.innerRY };
        const bL = b.bevel
            ? { x: b.bevelInLX, y: b.bevelInLY }
            : { x: b.innerLX, y: b.innerLY };
        const bR = b.bevel
            ? { x: b.bevelInRX, y: b.bevelInRY }
            : { x: b.innerRX, y: b.innerRY };
        writeVertex(out, i + 0, aL.x, aL.y, color);
        writeVertex(out, i + 1, bL.x, bL.y, color);
        writeVertex(out, i + 2, aR.x, aR.y, color);
        writeVertex(out, i + 3, bL.x, bL.y, color);
        writeVertex(out, i + 4, bR.x, bR.y, color);
        writeVertex(out, i + 5, aR.x, aR.y, color);
        i += 6;
        /* Bevel-fill triangle at vertex b (when b is a bevel joint, AND
         * b is not the polyline endpoint). Bridges the outer corner of
         * the incoming segment to the outer corner of the outgoing
         * segment, around the joint center. The "outer" corner is on
         * whichever side the bend is NOT toward. */
        if (b.bevel && k + 1 < joints.length - 1) {
            if (b.bendLeft) {
                /* Bend toward LEFT → RIGHT side is the outer corner. */
                writeVertex(out, i + 0, b.cx, b.cy, color);
                writeVertex(out, i + 1, b.bevelInRX, b.bevelInRY, color);
                writeVertex(out, i + 2, b.bevelOutRX, b.bevelOutRY, color);
            } else {
                writeVertex(out, i + 0, b.cx, b.cy, color);
                writeVertex(out, i + 1, b.bevelOutLX, b.bevelOutLY, color);
                writeVertex(out, i + 2, b.bevelInLX, b.bevelInLY, color);
            }
            i += 3;
        }
    }
    return i;
}

function simpleJoint(
    cur: { x: number; y: number },
    nx: number, ny: number,
    half: number,
): {
    cx: number; cy: number;
    innerLX: number; innerLY: number;
    innerRX: number; innerRY: number;
    bevel: false;
    bevelInLX: 0; bevelInLY: 0; bevelInRX: 0; bevelInRY: 0;
    bevelOutLX: 0; bevelOutLY: 0; bevelOutRX: 0; bevelOutRY: 0;
    bendLeft: false;
} {
    return {
        cx: cur.x, cy: cur.y,
        innerLX: cur.x + nx * half, innerLY: cur.y + ny * half,
        innerRX: cur.x - nx * half, innerRY: cur.y - ny * half,
        bevel: false,
        bevelInLX: 0, bevelInLY: 0, bevelInRX: 0, bevelInRY: 0,
        bevelOutLX: 0, bevelOutLY: 0, bevelOutRX: 0, bevelOutRY: 0,
        bendLeft: false,
    };
}

/** Triangle count for a polyline stroke. Used by ChartGeometryCanvas's
 *  buffer-size estimator (which must match the actual tessellator output
 *  exactly, or the buffer is the wrong size). Mirrors the bevel logic
 *  in writePolylineStroke. */
export function polylineStrokeTriangles(
    points: ReadonlyArray<{ x: number; y: number }>,
): number {
    if (points.length < 2) return 0;
    let segs = (points.length - 1) * 2;
    /* Bevel triangles: only at INTERIOR joints (k+1 < joints.length-1). */
    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1], cur = points[i], next = points[i + 1];
        const d1x = cur.x - prev.x, d1y = cur.y - prev.y;
        const l1 = Math.hypot(d1x, d1y) || 1;
        const n1x = -d1y / l1, n1y = d1x / l1;
        const d2x = next.x - cur.x, d2y = next.y - cur.y;
        const l2 = Math.hypot(d2x, d2y) || 1;
        const n2x = -d2y / l2, n2y = d2x / l2;
        let mx = n1x + n2x, my = n1y + n2y;
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml; my /= ml;
        const dot = mx * n1x + my * n1y;
        const miterScale = dot > 0.0001 ? 1 / dot : Infinity;
        if (miterScale > MITER_LIMIT) segs += 1;
    }
    return segs;
}
