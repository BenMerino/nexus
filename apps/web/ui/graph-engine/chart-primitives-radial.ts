/**
 * Radial / polar / grid families — layout builders + SVG chrome.
 *
 * Layout: per-family geometric anchors (radial center + radii; radar
 * size; grid bounds). Consumed by the animated families to compute
 * primitives via the AnimatedFamily contract.
 *
 * Chrome: SVG overlay elements (pie callouts, donut center text,
 * gauge/ring labels, radar axis labels, heatmap row/col labels,
 * treemap and funnel in-rect labels). The chart's data marks are
 * produced by the AnimatedFamily implementations in
 * `animated-radial.ts`; this file holds the static, non-animated
 * surface only.
 *
 * Families: pie, donut, gauge, progress-ring, radar, heatmap, treemap, funnel.
 */

import { arcScale } from './scales.js';
import { decimateByMinSlot } from './label-decimate.js';
import { abbreviateLabel } from './label-abbreviate.js';
import { foldHeatmapColumns } from './heatmap-fold-columns.js';
import { weightOf, fmtValue } from './svg-parts.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ChartChrome, ChromeElement } from './chart-chrome.types.js';

export interface RadialLayout {
    size: number;
    cx: number;
    cy: number;
    /** Outer radius for filled wedges. */
    outerR: number;
    /** Inner radius (donut/gauge/ring band thickness). 0 for filled pie. */
    innerR: number;
}

/* Pie/donut wedges sprout callout labels just outside `outerR`
 *  (`radialChrome` anchors text at `outerR + CALLOUT_GAP` and the glyphs
 *  run further outward). The chrome SVG clips at the square viewBox, so
 *  the radius MUST leave an absolute margin wide enough for that text —
 *  a proportional reserve clips on small charts and wastes space on
 *  large ones because label width is in px, not a fraction of size.
 *  Gauge/progress-ring have no outward labels (only centred text), so
 *  they keep the near-full radius. */
const CALLOUT_GAP = 10;          // anchor offset past outerR (see radialChrome)
const CALLOUT_LABEL_PX = 52;     // room for the widest callout glyph run
const CALLOUT_MARGIN = CALLOUT_GAP + CALLOUT_LABEL_PX;
/* Char budget the callout text is abbreviated to. The reserved px band
 *  (CALLOUT_LABEL_PX) at the 8px callout font (~4.3px/glyph) holds ~12
 *  glyphs; abbreviateLabel folds long names ("Universidad de Talca" →
 *  "U. de Talca") to fit rather than letting them overrun the viewBox. */
const CALLOUT_MAX_CHARS = Math.floor(CALLOUT_LABEL_PX / 4.3);

export function buildRadialLayout(chart: GraphDirective, size: number): RadialLayout {
    const t = chart.type;
    const cx = size / 2, cy = size / 2;
    const hasCallouts = t === 'pie' || t === 'donut';
    /* Clamp the reserve to a fraction of the half-size so tiny inline
     *  charts still render a sensible wedge instead of collapsing. */
    const outerR = hasCallouts
        ? Math.max(size * 0.30, size / 2 - CALLOUT_MARGIN)
        : size * 0.48;
    const donut = t === 'donut' || t === 'gauge' || t === 'progress-ring';
    /* Inner radius tracks outerR so the band stays proportional even
     *  when callouts shrink the wedge. */
    const innerR = donut
        ? (t === 'donut' ? outerR * 0.60 : outerR * 0.67)
        : 0;
    return { size, cx, cy, outerR, innerR };
}

export function radialChrome(chart: GraphDirective, layout: RadialLayout): ChartChrome {
    const t = chart.type;
    const elements: ChromeElement[] = [];
    if (t === 'pie' || t === 'donut') {
        const data = chart.data as any[];
        const labels = data.map((d: any) => String(d.label ?? d.name ?? ''));
        const weighted = data.map((d: any, i: number) =>
            (d.value ?? 0) * weightOf(labels[i], chart.seriesWeights));
        const arcs = arcScale(weighted, -Math.PI / 2, Math.PI * 1.5);
        const sweeps = arcs.map(a => Math.max(0, a.endAngle - a.startAngle));
        const sortedSweeps = [...sweeps].filter(s => s > 0).sort((a, b) => a - b);
        const median = sortedSweeps.length ? sortedSweeps[Math.floor(sortedSweeps.length / 2)] : 0;
        const calloutMin = median * 0.6;
        for (let i = 0; i < arcs.length; i++) {
            if (sweeps[i] < calloutMin) continue;
            const arc = arcs[i];
            const mid = (arc.startAngle + arc.endAngle) / 2;
            const cosM = Math.cos(mid), sinM = Math.sin(mid);
            const onRight = cosM >= 0;
            const lx = layout.cx + (layout.outerR + CALLOUT_GAP) * cosM + (onRight ? 4 : -4);
            const ly = layout.cy + (layout.outerR + CALLOUT_GAP) * sinM;
            elements.push({
                kind: 'text', x: lx, y: ly - 1,
                text: abbreviateLabel(labels[i], CALLOUT_MAX_CHARS),
                anchor: onRight ? 'start' : 'end',
                fontSize: 8, fontWeight: 600,
                color: 'var(--text-main)',
            });
            elements.push({
                kind: 'text', x: lx, y: ly + 8,
                text: fmtValue(data[i].value ?? 0, chart.currencyConfig),
                anchor: onRight ? 'start' : 'end',
                fontSize: 8, fontWeight: 500,
                color: 'var(--text-muted)',
            });
        }
        if (t === 'donut') {
            const total = weighted.reduce((s, v) => s + v, 0);
            elements.push({
                kind: 'text', x: layout.cx, y: layout.cy - (chart.yLabel ? 4 : 0),
                text: fmtValue(total, chart.currencyConfig),
                anchor: 'middle', baseline: 'central',
                fontSize: 16, fontWeight: 700,
                color: 'var(--text-main)',
            });
            if (chart.yLabel) {
                elements.push({
                    kind: 'text', x: layout.cx, y: layout.cy + 12,
                    text: chart.yLabel,
                    anchor: 'middle', baseline: 'central',
                    fontSize: 9, fontWeight: 600,
                    color: 'var(--text-muted)',
                });
            }
        }
    } else if (t === 'gauge' || t === 'progress-ring') {
        const d = (chart.data as any[])[0];
        if (d) {
            const value = d.value ?? 0;
            const yLabel = chart.yLabel === '%' ? '%' : '';
            const display = chart.currencyConfig
                ? fmtValue(value, chart.currencyConfig)
                : `${value}${yLabel}`;
            elements.push({
                kind: 'text', x: layout.cx, y: layout.cy + (t === 'gauge' ? 4 : -4),
                text: display,
                anchor: 'middle', baseline: 'central',
                fontSize: t === 'gauge' ? 18 : 22, fontWeight: 700,
                color: 'var(--text-main)',
            });
            if (d.label || chart.title) {
                elements.push({
                    kind: 'text', x: layout.cx, y: layout.cy + 14,
                    text: d.label || chart.title,
                    anchor: 'middle', baseline: 'central',
                    fontSize: 9, fontWeight: 600,
                    color: 'var(--text-muted)',
                });
            }
        }
    }
    return { elements };
}
/* Radar axis labels are middle-anchored at `radarMaxR + RADAR_LABEL_GAP`,
 *  so their glyphs straddle that point and the left/right/top/bottom axes
 *  run past the square viewBox unless the polygon radius reserves room.
 *  Geometry (animated-grid) and chrome (radarChrome) both read this so
 *  the data and its labels can never drift. */
export const RADAR_LABEL_GAP = 12;
const RADAR_LABEL_PX = 30;       // half-label slop on the widest axis text
export function radarMaxR(size: number): number {
    return Math.max(size * 0.30, size / 2 - RADAR_LABEL_GAP - RADAR_LABEL_PX);
}

export function radarChrome(chart: GraphDirective, size: number): ChartChrome {
    const data = chart.data as any[];
    if (data.length < 3) return { elements: [] };
    const cx = size / 2, cy = size / 2, maxR = radarMaxR(size);
    const axes = data.length;
    const angleStep = (Math.PI * 2) / axes;
    const elements: ChromeElement[] = [];
    for (let i = 0; i < axes; i++) {
        const a = -Math.PI / 2 + i * angleStep;
        const lx = cx + (maxR + RADAR_LABEL_GAP) * Math.cos(a);
        const ly = cy + (maxR + RADAR_LABEL_GAP) * Math.sin(a);
        elements.push({
            kind: 'text', x: lx, y: ly,
            text: String(data[i].label ?? ''),
            anchor: 'middle', baseline: 'central',
            fontSize: 8, fontWeight: 600,
            color: 'var(--text-muted)',
        });
    }
    return { elements };
}
export function gridChrome(chart: GraphDirective, width: number, height: number): ChartChrome {
    const elements: ChromeElement[] = [];
    if (chart.type === 'heatmap') {
        const cells = foldHeatmapColumns(chart.data as any[]);
        const rows = [...new Set(cells.map((d: any) => d.row))];
        const cols = [...new Set(cells.map((d: any) => d.col))];
        const labelW = 30, labelH = 14;
        const gridW = width - labelW;
        const gridH = height - labelH;
        /* Fill the grid exactly — must match animated-grid's cell geometry.
         *  A min-width floor would put these chrome labels out of register
         *  with the cells and overrun the container on dense column counts. */
        const cellW = gridW / cols.length;
        const cellH = gridH / rows.length;
        /* Column labels (years) decimate through the SAME spatial
         *  authority as the cartesian x-axis. With 30-50 year-columns the
         *  cell pitch collapses below the ~7px-glyph label width, so every
         *  label would overlap; the decimator thins them to a legible set
         *  (first/last always shown). minSlot mirrors the axis sizing:
         *  widest label * avg glyph width + gutter. */
        const HEATMAP_TICK_CHAR_PX = 4.5;   // ~7px font (chrome uses fontSize 7)
        const HEATMAP_LABEL_GUTTER_PX = 6;
        const widestColChars = cols.reduce((m, c) => Math.max(m, String(c).length), 0);
        const colMinSlot = widestColChars * HEATMAP_TICK_CHAR_PX + HEATMAP_LABEL_GUTTER_PX;
        const colCenters = cols.map((_, ci) => labelW + ci * cellW + cellW / 2);
        const visibleCols = new Set(decimateByMinSlot({ centers: colCenters, minSlotPx: colMinSlot }));
        for (let ci = 0; ci < cols.length; ci++) {
            if (!visibleCols.has(ci)) continue;
            elements.push({
                kind: 'text',
                x: colCenters[ci],
                y: 10,
                text: String(cols[ci]),
                anchor: 'middle', fontSize: 7, fontWeight: 600,
                color: 'var(--text-muted)',
            });
        }
        for (let ri = 0; ri < rows.length; ri++) {
            elements.push({
                kind: 'text',
                x: labelW - 3,
                y: labelH + ri * cellH + cellH / 2 + 3,
                text: String(rows[ri]),
                anchor: 'end', fontSize: 8, fontWeight: 600,
                color: 'var(--text-muted)',
            });
        }
    } else if (chart.type === 'treemap') {
        const nodes = (chart.data as any[]).slice(0, 12);
        const weighted = nodes.map((n: any) => ({
            ...n,
            _w: weightOf(String(n.name ?? n.label ?? ''), chart.seriesWeights),
        }));
        const total = weighted.reduce((s: number, n: any) => s + (n.value || 0) * n._w, 0) || 1;
        let x = 0;
        for (const n of weighted) {
            const w = ((n.value || 0) * n._w / total) * width;
            if (w > 24) {
                elements.push({
                    kind: 'text',
                    x: x + w / 2,
                    y: height / 2,
                    text: abbreviateLabel(String(n.name ?? n.label ?? ''), Math.floor(w / 4.4)),
                    anchor: 'middle', baseline: 'central',
                    fontSize: 8, fontWeight: 600, halo: true,
                });
            }
            x += w;
        }
    } else if (chart.type === 'funnel') {
        const data = chart.data as any[];
        const stepH = height / data.length;
        for (let i = 0; i < data.length; i++) {
            elements.push({
                kind: 'text',
                x: width / 2,
                y: i * stepH + stepH / 2,
                text: abbreviateLabel(String(data[i].label ?? data[i].stage ?? ''), Math.floor(width / 5)),
                anchor: 'middle', baseline: 'central',
                fontSize: 9, fontWeight: 600, halo: true,
            });
        }
    }
    return { elements };
}
