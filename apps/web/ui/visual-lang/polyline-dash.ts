/**
 * Geometric dash splitter — turns one polyline + a `[on, off]` dash
 * pattern into N short solid sub-polylines (the "on" runs), interpolating
 * exact points at every on/off boundary. The GPU stroke writer renders
 * each sub-polyline solid, so dashing needs no shader change: a dash IS
 * short lines.
 *
 * Pure geometry, no GL. Walks the polyline by cumulative arc length,
 * carrying a single phase cursor across vertices so dash spacing stays
 * continuous through corners (no restart at each vertex). Returns the
 * input unchanged (wrapped) when the pattern is degenerate, so callers
 * can route solid + dashed through one code path.
 */

type Pt = { x: number; y: number };

/** Split `points` into "on"-run sub-polylines per the `[on, off]` dash
 *  pattern (px). Each returned run has ≥2 points. A non-positive `on`
 *  (or <2 input points) yields `[points]` — i.e. solid, no split. */
export function splitPolylineDash(
    points: ReadonlyArray<Pt>,
    on: number,
    off: number,
): Pt[][] {
    if (points.length < 2 || on <= 0) return [points as Pt[]];
    const period = on + off;
    if (period <= 0) return [points as Pt[]];

    const runs: Pt[][] = [];
    let cur: Pt[] = [];
    /* Phase within the current period: [0, on) draws, [on, period) gaps.
     * Carried across segments so the dash rhythm is continuous. */
    let phase = 0;
    let drawing = true;
    if (drawing) cur.push({ x: points[0].x, y: points[0].y });

    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen === 0) continue;
        let walked = 0;

        while (walked < segLen) {
            /* Distance left in the current on/off slice. */
            const sliceEnd = drawing ? on : period;
            const remainInSlice = sliceEnd - phase;
            const step = Math.min(remainInSlice, segLen - walked);
            walked += step;
            phase += step;
            const t = walked / segLen;
            const px = a.x + (b.x - a.x) * t;
            const py = a.y + (b.y - a.y) * t;

            if (drawing) cur.push({ x: px, y: py });

            /* Crossed a slice boundary exactly — flip on↔off. */
            if (phase >= sliceEnd - 1e-6) {
                if (drawing) {
                    /* End of an "on" run: close it (≥2 pts) and reset. */
                    if (cur.length >= 2) runs.push(cur);
                    cur = [];
                    drawing = false;
                    phase = on; // now inside the "off" slice
                } else {
                    /* End of "off": start a new "on" run at this point. */
                    drawing = true;
                    phase = 0;
                    cur = [{ x: px, y: py }];
                }
            }
        }
    }
    if (drawing && cur.length >= 2) runs.push(cur);
    return runs;
}
