import React, { useMemo } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseText } from '../primitives/BaseText.js';
import { useEngineConfig } from './engine-config.js';
import type { GraphFeature, GraphFeatureKind } from '../../architect/graph-features.types.js';

/* ── FeatureToggleGroup ─────────────────────────────────────
 * Pill row for per-chart feature overlays (trendline / moving average /
 * threshold / min-max / average line). Catalog declares AVAILABILITY
 * via `chart.features`; this widget owns the per-user opt-in state,
 * persisted server-side via useUserUiPref.
 *
 * Styling matches QueryToggleBar (same pill, same size, same dim/lit
 * states) so the two read as one coherent control strip. Renders
 * nothing when the chart has no features declared — silent on charts
 * that don't carry overlays.
 *
 * The active set is plumbed onto `chart.activeFeatures` by GraphRender;
 * the dispatcher filters by it before computing primitives.
 * ──────────────────────────────────────────────────────────── */

interface FeatureToggleGroupProps {
    scopeKey: string;
    features: ReadonlyArray<GraphFeature>;
    activeKinds: Set<GraphFeatureKind>;
    onChange: (next: Set<GraphFeatureKind>) => void;
    isLoading?: boolean;
    /** Resolved fold unit of the chart's current view. Drives the
     *  moving-average label so "MA 7" on daily buckets reads as
     *  "Week avg" while the same window count on weekly buckets reads
     *  as "Quarter+ avg". Pull from `chart.__foldUnit` at the call site. */
    foldUnit?: 'hour' | 'day' | 'month' | 'year' | 'decade' | 'century';
}

const FEATURE_LABEL: Record<GraphFeatureKind, string> = {
    trendline: 'Trend',
    movingAverage: 'Smooth',
    threshold: 'Target',
    minMaxMarkers: 'Peaks',
    averageLine: 'Mean',
};

/** Translate (window, foldUnit) into a human time horizon for the
 *  moving-average label. Each entry maps a multiplier × unit to a
 *  word — e.g. 7 daily buckets = a week, 4 weekly = a month. Falls
 *  back to a generic "Smooth" label when the combination doesn't
 *  map cleanly (uncommon fold/window pairings). */
function movingAverageLabel(window: number, foldUnit?: string): string {
    if (!foldUnit) return 'Smooth';
    const key = `${foldUnit}:${window}`;
    const horizons: Record<string, string> = {
        'hour:24': 'Day avg',
        'day:7': 'Week avg',
        'day:30': 'Month avg',
        'month:12': 'Year avg',
    };
    return horizons[key] ?? 'Smooth';
}

function labelFor(f: GraphFeature, foldUnit?: string): string {
    if (f.kind === 'threshold' && f.label) return f.label;
    if (f.kind === 'movingAverage') return movingAverageLabel(f.window, foldUnit);
    return FEATURE_LABEL[f.kind];
}

export function FeatureToggleGroup({
    features, activeKinds, onChange, isLoading, foldUnit,
}: FeatureToggleGroupProps) {
    /* Deduplicate by kind — if the catalog declares two thresholds, the
     *  group treats them as one toggle ("Targets on/off"). v1 design;
     *  per-instance toggles is a Tier-2 feature. */
    const uniqueKinds = useMemo(() => {
        const out: Array<{ kind: GraphFeatureKind; sample: GraphFeature }> = [];
        const seen = new Set<GraphFeatureKind>();
        for (const f of features) {
            if (seen.has(f.kind)) continue;
            seen.add(f.kind);
            out.push({ kind: f.kind, sample: f });
        }
        return out;
    }, [features]);

    if (uniqueKinds.length === 0) return null;

    return (
        <BaseBox display="flex" direction="row" density="tight" align="center"
            style={{ flexWrap: 'wrap', opacity: isLoading ? 0.55 : 1, transition: 'opacity 180ms ease' }}>
            {uniqueKinds.map(({ kind, sample }) => {
                const active = activeKinds.has(kind);
                return (
                    <BaseAction
                        key={kind}
                        onClick={() => {
                            if (isLoading) return;
                            const next = new Set(activeKinds);
                            if (active) next.delete(kind); else next.add(kind);
                            onChange(next);
                        }}
                        style={{
                            padding: 'var(--space-0-5, 0.125rem) var(--space-2, 0.5rem)',
                            borderRadius: 'var(--radius-pill)',
                            border: '1px solid var(--border-ghost, var(--border-main))',
                            background: active ? 'var(--bg-card)' : 'transparent',
                            opacity: active ? 1 : 0.55,
                            cursor: isLoading ? 'default' : 'pointer',
                            transition: 'opacity 180ms ease, background 180ms ease',
                        }}
                    >
                        <BaseText variant="detail"
                            style={{ fontSize: '9px', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {labelFor(sample, foldUnit)}
                        </BaseText>
                    </BaseAction>
                );
            })}
        </BaseBox>
    );
}

/** Hook variant that wires `useUserUiPref` into the toggle group and
 *  returns the active set as a Set<GraphFeatureKind>. Callers mount the
 *  group + pass the set onto `chart.activeFeatures` via the controller. */
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
