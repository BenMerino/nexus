import type { GraphType, ColorSentiment, GraphDirective } from './graph-composer.types.js';

/* ── Governor Visualization Contract ─────────────────────────
 * Tier system for domain-driven visualization.
 *
 * Tier 1 (default): Governor returns a flat data array.
 *   GraphComposer auto-detects shape and picks the best chart.
 *   Zero wiring — new governor methods get charts for free.
 *
 * Tier 2: Governor returns domain-specific data with a vizHint.
 *   Companion Visualizer file transforms data into a partial
 *   GraphDirective. GraphComposer enriches with spatial/interaction.
 * ──────────────────────────────────────────────────────────── */

/** Visualization hint from a Tier 2 governor — the domain's semantic decision */
export interface VizHint {
    type: GraphType;
    sentiment?: ColorSentiment;
    title?: string;
    yLabel?: string;
    xLabel?: string;
}

/** Standardized governor output with optional visualization tier */
export interface GovernorOutput {
    data: any[];
    /** Tier 1 = generic (auto-detect). Tier 2 = domain-specific (needs Visualizer). Default: 1 */
    vizTier?: 1 | 2;
    /** Tier 2 only: explicit chart type + semantic context from the domain expert */
    vizHint?: VizHint;
}

/** A partial directive produced by a Visualizer — GraphComposer completes it */
export type PartialDirective = Pick<GraphDirective, 'type' | 'data' | 'title'> &
    Partial<Pick<GraphDirective, 'yLabel' | 'xLabel' | 'series' | 'colorScheme' | 'thresholds' | 'gaussian' | 'range' | 'renderContext'>>;

/** Visualizer function signature — domain governor → partial directive */
export type VisualizerFn = (data: any[], hint?: VizHint) => PartialDirective | null;
