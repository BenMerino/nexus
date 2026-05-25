/**
 * Animated simple-bar family. Stacked-bar lives in
 * `animated-cartesian-stacked.ts`; curves in `animated-cartesian-curves.ts`;
 * scatter/bubble/waterfall/distribution in `-special.ts`. Shared
 * visual constants and per-bar timing in `animated-cartesian-shared.ts`.
 * The `lerp` body is `barLerp` in `animated-cartesian-lerp.ts`;
 * `primitives` is `barPrimitives` in `animated-cartesian-primitives.ts`.
 */

import { cs } from './svg-parts.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import type { AnimatedFamily } from './animated-family.js';
import { barLerp } from './animated-cartesian-lerp.js';
import { barPrimitives } from './animated-cartesian-primitives.js';

export interface BarItem {
    x: number; y: number; w: number; h: number;
    color: string; hit: unknown;
    /** Atom's iso date. Stable across fold changes — used by `lerp` to
     *  match prev↔target by atomic identity. */
    iso: string;
    /** Bucket's exclusive end ISO; used by the non-atomic fallback
     *  path for iso-containment matching. */
    isoEnd: string;
    /** Atom key (hours-since-anchor) for stable atomic identity; `null`
     *  for legacy non-atomic charts. */
    atomKey: number | null;
    /** Per-bar lifecycle timestamps for staged enter/exit animation —
     *  survive tween restarts so growth/decay accumulates across rapid
     *  slider drags. `null` means the bar is settled. */
    enteredAt: number | null;
    exitingAt: number | null;
}
export interface BarState { bars: BarItem[]; }

export const animatedBar: AnimatedFamily<BarState> = {
    sample(chart, layoutRaw) {
        const layout = layoutRaw as CartesianLayout;
        const c = cs(chart);
        const bars: BarItem[] = [];
        /* Envelope-bar rendering: one rect per fold-bucket, height = Σ
         *  atom.value in that bucket. `chart.data[]` is already built by
         *  `GraphRender` from `foldByCalendar` over the windowed atoms —
         *  carries `__startISO`/`__endISO` (calendar identity) and
         *  `value` (bucket sum). The bar family reads it directly so it
         *  never gets out of sync with the chrome's view of buckets. */
        const data = chart.data as any[];
        const baseY = layout.yR[1];
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const pos = layout.positionAt(i);
            const value = d.value ?? 0;
            const topY = layout.yS(value);
            bars.push({
                x: pos.x,
                y: topY,
                w: Math.max(0, pos.width),
                h: Math.max(0, baseY - topY),
                color: c.primary,
                hit: { idx: i, label: layout.labels[i], value },
                iso: typeof d.__startISO === 'string' ? d.__startISO : '',
                isoEnd: typeof d.__endISO === 'string' ? d.__endISO : '',
                atomKey: null,
                enteredAt: null,
                exitingAt: null,
            });
        }
        return { bars };
    },
    lerp: barLerp,
    primitives: barPrimitives,
};
