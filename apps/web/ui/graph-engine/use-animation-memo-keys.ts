import { useMemo } from 'react';
import type { GraphDirective } from '../../architect/graph-composer.types.js';

/* Stable memo keys for ChartRender's family-animation memo. Several directive
 * fields are Maps/Sets/objects that don't compare by identity in a dep array;
 * these derive deterministic string keys so the animation rebuilds on real
 * content change (a weight tween, a clip drag, a feature toggle) but NOT on
 * identity-only churn from a parent re-render. Extracted from ChartRender to
 * keep that file under the size ceiling. */
export function useAnimationMemoKeys(chart: GraphDirective): {
    seriesWeightsKey: string;
    colorClipKey: string;
    activeFeaturesKey: string;
} {
    /* seriesWeights is the most frequently-changing field — stringify its
     * values so weight tweens trigger fresh sampling. */
    const seriesWeightsKey = useMemo(() => {
        if (!chart.seriesWeights) return '';
        const parts: string[] = [];
        for (const [k, v] of chart.seriesWeights) parts.push(`${k}:${v.toFixed(3)}`);
        parts.sort();
        return parts.join('|');
    }, [chart.seriesWeights]);

    /* Continuous-legend clip window — lets the animation rebuild when the user
     * drags the gradient handles without invalidating on identity-only churn. */
    const colorClipKey = chart.colorClip
        ? `${chart.colorClip.lower.toFixed(3)}:${chart.colorClip.upper.toFixed(3)}`
        : '';

    /* active-features Set (sets don't compare by identity in deps). Sorted join
     * keeps the key insertion-order-independent. */
    const activeFeaturesKey = useMemo(() => {
        if (!chart.activeFeatures || chart.activeFeatures.size === 0) return '';
        return Array.from(chart.activeFeatures).sort().join('|');
    }, [chart.activeFeatures]);

    return { seriesWeightsKey, colorClipKey, activeFeaturesKey };
}
