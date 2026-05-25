/* ── Spatial Awareness Types ─────────────────────────────────
 * Types for container-aware rendering, legibility detection, and
 * toggle filtering. Pre-Phase-5 had zoom-state types here too;
 * those died with the compress-data layer (atoms now do that work).
 * ──────────────────────────────────────────────────────────── */

/** Container dimensions tracked by ResizeObserver */
export interface ContainerDimensions {
    width: number;
    height: number;
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
