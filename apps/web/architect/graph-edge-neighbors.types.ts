/**
 * Off-window neighbor descriptors carried on a `GraphDirective` as
 * `__edgeNeighbors`. Curve families (line / area / stacked-area /
 * multi-line) prepend/append these to their sampled point arrays so
 * smoothed lines don't terminate with a sharp cut at the plot edges.
 * The visible portion clips at the plot rect, but the curve geometry
 * continues to an off-screen neighbor.
 *
 * `isExtrapolated` is set when no real neighbor bucket exists
 * (timeline boundary) and the point should be linearly continued from
 * the two visible edge points; renderers should NOT include
 * extrapolated points in y-domain calculations (it's invented data).
 * Bars and other discrete families ignore this entirely.
 */

export interface EdgeNeighbor {
    xCenter: number;
    value: number;
    seriesValues?: Record<string, number>;
    isExtrapolated: boolean;
}

export interface EdgeNeighbors {
    left?: EdgeNeighbor;
    right?: EdgeNeighbor;
}
