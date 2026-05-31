/**
 * Per-point markers for curve families (line, multi-line, area). A
 * marker's treatment comes from the bucket's resolved status style:
 * filled (observed), hollow (estimated/partial), or none (projected /
 * default line). Shared so each family file stays focused and under
 * NBR-15.
 *
 * Markers sit at the RAW data points (not the smoothed/clipped curve) —
 * they mark buckets, not spline samples. Gap buckets (`defined:false`)
 * get no marker. Points outside the plot x-range are skipped (clipped-
 * out edge neighbors have no bucket).
 */

import type { Primitive, CirclePrimitive } from './chart-primitive.types.js';
import { statusStyle } from './datum-status-style.js';
import type { DatumStatus } from '../../architect/fold-atoms.js';

const MARKER_R = 2.5;
const HOLLOW_STROKE = 1.5;

/** Append one circle per visible, defined point whose status calls for a
 *  marker. `xs`/`ys` are pixel coords; `statuses`/`defined` are parallel
 *  arrays. `opacity` (multi-line series weight) fades markers with their
 *  line. Mutates `out`. */
export function appendMarkers(
    out: Primitive[],
    xs: ReadonlyArray<number>,
    ys: ReadonlyArray<number>,
    statuses: ReadonlyArray<DatumStatus>,
    defined: ReadonlyArray<boolean>,
    color: string,
    xMin: number,
    xMax: number,
    opacity = 1,
): void {
    for (let i = 0; i < xs.length; i++) {
        if (defined[i] === false) continue;
        const x = xs[i];
        if (x < xMin || x > xMax) continue;
        const marker = statusStyle(statuses[i]).marker;
        if (marker === 'none') continue;
        const c: CirclePrimitive = {
            kind: 'circle',
            cx: x,
            cy: ys[i],
            r: MARKER_R,
            color,
            opacity,
            data: undefined,
        };
        if (marker === 'hollow') c.strokeWidth = HOLLOW_STROKE;
        out.push(c);
    }
}
