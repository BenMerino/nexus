/**
 * Static value labels — the numeric value printed above each point/bar,
 * so the chart is readable without hovering. Emitted as `ChromeText`
 * (SVG, halo'd) into the cartesian chrome.
 *
 * Density: labels ride the SAME decimation as the x-axis (the caller
 * passes the decimator's surviving `indices`), so a label appears only
 * where its axis tick does — no collisions, no per-label thinning logic
 * here. Single-series only this pass (multi-series stack-totals overlap
 * badly — deferred).
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import type { ChromeElement } from './chart-chrome.types.js';
import { fmtValue } from './svg-parts.js';

const LABEL_FONT = 9;
const LABEL_WEIGHT = 600;
/** Gap above the mark (bars sit tighter than line points). */
const BAR_OFFSET = 4;
const POINT_OFFSET = 6;

/** Build one `ChromeText` per surviving (decimated) bucket index,
 *  positioned above its point/bar. `indices` is the decimator's output;
 *  `skip` (indices already claimed by an annotation) are omitted so the
 *  two don't stack on the same point. */
export function valueLabelElements(
    chart: GraphDirective,
    layout: CartesianLayout,
    indices: ReadonlyArray<number>,
    skip?: ReadonlySet<number>,
): ChromeElement[] {
    const data = chart.data as Array<{ value?: number; __xStart?: number; __xEnd?: number }>;
    const isBar = chart.type === 'bar' || chart.type === 'stacked-bar';
    const out: ChromeElement[] = [];
    for (const i of indices) {
        if (skip?.has(i)) continue;
        const d = data[i];
        const v = d?.value;
        if (v == null) continue;                 // gap → no label
        const x = isBar ? barCenterX(data, layout, i) : layout.pointAt(i);
        const y = layout.yS(v) - (isBar ? BAR_OFFSET : POINT_OFFSET);
        out.push({
            kind: 'text',
            x, y,
            text: fmtValue(v, chart.currencyConfig),
            anchor: 'middle',
            baseline: 'alphabetic',
            fontSize: LABEL_FONT,
            fontWeight: LABEL_WEIGHT,
            color: 'var(--text-muted)',
            halo: true,
        });
    }
    return out;
}

/** Bar center x — uses the bucket's visible span (`__xStart`/`__xEnd`)
 *  when present so the label tracks a clipped edge bar, else falls back
 *  to the band center. Mirrors `baseXAt` in chart-cartesian-chrome. */
export function barCenterX(
    data: ReadonlyArray<{ __xStart?: number; __xEnd?: number }>,
    layout: CartesianLayout,
    i: number,
): number {
    const d = data[i];
    if (typeof d?.__xStart === 'number' && typeof d?.__xEnd === 'number') {
        const plotW = layout.xR[1] - layout.xR[0];
        const x0 = layout.xR[0] + Math.max(0, Math.min(1, d.__xStart)) * plotW;
        const x1 = layout.xR[0] + Math.max(0, Math.min(1, d.__xEnd)) * plotW;
        return (x0 + x1) / 2;
    }
    return layout.pointAt(i);
}
