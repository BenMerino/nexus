/**
 * Mean of visible bucket values, drawn as a faint horizontal line
 * spanning the plot. Distinct from `threshold` (which is a fixed
 * data-space constant) — this one recomputes per fold/window.
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { FeatureModule, FeatureResolver } from './feature.types.js';

const AVG_COLOR = 'var(--text-tertiary)';
const AVG_OPACITY = 0.55;
const AVG_STROKE_PX = 1;

const resolve: FeatureResolver<{ kind: 'averageLine' }> = (
    data, layout,
) => {
    if (data.length === 0) return [];
    let sum = 0;
    for (const d of data) sum += d.value;
    const avg = sum / data.length;
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
