/**
 * Mean of visible bucket values, drawn as a faint horizontal line
 * spanning the plot. Distinct from `threshold` (which is a fixed
 * data-space constant) — this one recomputes per fold/window.
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { FeatureModule, FeatureResolver } from './feature.types.js';
import { reduce } from '../reduction.js';

const AVG_COLOR = 'var(--text-tertiary)';
const AVG_OPACITY = 0.55;
const AVG_STROKE_PX = 1;

const resolve: FeatureResolver<{ kind: 'averageLine' }> = (
    data, layout,
) => {
    if (data.length === 0) return [];
    /* The overlay is the `mean` reduction projected into the plot — the
     *  same scalar a KPI headline reads, computed by the one kernel. */
    const avg = reduce('mean', data).value;
    const y = layout.yS(avg);
    if (y < layout.yR[0] || y > layout.yR[1]) return [];
    const overlay: Primitive = {
        kind: 'polyline',
        points: [
            { x: layout.xR[0], y },
            { x: layout.xR[1], y },
        ],
        strokeWidth: AVG_STROKE_PX,
        color: AVG_COLOR,
        opacity: AVG_OPACITY,
    };
    return [overlay];
};

export const averageLineModule: FeatureModule<{ kind: 'averageLine' }> = { resolve };
