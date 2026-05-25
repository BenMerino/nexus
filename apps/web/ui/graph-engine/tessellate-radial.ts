/**
 * Radial primitive tessellators — circles, arcs, annular fans. Used by
 * pie/donut/gauge/progress-ring. Extracted from `tessellate-primitives.ts`
 * so the dispatcher file stays under the line ceiling.
 */

import { writeVertex, type RGBA } from '../visual-lang/chart-vertices.js';

/** Circle smoothness — vertex count per full revolution. */
export const FAN_STEPS = 32;
/** Arc smoothness — vertices grow linearly with sweep angle. */
export const ARC_STEPS_PER_RADIAN = 16;

export function writeCircle(
    out: Float32Array,
    vIdx: number,
    cx: number, cy: number, r: number,
    strokeWidth: number | undefined,
    color: RGBA,
): number {
    if (strokeWidth) {
        const inner = Math.max(0, r - strokeWidth * 0.5);
        const outer = r + strokeWidth * 0.5;
        return writeAnnularFan(out, vIdx, cx, cy, inner, outer, 0, Math.PI * 2, color, FAN_STEPS);
    }
    let i = vIdx;
    for (let k = 0; k < FAN_STEPS; k++) {
        const a0 = (k / FAN_STEPS) * Math.PI * 2;
        const a1 = ((k + 1) / FAN_STEPS) * Math.PI * 2;
        writeVertex(out, i + 0, cx, cy, color);
        writeVertex(out, i + 1, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, color);
        writeVertex(out, i + 2, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, color);
        i += 3;
    }
    return i;
}

export function writeArc(
    out: Float32Array,
    vIdx: number,
    cx: number, cy: number,
    inner: number, outer: number,
    startAngle: number, endAngle: number,
    color: RGBA,
): number {
    const sweep = endAngle - startAngle;
    const steps = Math.max(2, Math.ceil(Math.abs(sweep) * ARC_STEPS_PER_RADIAN));
    if (inner <= 0) {
        let i = vIdx;
        for (let k = 0; k < steps; k++) {
            const t0 = startAngle + (k / steps) * sweep;
            const t1 = startAngle + ((k + 1) / steps) * sweep;
            writeVertex(out, i + 0, cx, cy, color);
            writeVertex(out, i + 1, cx + Math.cos(t0) * outer, cy + Math.sin(t0) * outer, color);
            writeVertex(out, i + 2, cx + Math.cos(t1) * outer, cy + Math.sin(t1) * outer, color);
            i += 3;
        }
        return i;
    }
    return writeAnnularFan(out, vIdx, cx, cy, inner, outer, startAngle, endAngle, color, steps);
}

export function writeAnnularFan(
    out: Float32Array,
    vIdx: number,
    cx: number, cy: number,
    inner: number, outer: number,
    startAngle: number, endAngle: number,
    color: RGBA,
    steps: number,
): number {
    let i = vIdx;
    const sweep = endAngle - startAngle;
    for (let k = 0; k < steps; k++) {
        const t0 = startAngle + (k / steps) * sweep;
        const t1 = startAngle + ((k + 1) / steps) * sweep;
        const c0x = Math.cos(t0), s0y = Math.sin(t0);
        const c1x = Math.cos(t1), s1y = Math.sin(t1);
        const ox0 = cx + c0x * outer, oy0 = cy + s0y * outer;
        const ox1 = cx + c1x * outer, oy1 = cy + s1y * outer;
        const ix0 = cx + c0x * inner, iy0 = cy + s0y * inner;
        const ix1 = cx + c1x * inner, iy1 = cy + s1y * inner;
        writeVertex(out, i + 0, ox0, oy0, color);
        writeVertex(out, i + 1, ox1, oy1, color);
        writeVertex(out, i + 2, ix0, iy0, color);
        writeVertex(out, i + 3, ox1, oy1, color);
        writeVertex(out, i + 4, ix1, iy1, color);
        writeVertex(out, i + 5, ix0, iy0, color);
        i += 6;
    }
    return i;
}
