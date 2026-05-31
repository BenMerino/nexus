/**
 * Per-point sub-annotations — secondary text attached to individual
 * points (e.g. "Peak", "↑12%"). Wires the directive's existing
 * `annotations: GraphAnnotation[]` (index/label/color) — built by the
 * server composer but historically never rendered — to `ChromeText`.
 *
 * Annotated indices are SEMANTIC anchors: the caller injects them into
 * the x-axis decimator's `anchors` so the slot survives crowding, and
 * suppresses the plain value label at that index (the annotation is more
 * informative). The annotation sits ABOVE where the value label would
 * be, so when both are kept they never collide.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import type { ChromeElement } from './chart-chrome.types.js';
import { barCenterX } from './chrome-value-labels.js';

const ANN_FONT = 9;
const ANN_WEIGHT = 700;
/** Sits above the value-label band so the two stack rather than overlap. */
const ANN_OFFSET = 16;

/** Build one `ChromeText` per annotation, positioned above its point/bar.
 *  Skips out-of-range indices and gap buckets. */
export function annotationElements(
    chart: GraphDirective,
    layout: CartesianLayout,
): ChromeElement[] {
    if (!chart.annotations || chart.annotations.length === 0) return [];
    const data = chart.data as Array<{ value?: number; __xStart?: number; __xEnd?: number }>;
    const isBar = chart.type === 'bar' || chart.type === 'stacked-bar';
    const out: ChromeElement[] = [];
    for (const ann of chart.annotations) {
        const i = ann.index;
        if (i < 0 || i >= data.length) continue;
        const v = data[i]?.value;
        if (v == null) continue;                 // gap → no annotation
        const x = isBar ? barCenterX(data, layout, i) : layout.pointAt(i);
        const y = layout.yS(v) - ANN_OFFSET;
        out.push({
            kind: 'text',
            x, y,
            text: ann.label,
            anchor: 'middle',
            baseline: 'alphabetic',
            fontSize: ANN_FONT,
            fontWeight: ANN_WEIGHT,
            color: ann.color ?? 'var(--text-main)',
            halo: true,
        });
    }
    return out;
}

/** Indices carrying an annotation — used as decimator anchors + as the
 *  value-label suppression set. */
export function annotatedIndices(chart: GraphDirective): Set<number> {
    const s = new Set<number>();
    for (const a of chart.annotations ?? []) s.add(a.index);
    return s;
}
