import { useState, useMemo, useCallback } from 'react';
import { cs, seriesColor } from './svg-parts.js';
import { useTweenedMap } from '../primitives/tween.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ToggleFilter } from './graph-spatial.types.js';

/* ── useToggleFilters ────────────────────────────────────────
 * State-Integrated Toggles: manages per-series visibility with
 * weight tweening. Each series carries a 0..1 weight that
 * smoothly animates between hidden (0) and visible (1) on toggle.
 * Renderers multiply data values by weight, so collapsing bands
 * make neighbors reflow continuously instead of snapping.
 * Tween mechanics live in the shared `useTweenedMap` primitive.
 * ──────────────────────────────────────────────────────────── */

/** Chart types where each `data[i].label` is a legend-able category (no series array). */
const CATEGORICAL_TYPES = new Set(['pie', 'donut', 'funnel', 'treemap']);

export function useToggleFilters(chart: GraphDirective) {
    const scheme = cs(chart);
    // seriesKeys is recomputed each render (categorical charts derive it from
    // chart.data); stabilize via a content key so downstream memos don't
    // invalidate when nothing actually changed.
    const seriesKeys: string[] = useMemo(() => (
        chart.series && chart.series.length > 0
            ? chart.series
            : (CATEGORICAL_TYPES.has(chart.type) ? (chart.data as any[]).map(d => String(d.label ?? d.name ?? d.stage ?? '')) : [])
    ), [chart.series, chart.type, chart.data]);

    const [activeSet, setActiveSet] = useState<Set<string>>(() => new Set(seriesKeys));

    const targetWeights = useMemo(
        () => new Map(seriesKeys.map(k => [k, activeSet.has(k) ? 1 : 0])),
        [seriesKeys, activeSet],
    );
    const weights = useTweenedMap(targetWeights);

    const filters: ToggleFilter[] = useMemo(
        () => seriesKeys.map((key, i) => ({
            key,
            label: key,
            active: activeSet.has(key),
            color: seriesColor(scheme, i),
        })),
        [seriesKeys, activeSet, scheme],
    );

    const toggle = useCallback((key: string) => {
        setActiveSet(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            if (next.size === 0) return prev;
            return next;
        });
    }, []);

    return { filters, toggle, activeSet, seriesWeights: weights };
}
