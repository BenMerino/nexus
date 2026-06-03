/**
 * The single spatial authority for "too many tick labels in too little
 * width." Greedy interval scheduling, anchor-first: priority slots
 * (axis edges, semantic anchors) place first and may bypass the
 * clearance test; the rest fill in source order, each placing only if
 * it keeps `minSlotPx` from every already-placed center.
 *
 * Both the cartesian x-axis (`xAxisLabelLayout`) and the heatmap column
 * labels (`gridChrome`) call this — so the two families never drift into
 * separate "every Nth label" hacks that disagree at the same width.
 */

export interface DecimateInput {
    /** Pixel center of each candidate label, in source order. */
    centers: number[];
    /** Minimum gap (px) any two placed centers must keep. */
    minSlotPx: number;
    /** Indices that place first and skip the clearance test (axis edges,
     *  semantic anchors). They still respect `minSlotPx` against each
     *  other so priorities never overlap. */
    priority?: number[];
    /** Optional per-index gate for non-priority labels — e.g. "this label
     *  clears its bucket's dividers." Returns false → the label is a
     *  candidate to drop. Priority indices bypass it. */
    clears?: (i: number) => boolean;
}

/** Returns the placed indices, sorted ascending. */
export function decimateByMinSlot({ centers, minSlotPx, priority, clears }: DecimateInput): number[] {
    const n = centers.length;
    const placed = new Set<number>();
    const tryPlace = (i: number, isPriority = false): void => {
        if (i < 0 || i >= n || placed.has(i)) return;
        if (!isPriority && clears && !clears(i)) return;
        const ci = centers[i];
        for (const p of placed) {
            if (Math.abs(centers[p] - ci) < minSlotPx) return;
        }
        placed.add(i);
    };

    if (n > 0) tryPlace(0, true);
    if (n > 1) tryPlace(n - 1, true);
    if (priority) for (const a of priority) tryPlace(a, true);
    for (let i = 1; i < n - 1; i++) tryPlace(i);

    return [...placed].sort((a, b) => a - b);
}
