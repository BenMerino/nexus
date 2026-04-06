import type { GraphDirective, GraphDataPoint, StackedGraphDataPoint, ChartData } from '../../architect/graph-composer.types.js';
import type { ZoomState, ZoomLevel } from './graph-spatial.types.js';

/* ── Client-Side Data Compression ────────────────────────────
 * Pixel-aware compression: reduces data points to fit the
 * available rendering area at the appropriate zoom level.
 * ──────────────────────────────────────────────────────────── */

/** Compress simple time series by temporal bucket (week/month/quarter) */
export function compressTimeSeries(data: GraphDataPoint[], level: ZoomLevel): GraphDataPoint[] {
    if (level === 0 || data.length === 0) return data;
    const buckets = new Map<string, { sum: number; count: number }>();
    for (const pt of data) {
        const key = bucketKey(pt.label, level);
        const b = buckets.get(key) ?? { sum: 0, count: 0 };
        b.sum += pt.value;
        b.count += 1;
        buckets.set(key, b);
    }
    return Array.from(buckets.entries())
        .map(([label, b]) => ({ label, value: Math.round(b.sum / b.count) }));
}

/** Compress multi-series stacked data by temporal bucket */
export function compressStacked(data: StackedGraphDataPoint[], series: string[], level: ZoomLevel): StackedGraphDataPoint[] {
    if (level === 0 || data.length === 0) return data;
    const buckets = new Map<string, { sums: Record<string, number>; count: number }>();
    for (const pt of data) {
        const key = bucketKey(String(pt.label), level);
        const b = buckets.get(key) ?? { sums: {}, count: 0 };
        for (const s of series) b.sums[s] = (b.sums[s] || 0) + (Number(pt[s]) || 0);
        b.count += 1;
        buckets.set(key, b);
    }
    return Array.from(buckets.entries()).map(([label, b]) => {
        const pt: StackedGraphDataPoint = { label };
        for (const s of series) pt[s] = Math.round((b.sums[s] || 0) / b.count);
        return pt;
    });
}

/** Compress categorical data: keep top-N, merge rest into "Other" */
export function compressCategorical(data: GraphDataPoint[], maxPoints: number): GraphDataPoint[] {
    if (data.length <= maxPoints) return data;
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, maxPoints - 1);
    const rest = sorted.slice(maxPoints - 1);
    const other = rest.reduce((s, d) => s + d.value, 0);
    return [...top, { label: 'Other', value: other }];
}

/** Route to the right compression strategy based on chart type */
export function compressForFamily(directive: GraphDirective, zoom: ZoomState): ChartData {
    if (!zoom.compressed) return directive.data;
    const t = directive.type;
    const data = directive.data as any[];
    if (t === 'stacked-area' || t === 'stacked-bar' || t === 'multi-line') {
        return compressStacked(data, directive.series || [], zoom.level);
    }
    if (t === 'bar' || t === 'area' || t === 'line' || t === 'sparkline') {
        return compressTimeSeries(data, zoom.level);
    }
    if (t === 'pie' || t === 'donut' || t === 'funnel') {
        return compressCategorical(data, zoom.maxPoints);
    }
    // heatmap, treemap, radar, scatter, bubble, waterfall, gauge, progress-ring — no compression
    return directive.data;
}

/** Derive a temporal bucket key from a date-like label */
function bucketKey(label: string, level: ZoomLevel): string {
    const parts = label.replace(/^w\//, '').split('-').map(Number);
    const month = parts[0] || 1;
    if (level === 1) {
        const week = Math.ceil((parts[1] || 1) / 7);
        return `${String(month).padStart(2, '0')}/W${week}`;
    }
    if (level === 2) return `M${String(month).padStart(2, '0')}`;
    return `Q${Math.ceil(month / 3)}`;
}
