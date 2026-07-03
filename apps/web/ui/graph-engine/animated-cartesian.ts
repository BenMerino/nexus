/**
 * Animated simple-bar family. Stacked-bar lives in
 * `animated-cartesian-stacked.ts`; curves in `animated-cartesian-curves.ts`;
 * scatter/bubble/waterfall/distribution in `-special.ts`. Shared
 * visual constants and per-bar timing in `animated-cartesian-shared.ts`.
 * The `lerp` body is `barLerp` in `animated-cartesian-lerp.ts`;
 * `primitives` is `barPrimitives` in `animated-cartesian-primitives.ts`.
 */

import { cs, vibranceColor } from './svg-parts.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';
import type { AnimatedFamily } from './animated-family.js';
import type { DatumStatus } from '../../architect/fold-atoms.js';
import { barLerp } from './animated-cartesian-lerp.js';
import { barPrimitives } from './animated-cartesian-primitives.js';
import { resolveStatuses } from './datum-status-style.js';

export interface BarItem {
    x: number; y: number; w: number; h: number;
    color: string; hit: unknown;
    /** Atom's iso date. Stable across fold changes — used by `lerp` to
     *  match prev↔target by atomic identity. */
    iso: string;
    /** Bucket's exclusive end ISO; used by the non-atomic fallback
     *  path for iso-containment matching. */
    isoEnd: string;
    /** Stable bucket identity for prev↔target animation matching —
     *  the canonical `bucketKey` from the bucket sequence (e.g.
     *  `day-2026-05-04`). Defined for EVERY visible bucket including
     *  empties (an empty bucket has no atom, so a numeric atom key never
     *  could identify it). `''` for legacy non-atomic charts → matching
     *  falls through to the iso-containment path. */
    bucketKey: string;
    /** Bucket's semantic status — drives the bar's fill treatment
     *  (projected/estimated → reduced opacity). A bar can't dash, so
     *  status shows as a rect treatment, not a stroke pattern. */
    status: DatumStatus;
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
        /* One bar per bucket in the canonical sequence (`chart.data`,
         *  built by `resolveAtomicDirective` from `bucketSequence` — so
         *  it includes empty buckets and carries `__bucketKey`). Reading
         *  it keeps bars perfectly aligned with chrome + curves, which
         *  read the same sequence. Each bar carries `__bucketKey` as its
         *  animation identity, reviving `barLerp`'s bucket matching. */
        const data = chart.data as any[];
        const baseY = layout.yR[1];
        /* Value-vibrance domain: normalize each bar's value against the
         *  chart's y-domain so the tallest bar reaches full token vibrance
         *  and shorter bars fade toward a muted same-hue. No-op for
         *  series/identity schemes (vibranceColor returns the flat color). */
        const vSpan = (layout.yDom.max - layout.yDom.min) || 1;
        const statuses = resolveStatuses(
            data.map((d) => (d.__status as DatumStatus) ?? (d.status as DatumStatus) ?? 'observed'),
            chart.statusOverrides,
            data.map((d) => (typeof d.__startISO === 'string' ? d.__startISO : '')),
        );
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const pos = layout.positionAt(i);
            const value = d.value ?? 0;
            const topY = layout.yS(value);
            const t = (value - layout.yDom.min) / vSpan;
            const iso = typeof d.__startISO === 'string' ? d.__startISO : '';
            bars.push({
                x: pos.x,
                y: topY,
                w: Math.max(0, pos.width),
                h: Math.max(0, baseY - topY),
                color: vibranceColor(c, t),
                /* `__startISO` rides the hit payload so a click can resolve the
                 *  bucket's calendar period (ChartRender → periodKeyFor); the
                 *  `label` stays formatted for tooltip/breadcrumb display. */
                hit: { idx: i, label: layout.labels[i], value, __startISO: iso || undefined },
                iso,
                isoEnd: typeof d.__endISO === 'string' ? d.__endISO : '',
                bucketKey: typeof d.__bucketKey === 'string' ? d.__bucketKey : '',
                status: statuses[i],
                enteredAt: null,
                exitingAt: null,
            });
        }
        return { bars };
    },
    lerp: barLerp,
    primitives: barPrimitives,
};
