/**
 * Hover-rail helper shared by the curve families (line, multi-line,
 * area, stacked-area). Emits invisible vertical strips spanning the
 * plot height — one per x position, half-width at the midpoint to each
 * neighbour — so users don't need pinpoint vertical aim. Each rail
 * carries family-defined hover metadata via `makeData(i)`.
 */

import type { Primitive } from './chart-primitive.types.js';

export function appendHoverRails(
    out: Primitive[],
    xs: number[],
    plotYR: [number, number],
    makeData: (i: number) => unknown,
    ys?: ReadonlyArray<number>,
): void {
    const n = xs.length;
    /* n < 2: the neighbour-midpoint math below reads xs[1]/xs[n-2] —
     *  a single-point curve produced NaN-coordinate hit rects (multi-
     *  line/stacked-area called in unguarded on one-bucket windows). A
     *  lone point gets its hover from the marker itself. */
    if (n < 2) return;
    const yTop = plotYR[0];
    const h = plotYR[1] - plotYR[0];
    if (h <= 0) return;
    for (let i = 0; i < n; i++) {
        const xPrev = i > 0 ? xs[i - 1] : xs[i] - (xs[1] - xs[0]);
        const xNext = i < n - 1 ? xs[i + 1] : xs[i] + (xs[n - 1] - xs[n - 2]);
        const left = (xs[i] + xPrev) / 2;
        const right = (xs[i] + xNext) / 2;
        /* The rail spans the full plot height (wide vertical hit area), so
         *  its bbox center is mid-plot — wrong for anchoring the crosshair
         *  and tooltip. Carry the point's pixel-y so the hover handler can
         *  anchor to the actual datum instead of the band's middle. */
        const base = makeData(i) as Record<string, unknown> | null;
        const data = base && ys && typeof ys[i] === 'number'
            ? { ...base, pointY: ys[i] }
            : base;
        out.push({
            kind: 'rect',
            x: left, y: yTop, w: Math.max(0, right - left), h,
            color: 'transparent', opacity: 0,
            data,
        });
    }
}
