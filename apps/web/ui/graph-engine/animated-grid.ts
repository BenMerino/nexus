/**
 * Animated polar + grid families: radar (polygon per series),
 * heatmap (per-cell rect + optional marginal bars), treemap
 * (proportional rect packing), funnel (per-stage trapezoid).
 */

import { rampColor } from './scales.js';
import { foldHeatmapColumns } from './heatmap-fold-columns.js';
import { cs, getSeriesPalette, weightOf, seriesColorFor } from './svg-parts.js';
import type { Primitive } from './chart-primitive.types.js';
import { lerpNumber, lerpNumberArray, type AnimatedFamily } from './animated-family.js';

/* ─── Radar ─── */

export interface RadarState {
    series: { id: string; xs: number[]; ys: number[]; color: string; weight: number }[];
}

export const animatedRadar: AnimatedFamily<RadarState> = {
    sample(chart, layoutRaw) {
        const size = layoutRaw as number;
        const data = chart.data as any[];
        const series = chart.series || [];
        const c = cs(chart);
        if (data.length < 3 || series.length === 0) return { series: [] };
        const cx = size / 2, cy = size / 2, maxR = size * 0.42;
        const axes = data.length;
        const angleStep = (Math.PI * 2) / axes;
        const allVals = data.flatMap((d: any) => series.map(s => d[s] ?? 0));
        const maxVal = Math.max(...allVals, 1);
        return {
            series: series.map((s, si) => {
                const w = weightOf(s, chart.seriesWeights);
                const xs: number[] = [];
                const ys: number[] = [];
                for (let i = 0; i < axes; i++) {
                    const a = -Math.PI / 2 + i * angleStep;
                    const r = ((data[i][s] ?? 0) / maxVal) * maxR * w;
                    xs.push(cx + r * Math.cos(a));
                    ys.push(cy + r * Math.sin(a));
                }
                return {
                    id: s,
                    xs, ys,
                    color: seriesColorFor(c, s, si),
                    weight: w,
                };
            }),
        };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const prevById = new Map(prev.series.map(s => [s.id, s]));
        const out = target.series.map(t => {
            const p = prevById.get(t.id) ?? t;
            return {
                id: t.id,
                xs: lerpNumberArray(p.xs, t.xs, alpha, dRef),
                ys: lerpNumberArray(p.ys, t.ys, alpha, dRef),
                color: t.color,
                weight: lerpNumber(p.weight, t.weight, alpha, dRef),
            };
        });
        return { state: { series: out }, maxDelta: dRef.value };
    },
    primitives(state) {
        return state.series.map((s) => ({
            kind: 'polygon' as const,
            points: s.xs.map((x, i) => ({ x, y: s.ys[i] })),
            color: s.color,
            opacity: 0.25 * s.weight,
            data: { seriesIdx: 0, series: s.id },
        }));
    },
};

/* ─── Heatmap ─── */

interface HeatmapCell {
    x: number; y: number; w: number; h: number;
    color: string; hit: unknown;
}
export interface HeatmapState {
    cells: HeatmapCell[];
    marginalRow: HeatmapCell[];
    marginalCol: HeatmapCell[];
}

interface HeatmapLayoutInput {
    width: number; height: number; axesOverride?: string;
}

export const animatedHeatmap: AnimatedFamily<HeatmapState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as HeatmapLayoutInput;
        const c = cs(chart);
        const ramp = c.gradient ?? ['var(--status-success)', 'var(--status-warning)', 'var(--status-error)'];
        const cellsData = foldHeatmapColumns(chart.data as any[]);
        const rows = [...new Set(cellsData.map((d: any) => d.row))];
        const cols = [...new Set(cellsData.map((d: any) => d.col))];
        const cellMap = new Map(cellsData.map((d: any) => [`${d.row}|${d.col}`, d.value]));
        const minVal = Math.min(...cellsData.map((d: any) => d.value), 0);
        const maxVal = Math.max(...cellsData.map((d: any) => d.value), 1);
        const span = maxVal - minVal || 1;
        /* Continuous-legend clip window: the drag handles publish
         * `colorClip` on the directive. Cells with normalized intensity
         * outside [lower, upper] saturate to the endpoint colors; cells
         * inside re-stretch across the full ramp. */
        const { lower: clipLo, upper: clipHi } = chart.colorClip ?? { lower: 0, upper: 1 };
        const clipSpan = (clipHi - clipLo) || 1;
        const showMarginal = (layout.axesOverride ?? chart.interaction?.axes) === 'marginal';
        const labelW = 30, labelH = 14;
        const margR = showMarginal ? 20 : 0;
        const margB = showMarginal ? 12 : 0;
        const gridW = layout.width - labelW - margR;
        const gridH = layout.height - labelH - margB;
        const cellW = Math.max(8, gridW / cols.length);
        const cellH = Math.max(8, gridH / rows.length);
        /* Atom-key range per (row, col) cell — set by `foldByCalendarGrid`
         *  on each `__startKey`/`__endKey` field. Lets click handlers narrow
         *  the slider window to exactly the atoms behind the cell. */
        const cellMeta = new Map<string, { startKey: number; endKey: number }>();
        for (const d of cellsData) {
            if (typeof d.__startKey === 'number' && typeof d.__endKey === 'number') {
                cellMeta.set(`${d.row}|${d.col}`, { startKey: d.__startKey, endKey: d.__endKey });
            }
        }
        const cells: HeatmapCell[] = [];
        for (let ri = 0; ri < rows.length; ri++) {
            for (let ci = 0; ci < cols.length; ci++) {
                const key = `${rows[ri]}|${cols[ci]}`;
                const val = cellMap.get(key) || 0;
                const meta = cellMeta.get(key);
                const tRaw = (val - minVal) / span;
                const t = Math.min(1, Math.max(0, (tRaw - clipLo) / clipSpan));
                cells.push({
                    x: labelW + ci * cellW + 0.5,
                    y: labelH + ri * cellH + 0.5,
                    w: cellW - 1, h: cellH - 1,
                    color: rampColor(ramp, t),
                    hit: { row: rows[ri], col: cols[ci], value: val, startKey: meta?.startKey, endKey: meta?.endKey },
                });
            }
        }
        const marginalRow: HeatmapCell[] = [];
        const marginalCol: HeatmapCell[] = [];
        if (showMarginal) {
            const marginalColor = ramp[ramp.length - 1];
            const rowSums = rows.map(row => cols.reduce((s, col) => s + (cellMap.get(`${row}|${col}`) || 0), 0));
            const colSums = cols.map(col => rows.reduce((s, row) => s + (cellMap.get(`${row}|${col}`) || 0), 0));
            const maxRowSum = Math.max(...rowSums, 1);
            const maxColSum = Math.max(...colSums, 1);
            const gridRight = labelW + cols.length * cellW;
            const gridBottom = labelH + rows.length * cellH;
            for (let ri = 0; ri < rows.length; ri++) {
                marginalRow.push({
                    x: gridRight + 3, y: labelH + ri * cellH + 1,
                    w: Math.max(1, (rowSums[ri] / maxRowSum) * (margR - 5)),
                    h: cellH - 2,
                    color: marginalColor,
                    hit: { row: rows[ri], rowSum: rowSums[ri] },
                });
            }
            for (let ci = 0; ci < cols.length; ci++) {
                marginalCol.push({
                    x: labelW + ci * cellW + 1, y: gridBottom + 2,
                    w: cellW - 2,
                    h: Math.max(1, (colSums[ci] / maxColSum) * (margB - 4)),
                    color: marginalColor,
                    hit: { col: cols[ci], colSum: colSums[ci] },
                });
            }
        }
        return { cells, marginalRow, marginalCol };
    },
    lerp(prev, target, phase) {
        const alpha = phase.alpha;
        const dRef = { value: 0 };
        const easeCell = (p: HeatmapCell, t: HeatmapCell): HeatmapCell => ({
            x: lerpNumber(p.x, t.x, alpha, dRef),
            y: lerpNumber(p.y, t.y, alpha, dRef),
            w: lerpNumber(p.w, t.w, alpha, dRef),
            h: lerpNumber(p.h, t.h, alpha, dRef),
            color: t.color, hit: t.hit,
        });
        const easeList = (a: HeatmapCell[], b: HeatmapCell[]): HeatmapCell[] => {
            const out: HeatmapCell[] = new Array(b.length);
            for (let i = 0; i < b.length; i++) out[i] = easeCell(a[i] ?? b[i], b[i]);
            return out;
        };
        return {
            state: {
                cells: easeList(prev.cells, target.cells),
                marginalRow: easeList(prev.marginalRow, target.marginalRow),
                marginalCol: easeList(prev.marginalCol, target.marginalCol),
            },
            maxDelta: dRef.value,
        };
    },
    primitives(state) {
        const out: Primitive[] = state.cells.map(c => ({
            kind: 'rect' as const, x: c.x, y: c.y, w: c.w, h: c.h, color: c.color, data: c.hit,
        }));
        for (const c of state.marginalRow) {
            out.push({ kind: 'rect', x: c.x, y: c.y, w: c.w, h: c.h, color: c.color, opacity: 0.3, data: c.hit });
        }
        for (const c of state.marginalCol) {
            out.push({ kind: 'rect', x: c.x, y: c.y, w: c.w, h: c.h, color: c.color, opacity: 0.3, data: c.hit });
        }
        return out;
    },
};

