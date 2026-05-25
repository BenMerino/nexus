/**
 * Constant-y horizontal line — target / budget / SLA / goal. Sits at
 * `feature.value` in data space, spans the full plot rect in x.
 *
 * Fold-safe because it's data-space constant: the resolver doesn't read
 * `data`, only `layout.yS` (which already encodes the current y-domain).
 */

import type { Primitive } from '../chart-primitive.types.js';
import type { FeatureModule, FeatureResolver } from './feature.types.js';

const THRESHOLD_COLOR = 'var(--status-warning)';
const THRESHOLD_OPACITY = 0.7;
const THRESHOLD_STROKE_PX = 1;

const resolve: FeatureResolver<{ kind: 'threshold'; value: number; label?: string }> = (
    _data, layout, feature,
) => {
    const y = layout.yS(feature.value);
    /* Drop the line entirely when the threshold falls outside the
     *  visible y-domain — a clipped half-line at the chart edge reads
     *  as a glitch. */
    if (y < layout.yR[0] || y > layout.yR[1]) return [];
    const overlay: Primitive = {
        kind: 'polyline',
        points: [
            { x: layout.xR[0], y },
            { x: layout.xR[1], y },
        ],
        strokeWidth: THRESHOLD_STROKE_PX,
        color: THRESHOLD_COLOR,
        opacity: THRESHOLD_OPACITY,
    };
    return [overlay];
};

export const thresholdModule: FeatureModule<{ kind: 'threshold'; value: number; label?: string }> = { resolve };
