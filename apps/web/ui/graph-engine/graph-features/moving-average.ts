/**
 * Simple moving average — trailing windowed mean of `feature.window`
 * buckets. The line is plotted at each VISIBLE bucket's `__x` position;
 * the window may straddle the chart's left edge.
 *
 * Edge handling: when prior buckets exist (the user is looking at a
 * non-starting slice of a longer timeline), the resolver consumes
 * `prior` to fill the leading window — the MA line starts cleanly at
 * x=0. When no prior data exists (chart at the literal start of the
 * dataset), the line begins at the first bucket with a full trailing
 * window, the same trailing-only behavior as the v1 implementation.
 *
 * Pairs naturally with bar charts. For daily revenue, `window=7` is
 * the canonical weekly smoother.
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { FeatureModule, FeatureResolver, FeatureLookback, FeatureDatum } from './feature.types.js';

const MA_COLOR = 'var(--chart-2)';
const MA_OPACITY = 0.85;
const MA_STROKE_PX = 1.75;

const resolve: FeatureResolver<{ kind: 'movingAverage'; window: number }> = (
    data, layout, feature, prior,
) => {
    const w = Math.max(2, Math.floor(feature.window));
    if (data.length === 0) return [];
    const plotW = layout.xR[1] - layout.xR[0];
    const fromFrac = (f: number) => layout.xR[0] + f * plotW;
    /* Concat prior + visible into one stream the window can scan over.
     *  We only emit a point for each VISIBLE bucket — points anchored
     *  to prior buckets would render outside the plot rect. */
    const priorArr: ReadonlyArray<FeatureDatum> = prior ?? [];
    const stream = [...priorArr, ...data];
    const visibleStart = priorArr.length;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = visibleStart; i < stream.length; i++) {
        /* Trailing window of size `w` ending at stream[i]. If `i` is too
         *  close to the absolute start (chart at the literal beginning
         *  of the dataset), there isn't a full window — skip until one
         *  exists. The line just won't start at x=0 in that genuine case. */
        if (i < w - 1) continue;
        let sum = 0;
        for (let k = i - w + 1; k <= i; k++) sum += stream[k].value;
        const avg = sum / w;
        const visible = stream[i];
        if (typeof visible.__x !== 'number') continue;
        points.push({ x: fromFrac(visible.__x), y: layout.yS(avg) });
    }
    if (points.length < 2) return [];
    const overlay: Primitive = {
        kind: 'polyline',
        points,
        strokeWidth: MA_STROKE_PX,
        color: MA_COLOR,
        opacity: MA_OPACITY,
    };
    return [overlay];
};

/* The MA needs `window - 1` prior buckets to fill its leading window
 *  with full context. `window` itself would be one too many — the
 *  trailing window of size w at bucket 0 includes bucket 0 plus the
 *  w-1 buckets before it. */
const lookback: FeatureLookback<{ kind: 'movingAverage'; window: number }> = (feature) =>
    Math.max(0, Math.floor(feature.window) - 1);

export const movingAverageModule: FeatureModule<{ kind: 'movingAverage'; window: number }> = {
    resolve, lookback,
};
