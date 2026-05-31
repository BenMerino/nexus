/**
 * Bar family's `primitives()` — topological fusion of overlapping bars
 * into single polygons. Extracted from `animated-cartesian.ts` so the
 * family file stays under the file-length ceiling.
 */

import type { BarItem, BarState } from './animated-cartesian.js';
import type { Primitive } from './chart-primitive.types.js';
import type { DatumStatus } from '../../architect/fold-atoms.js';
import { BAR_TOP_RADIUS_PX } from './animated-cartesian-shared.js';
import { statusStyle } from './datum-status-style.js';

/** Topological fusion: at every frame, polygons that touch or overlap
 *  in x are emitted as ONE polygon spanning their union. When N prevs
 *  converge during a merge, their adjacent edges meet first; from that
 *  moment they render as one fused polygon instead of N stacked rects.
 *  No alpha-stacking, no glow compounding — the polygons are
 *  mechanically one once they touch.
 *
 *  Per-cluster polygon's height = MAX of contained bars' heights (so
 *  partial-overlap transitions don't artificially shrink). x-span =
 *  min(x) to max(x+w) across the cluster. Color/hit/baseY inherited
 *  from the tallest bar (visually dominant). Corner radii determined
 *  by neighbor gaps between CLUSTERS, not between source bars within
 *  them. */
export function barPrimitives(state: BarState): Primitive[] {
    const R = BAR_TOP_RADIUS_PX;
    const visible = state.bars.filter(b => b.w > 0 && b.h > 0);
    const ordered = [...visible].sort((a, b) => a.x - b.x);
    /* Cluster bars by touching/overlapping x ranges. Two adjacent bars
     *  (sorted by x) are in the same cluster when bar[i+1].x ≤
     *  bar[i].x + bar[i].w (right edge of one ≥ left edge of next). */
    const clusters: Cluster[] = [];
    for (const b of ordered) fuseInto(clusters, b);
    return clusters.map((c, i) => {
        const leftNeighbor = i > 0 ? clusters[i - 1] : null;
        const rightNeighbor = i < clusters.length - 1 ? clusters[i + 1] : null;
        const leftGap = leftNeighbor ? c.x - leftNeighbor.right : Infinity;
        const rightGap = rightNeighbor ? rightNeighbor.x - c.right : Infinity;
        const radiusTL = Math.max(0, Math.min(1, leftGap / R)) * R;
        const radiusTR = Math.max(0, Math.min(1, rightGap / R)) * R;
        /* Status → fill opacity. A bar can't dash; projected/estimated
         *  bars read as "not yet real" via reduced alpha. Cluster status
         *  follows the tallest bar (like color/hit). */
        const rect = statusStyle(c.status).rect;
        return {
            kind: 'rect' as const,
            x: c.x, y: c.y, w: c.right - c.x, h: c.h,
            color: c.color, data: c.hit,
            radiusTL, radiusTR,
            ...(rect ? { opacity: rect.opacity } : {}),
        };
    });
}

type Cluster = { x: number; right: number; y: number; h: number; color: string; hit: unknown; status: DatumStatus };

/** Merge a single bar into the last cluster if it touches, else open a
 *  new cluster. Cluster geometry is the union rect of its contributors;
 *  color/hit follow the tallest bar in the cluster (smallest y).
 *  Tolerance of 0.001px so floating-point touches count as touches. */
function fuseInto(clusters: Cluster[], b: BarItem): void {
    const last = clusters[clusters.length - 1];
    if (last && b.x <= last.right + 0.001) {
        const bRight = b.x + b.w;
        const bBottom = b.y + b.h;
        const cBottom = last.y + last.h;
        const newTop = Math.min(last.y, b.y);
        const newBottom = Math.max(cBottom, bBottom);
        if (b.y < last.y) {
            last.color = b.color;
            last.hit = b.hit;
            last.status = b.status;
        }
        last.right = Math.max(last.right, bRight);
        last.y = newTop;
        last.h = newBottom - newTop;
    } else {
        clusters.push({
            x: b.x, right: b.x + b.w,
            y: b.y, h: b.h,
            color: b.color, hit: b.hit, status: b.status,
        });
    }
}
