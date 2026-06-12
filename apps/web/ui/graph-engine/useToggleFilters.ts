import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { cs, seriesColorFor } from './svg-parts.js';
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
    /* Reconcile when the series set CHANGES after mount (a stream patch
     *  or regroup toggle introducing a series): a key the user never saw
     *  defaults active. Without this, new keys got target weight 0 and
     *  tweens SPAWN at their target — the series rendered permanently
     *  invisible with a dimmed pill and no user action explaining why.
     *  `seen` (not `activeSet`) is the dedup so explicit user-offs stay
     *  off — reconciliation must never resurrect them. */
    const seenKeysRef = useRef<Set<string>>(new Set(seriesKeys));
    useEffect(() => {
        const unseen = seriesKeys.filter(k => !seenKeysRef.current.has(k));
        if (unseen.length === 0) return;
        for (const k of unseen) seenKeysRef.current.add(k);
        setActiveSet(prev => new Set([...prev, ...unseen]));
    }, [seriesKeys]);

    const targetWeights = useMemo(
        () => new Map(seriesKeys.map(k => [k, activeSet.has(k) ? 1 : 0])),
        [seriesKeys, activeSet],
    );
    const weights = useTweenedMap(targetWeights);

    const filters: ToggleFilter[] = useMemo(() => {
        /* Display order: `legendOrder` first (in its order), then any
         *  unlisted keys in natural order. Stable; never changes data
         *  keying. */
        const order = chart.legendOrder && chart.legendOrder.length
            ? orderByList(seriesKeys, chart.legendOrder)
            : seriesKeys;
        return order.map((key) => ({
            key,                                          // real key — keying unchanged
            label: chart.legendLabels?.[key] ?? key,
            active: activeSet.has(key),
            /* Color binds to the ORIGINAL series index/identity, never the
             *  display position — so reordering the legend never recolors
             *  a series (composes with seriesColorMap). */
            color: seriesColorFor(scheme, key, seriesKeys.indexOf(key)),
        }));
    }, [seriesKeys, activeSet, scheme, chart.legendOrder, chart.legendLabels]);

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

/** Reorder `keys` so those named in `order` come first (in `order`'s
 *  sequence), then any unlisted keys in their natural order. Keys in
 *  `order` that aren't in `keys` are ignored. Pure + stable. */
function orderByList(keys: string[], order: string[]): string[] {
    const rank = new Map(order.map((k, i) => [k, i]));
    return [...keys].sort((a, b) => {
        const ra = rank.has(a) ? rank.get(a)! : order.length + keys.indexOf(a);
        const rb = rank.has(b) ? rank.get(b)! : order.length + keys.indexOf(b);
        return ra - rb;
    });
}
