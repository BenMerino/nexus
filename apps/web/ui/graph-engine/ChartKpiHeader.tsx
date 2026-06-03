/**
 * KPI headline above a chart from `chart.kpi`. The figure is always a
 * DERIVED or composer-authoritative value — never hand-typed beside the
 * chart:
 *   • cosmetic path — `kpi.reduce` resolved over the visible buckets into
 *     `__kpiReduction` (in `resolveAtomicDirective`); this header formats
 *     that scalar and, for `trend:'auto'`, classifies its slope.
 *   • authoritative path — `kpi.figure`, a composer-owned pre-formatted
 *     value presented as-is.
 *
 * This header owns the rising/flat/falling CLASSIFICATION and its colors
 * — a presentation policy (the flat-band epsilon), deliberately kept out
 * of the `Reduction` (which carries facts only).
 */

import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { Reduction } from './reduction.js';

type Direction = 'rising' | 'flat' | 'falling';

const TREND_SYMBOL: Record<Direction, string> = { rising: '▲', flat: '→', falling: '▼' };
/* Direction → semantic status color. `flat` is neutral (muted), not a
 *  judgement; rising/falling read as positive/negative movement. */
const TREND_COLOR: Record<Direction, string> = {
    rising: 'var(--status-success)',
    flat: 'var(--text-muted)',
    falling: 'var(--status-error)',
};
const TREND_LABEL: Record<Direction, string> = { rising: 'rising', flat: 'flat', falling: 'falling' };

/** Classify a reduction's slope into a direction. The flat band is a
 *  fraction of the figure's own magnitude, so "flat" means "slope small
 *  relative to the level" — scale-free and owned here as presentation
 *  policy, never baked into the Reduction. */
function classify(r: Reduction): Direction {
    const slope = r.slope ?? 0;
    const epsilon = Math.abs(r.value) * 0.01 || 1e-9;
    if (slope > epsilon) return 'rising';
    if (slope < -epsilon) return 'falling';
    return 'flat';
}

/** Compact figure formatting — thousands separators, ≤2 decimals. */
function formatFigure(value: number): string {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function ChartKpiHeader({ chart }: { chart: GraphDirective }) {
    const kpi = chart.kpi;
    if (!kpi) return null;

    /* Figure: derived reduction (cosmetic) takes precedence; else the
     *  composer-authoritative literal. */
    const reduction = chart.__kpiReduction;
    const figure = kpi.reduce && reduction ? formatFigure(reduction.value) : kpi.figure;
    if (figure == null) return null;

    /* Trend: 'auto' derives direction from the reduction slope; a literal
     *  is used as-is. Either way the color/symbol policy lives here. */
    let trend: { direction: Direction; label: string } | undefined;
    if (kpi.trend === 'auto') {
        if (reduction) { const d = classify(reduction); trend = { direction: d, label: TREND_LABEL[d] }; }
    } else if (kpi.trend) {
        trend = kpi.trend;
    }

    return (
        <BaseBox display="flex" direction="row" align="baseline" density="comfortable" style={{ marginBottom: '0.25rem' }}>
            <BaseBox style={{ minWidth: 0 }}>
                <BaseText variant="display" style={{ lineHeight: 1 }}>{figure}</BaseText>
                <BaseText variant="detail" color="muted" style={{ textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block' }}>
                    {kpi.caption}
                </BaseText>
            </BaseBox>
            {trend && (
                <BaseText variant="detail" weight="semibold" style={{ color: TREND_COLOR[trend.direction] }}>
                    {TREND_SYMBOL[trend.direction]} {trend.label}
                </BaseText>
            )}
        </BaseBox>
    );
}
