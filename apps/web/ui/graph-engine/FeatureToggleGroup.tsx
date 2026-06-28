import { useMemo } from 'react';
import { useEngineConfig } from './engine-config.js';
import type { GraphFeatureKind } from '../../architect/graph-features.types.js';

/* ── useChartFeatureToggles ─────────────────────────────────
 * Per-chart feature-overlay opt-in state (trendline / moving average /
 * threshold / min-max / average line), persisted server-side via
 * useUiPref. The active set is rendered by <FeatureToggleControl>
 * (ChartHeaderControls) and plumbed onto `chart.activeFeatures` by
 * ChartBody; the dispatcher filters by it before computing primitives.
 *
 * (The old pill-row component lived here too — it was replaced by the
 * popover multi-select in ChartHeaderControls; only the state hook
 * remains.)
 * ──────────────────────────────────────────────────────────── */

export function useChartFeatureToggles(scopeKey: string): {
    activeKinds: Set<GraphFeatureKind>;
    setActiveKinds: (next: Set<GraphFeatureKind>) => void;
    status: 'loading' | 'ready' | 'error';
} {
    const [stored, set, status] = useEngineConfig().useUiPref<GraphFeatureKind[]>(scopeKey, []);
    const activeKinds = useMemo(() => new Set(stored), [stored]);
    const setActiveKinds = (next: Set<GraphFeatureKind>) => set(Array.from(next));
    return { activeKinds, setActiveKinds, status };
}
