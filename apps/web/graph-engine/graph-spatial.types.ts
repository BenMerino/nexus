/* ── Spatial Awareness Types ─────────────────────────────────
 * Types for container-aware rendering, semantic zoom, legibility
 * detection, and state-integrated toggle filtering.
 * ──────────────────────────────────────────────────────────── */

/** Container dimensions tracked by ResizeObserver */
export interface ContainerDimensions {
    width: number;
    height: number;
}

/** Available plot area after margins are subtracted */
export interface PlotArea {
    width: number;
    height: number;
    xRange: [number, number];
    yRange: [number, number];
}

/** Minimum legible element constraints per chart family */
export interface FamilyConstraints {
    minElementWidth: number;
    minPlotWidth: number;
    minPlotHeight: number;
}

/** Semantic zoom level — drives data compression depth */
export type ZoomLevel = 0 | 1 | 2 | 3;

/** Output of the semantic zoom calculation */
export interface ZoomState {
    level: ZoomLevel;
    dpr: number;
    maxPoints: number;
    compressed: boolean;
}

/** Legibility classification for the current plot area */
export type LegibilityStatus = 'ok' | 'tight' | 'illegible';

/** Toggle filter entry for series/data visibility */
export interface ToggleFilter {
    key: string;
    label: string;
    active: boolean;
    color: string;
}

/** Full spatial context passed down to renderers */
export interface SpatialContext {
    container: ContainerDimensions;
    plot: PlotArea;
    zoom: ZoomState;
    legibility: LegibilityStatus;
    filters: ToggleFilter[];
}
