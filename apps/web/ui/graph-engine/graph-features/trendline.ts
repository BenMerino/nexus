/**
 * Linear regression over visible bucket values. Pairs each bucket's
 * `__x` (window fraction) with its `value`, fits y = m·x + b by ordinary
 * least squares, and emits a single 2-point polyline spanning the plot.
 *
 * Fold-safe: when the user drags the slider and the bucket set changes,
 * the resolver re-runs on the new buckets — slope/intercept track the
 * visible window automatically, no enter/exit.
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { FeatureModule, FeatureResolver } from './feature.types.js';

const TRENDLINE_COLOR = 'var(--text-muted)';
const TRENDLINE_OPACITY = 0.65;
const TRENDLINE_STROKE_PX = 1.5;

const resolve: FeatureResolver<{ kind: 'trendline'; method?: 'linear' }> = (
    data, layout,
) => {
    if (data.length < 2) return [];
    const pts: Array<{ x: number; y: number }> = [];
    for (const d of data) {
        if (typeof d.__x !== 'number') continue;
        pts.push({ x: d.__x, y: d.value });
    }
    if (pts.length < 2) return [];
    /* OLS over the (__x, value) pairs. __x is in [0,1] window-fraction
     *  space — slope/intercept stay numerically tame regardless of x
     *  magnitude. */
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    for (const p of pts) { sumX += p.x; sumY += p.y; sumXX += p.x * p.x; sumXY += p.x * p.y; }
    const n = pts.length;
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return [];
    const m = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;
    const x0Frac = pts[0].x;
    const x1Frac = pts[pts.length - 1].x;
    const y0 = m * x0Frac + b;
    const y1 = m * x1Frac + b;
    const plotW = layout.xR[1] - layout.xR[0];
    const fromFrac = (f: number) => layout.xR[0] + f * plotW;
    const overlay: Primitive = {
        kind: 'polyline',
        points: [
            { x: fromFrac(x0Frac), y: layout.yS(y0) },
            { x: fromFrac(x1Frac), y: layout.yS(y1) },
        ],
        strokeWidth: TRENDLINE_STROKE_PX,
        color: TRENDLINE_COLOR,
        opacity: TRENDLINE_OPACITY,
    };
    return [overlay];
};

export const trendlineModule: FeatureModule<{ kind: 'trendline'; method?: 'linear' }> = { resolve };
