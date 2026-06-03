/**
 * Chrome — non-data overlay elements that surround the chart marks.
 * Axes, threshold lines, crosshairs, range-drag highlight, value labels.
 * Rendered as SVG above the GPU canvas because text + dashed strokes
 * are awkward in WebGPU and don't benefit from the GPU substrate.
 *
 * Every chart family produces a `ChartChrome` from its layout — the
 * unified ChartRender mounts it via ChartChromeLayer.
 */

export interface ChartChromeAxisX {
    kind: 'x-axis-band';
    labels: string[];
    /** Per-label X position in viewBox px; if omitted, even spacing
     *  across `range`. */
    xAt?: (i: number) => number;
    range: [number, number];
    y: number;
    /** Optional per-label stable identifier — used as the React key.
     *  Lets the chrome renderer key by a globally-unique value (like an
     *  ISO date or a tier-group key) when the visible labels may repeat
     *  (e.g. week-of-month labels W1..W5 across multiple months). Falls
     *  back to the label content when absent. */
    keys?: string[];
    /** Optional per-label left-edge X position in viewBox px. When set,
     *  the renderer draws a vertical divider tick at the leading edge of
     *  every rendered (post-decimation) label — boundaries always align
     *  with what the user sees, never crowding the labels themselves. */
    leadingEdgeXs?: number[];
    /** Optional priority indices: labels here must render whenever the
     *  decimator can fit them, even when uniform stride would skip them.
     *  Used by hierarchical tier rows so semantic anchors (e.g. the W1
     *  of each visible month) survive decimation while mid-period labels
     *  are first to drop. Edge indices `0` and `labels.length - 1` are
     *  implicitly anchors and don't need to appear here. */
    anchors?: number[];
    /** Optional per-label right-edge X position in viewBox px. Paired
     *  with `leadingEdgeXs[i]` so the renderer knows the full pixel
     *  span this label represents — used by hover-to-highlight to draw
     *  a band over the data the label covers. */
    trailingEdgeXs?: number[];
    /** Optional plot Y range `[top, bottom]` in viewBox px. Lets the
     *  renderer paint a hover-highlight band spanning the chart's full
     *  vertical extent above the data for whichever label is hovered. */
    plotYR?: [number, number];
    /** Categorical x-axis: every bar IS a distinct named entity (institution,
     *  journal), so its label carries identity and must not be dropped. When
     *  set, the decimator keeps ALL labels and rotates them to fit instead of
     *  thinning to a pixel min-slot (which would silently erase most bars'
     *  identity, leaving only the first/last anchors). Unset for temporal x
     *  (year/month samples), where decimation is correct. */
    keepAll?: boolean;
}

export interface ChartChromeAxisXLinear {
    kind: 'x-axis-linear';
    domain: { min: number; max: number; step: number };
    range: [number, number];
    y: number;
}

export interface ChartChromeAxisY {
    kind: 'y-axis';
    domain: { min: number; max: number; step: number };
    range: [number, number];
    x: number;
}

export interface ChartChromeThresholdLine {
    kind: 'threshold-line';
    /** Y in viewBox px (already scaled by family). */
    y: number;
    /** X span (full plot range). */
    xRange: [number, number];
    color: string;
    label?: string;
}

export interface ChartChromeText {
    kind: 'text';
    x: number;
    y: number;
    text: string;
    /** Optional explicit alignment / weight knobs. Defaults match labels. */
    anchor?: 'start' | 'middle' | 'end';
    baseline?: 'alphabetic' | 'central' | 'hanging';
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    /** Optional halo for readability over data marks. */
    halo?: boolean;
}

export type ChromeElement =
    | ChartChromeAxisX
    | ChartChromeAxisXLinear
    | ChartChromeAxisY
    | ChartChromeThresholdLine
    | ChartChromeText;

/** Crosshair config — when `tip` is set in ChartRender's tooltip state,
 *  crosshair lines render at that position, scoped to the plot rect. */
export interface ChartCrosshairConfig {
    /** Plot rect in viewBox px — crosshair lines clip to this. */
    xR: [number, number];
    yR: [number, number];
    mode: 'both' | 'vertical' | 'cell' | 'none';
    /** Transition ms for smooth glide between hovered points. */
    transitionMs?: number;
}

export interface ChartChrome {
    /** Static overlay elements (axes, thresholds, labels, callouts). */
    elements: ChromeElement[];
    /** Crosshair config (rendered when a primitive is hovered). */
    crosshair?: ChartCrosshairConfig;
}
