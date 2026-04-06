import { useState, useMemo, useCallback } from 'react';
import { cs, seriesColor } from './svg-parts.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ToggleFilter } from './graph-spatial.types.js';

/* ── useToggleFilters ────────────────────────────────────────
 * State-Integrated Toggles: manages per-series visibility.
 * Toggling a series changes visibleData, which feeds back
 * into the DPR calculation and may trigger zoom level shifts.
 * ──────────────────────────────────────────────────────────── */

export function useToggleFilters(chart: GraphDirective) {
    const scheme = cs(chart);
    const seriesKeys = chart.series || [];

    const [activeSet, setActiveSet] = useState<Set<string>>(() => new Set(seriesKeys));

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

    const visibleData = useMemo(() => {
        if (seriesKeys.length === 0 || activeSet.size === seriesKeys.length) return chart.data;
        const data = chart.data as any[];
        return data.map((pt: any) => {
            const out: any = { label: pt.label };
            for (const k of seriesKeys) if (activeSet.has(k)) out[k] = pt[k];
            return out;
        });
    }, [chart.data, seriesKeys, activeSet]);

    const visibleSeries = useMemo(
        () => seriesKeys.filter(k => activeSet.has(k)),
        [seriesKeys, activeSet],
    );

    return { filters, toggle, visibleData, visibleSeries };
}
