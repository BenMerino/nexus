/**
 * Server-side composer types — data shape classification and metric
 * routing. Used by `GraphComposer` and its sub-builders to pick chart
 * types from raw query results. Extracted from `graph-composer.types.ts`
 * so the directive type file stays focused on the render contract.
 */

import type { GraphDirective } from './graph-composer.types.js';

export type MetricType = 'occupancy' | 'revenue' | 'commission' | 'efficiency' | 'ranking' | 'appointments' | 'general';

/** Data shape classification — expanded for 17 chart types */
export type DataShapeKind =
    | 'time-series' | 'time-series-multi' | 'ranked-list' | 'comparison'
    | 'snapshot' | 'categorical' | 'matrix' | 'distribution'
    | 'correlation' | 'hierarchical' | 'funnel' | 'waterfall'
    | 'single-metric' | 'unknown';

export interface DataShape {
    kind: DataShapeKind;
    dateField?: string;
    valueField?: string;
    labelField?: string;
    entityField?: string;
    entityCount: number;
    pointCount: number;
    isPercentage: boolean;
    /** Extra fields detected during shape analysis */
    numericFields?: string[];
    categoricalFields?: string[];
}

export type QueryIntent = 'spotlight' | 'ranking' | 'trend' | 'comparison' | 'snapshot' | 'general';

/** Query context for metric-aware composition */
export interface QueryContext {
    userQuery?: string;
    entityNames?: string[];
    metric?: MetricType;
    dateLabel?: string;
    /** Model-selected chart type — overrides heuristic type resolution when set */
    modelChartType?: string;
}

/** Composed graph payload returned by Architect.graph */
export interface ComposedGraphPayload {
    tenantId: string;
    context: 'chat' | 'dashboard';
    graphs: GraphDirective[];
}
