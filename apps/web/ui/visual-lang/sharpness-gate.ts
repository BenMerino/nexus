/**
 * Visual language — sharpness gate via local-maximum suppression.
 *
 * Generic version of the molecule's gateBySharpness. Works on any indexed
 * array of values + a neighbor-graph that names which indices are
 * "adjacent" for the local-max check.
 *
 * The algorithm:
 *   - sharpness = 0: every value passes through unchanged (smooth AA).
 *   - sharpness = 1: only local maxima survive (cells brighter than every
 *     neighbor pass; the rest are killed).
 *   - between: non-maxima fade proportionally to (value / max-neighbor),
 *     squared, so cells close to local-max in value barely fade while
 *     distant ones drop fast.
 *
 * Why local-max instead of an absolute threshold:
 *   Continuous targets sweeping through a grid mean the closest cell's
 *   value oscillates between worst-case (~0.69, target between two cells)
 *   and best-case (1.0, target on a cell). Any fixed threshold either
 *   kills the worst-case cells or lets too many non-target cells through.
 *   Local-max gating is invariant to absolute value: the cell we
 *   *perceive* as "on the wave" is whichever is brighter than its
 *   neighbors at that moment.
 *
 * The molecule passes 25 values + a 4-neighbor graph (no diagonals — keeps
 * the local-max definition tight on row/column tracks). Charts will pass
 * bar values + a "left/right neighbor" graph, or line samples + a
 * "previous/next sample" graph.
 */

/** Neighbor graph: neighborGraph[i] is the array of indices considered
 *  adjacent to index i for the local-max check. */
export type NeighborGraph = ReadonlyArray<ReadonlyArray<number>>;

/** Apply sharpness gate to raw values via local-max suppression on the
 *  given neighbor graph.
 *
 *  - sharpness ≤ 0: returns a copy of rawValues unchanged.
 *  - 0 < sharpness ≤ 1: non-local-maxima fade with factor
 *    `(1 - sharpness) + sharpness * (v / neighborMax)²`.
 *
 *  Allocates a single output array of the same length. Pure function.
 */
export function gateByNeighborMax(rawValues: ReadonlyArray<number>, neighborGraph: NeighborGraph, sharpness: number): number[] {
    if (sharpness <= 0) return rawValues.slice();
    const s = Math.max(0, Math.min(1, sharpness));
    const n = rawValues.length;
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) {
        const v = rawValues[i];
        if (v <= 0) { out[i] = 0; continue; }
        const neighbors = neighborGraph[i];
        let neighborMax = 0;
        for (let k = 0; k < neighbors.length; k++) {
            const nv = rawValues[neighbors[k]];
            if (nv > neighborMax) neighborMax = nv;
        }
        if (v >= neighborMax) {
            out[i] = v;
        } else {
            const ratio = neighborMax > 0 ? v / neighborMax : 0;
            const survival = 1 - s;
            const proximityBoost = ratio * ratio;
            const factor = survival + (1 - survival) * proximityBoost;
            out[i] = v * factor;
        }
    }
    return out;
}

/** Build a 4-neighbor graph (up/down/left/right, no diagonals) for a
 *  rectangular cols×rows grid in row-major order. */
export function buildGrid4NeighborGraph(cols: number, rows: number): NeighborGraph {
    const graph: number[][] = [];
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const ns: number[] = [];
            if (x > 0) ns.push(y * cols + (x - 1));
            if (x < cols - 1) ns.push(y * cols + (x + 1));
            if (y > 0) ns.push((y - 1) * cols + x);
            if (y < rows - 1) ns.push((y + 1) * cols + x);
            graph.push(ns);
        }
    }
    return graph;
}
