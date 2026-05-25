/**
 * `tipStateFromHover` — map a hover event's primitive `data` payload to
 * the shape `TooltipOverlay` knows how to render. Extracted from
 * `ChartRender.tsx` so the render file stays under the line ceiling.
 *
 * The hover data shape is family-defined (each primitive function sets
 * its own keys), so this dispatches on the keys present rather than
 * branching on chart type.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';

export interface TooltipState {
    x: number; y: number; vbX: number; vbY: number;
    label: string;
    values: Array<{ name: string; value: number; color: string }>;
}

export function tipStateFromHover(
    chart: GraphDirective,
    data: unknown,
    vbX: number,
    vbY: number,
    sx: number,
    sy: number,
): TooltipState | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as any;
    const c = (chart as any).colorScheme;
    const primary = c?.primary ?? 'var(--primary)';
    const label = String(d.label ?? d.series ?? d.row ?? d.name ?? '');
    const values: Array<{ name: string; value: number; color: string }> = [];
    /* Multi-series hover: expand into one row per series. Read the
     *  bucket's data row directly from `chart.data[idx]` keyed by
     *  `series` so the tooltip is authoritative — we don't rely on the
     *  hit primitive carrying a rowValues snapshot that may have
     *  drifted with the lerp/render cycle. */
    const declared = ((chart as any).series as string[] | undefined) ?? [];
    const idx = typeof d.idx === 'number' ? d.idx : -1;
    const dataRow = (idx >= 0 ? (chart as any).data?.[idx] : null) as Record<string, unknown> | null;
    let expandedMultiSeries = false;
    if (declared.length > 0 && dataRow) {
        const seriesPalette = (chart as any).colorScheme?.seriesColors as string[] | undefined;
        declared.forEach((k, i) => {
            const v = dataRow[k];
            if (typeof v !== 'number') return;
            values.push({
                name: k,
                value: v,
                color: seriesPalette?.[i] ?? primary,
            });
        });
        expandedMultiSeries = values.length > 0;
    } else if (d.rowValues && typeof d.rowValues === 'object') {
        const seriesPalette = (chart as any).colorScheme?.seriesColors as string[] | undefined;
        Object.keys(d.rowValues).forEach((k, i) => {
            const v = d.rowValues[k];
            if (typeof v !== 'number') return;
            values.push({
                name: k,
                value: v,
                color: seriesPalette?.[i] ?? primary,
            });
        });
        expandedMultiSeries = values.length > 0;
    }
    /* Skip `d.value` when multi-series already populated rows —
     *  otherwise a stacked-bar segment whose `hit.value` equals one
     *  series' weighted contribution duplicates that series' row. */
    if (!expandedMultiSeries && typeof d.value === 'number') {
        values.push({
            name: d.series ?? d.kind ?? 'value',
            value: d.value,
            color: d.color ?? primary,
        });
    }
    if (typeof d.x === 'number') {
        values.push({ name: 'x', value: d.x, color: primary });
    }
    if (typeof d.y === 'number' && !d.rowValues && !expandedMultiSeries) {
        values.push({ name: 'y', value: d.y, color: primary });
    }
    if (typeof d.z === 'number') {
        values.push({ name: 'z', value: d.z, color: primary });
    }
    if (values.length === 0) return null;
    return {
        x: vbX * sx, y: vbY * sy,
        vbX, vbY,
        label, values,
    };
}
