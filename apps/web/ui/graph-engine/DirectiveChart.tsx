import React, { useEffect, useRef } from 'react';
import { GraphRender } from './GraphRender.js';
import { useDirectiveController } from '../../architect/useDirectiveController.js';
import { narrowQueryToBucket, narrowQueryToPeriod, narrowQueryToAtomRange } from '../../architect/graph-drilldown.js';
import type { GraphDirective, GraphQuery } from '../../architect/graph-composer.types.js';

/* ── DirectiveChart ─────────────────────────────────────────
 * THE single, blessed way to render a chart in Nexus. Every page wraps
 * its directive seed in this component; no page touches <GraphRender>
 * directly anymore.
 *
 * Why this exists: GraphRender is a PURE render of whatever directive it
 * receives. If a page builds the directive inline and passes it, every
 * parent re-render hands GraphRender a fresh object → the engine re-folds
 * and `useToggleFilters` re-seeds its activeSet → legend toggles "reload".
 * DirectiveChart fixes that at the root: `useDirectiveController` takes the
 * seed ONCE into state and owns it. Toggles mutate controller-owned state,
 * never the seed, so the directive passed to GraphRender stays referentially
 * stable across toggle-driven re-renders.
 *
 * To reset a chart (e.g. tenant change), the PAGE remounts via React `key`.
 * Replayable seeds (carrying `query`) get the slider + server recompose for
 * free; one-shot seeds (no `query`) render as a stable snapshot.
 * ──────────────────────────────────────────────────────────── */

export interface DirectiveChartProps {
    /** The directive seed. Memoize at the call-site so its identity is
     *  stable; the controller takes it into state on mount regardless, but
     *  a stable seed avoids needless initial-effect churn. */
    seed: GraphDirective;
    isLive?: boolean;
}

export function DirectiveChart({ seed }: DirectiveChartProps) {
    const ctrl = useDirectiveController<GraphDirective, GraphQuery>(seed);

    // Replayable seed that arrived WITHOUT atoms (the server gave a
    // pre-folded snapshot): pull the all-time atom set once so the slider
    // can fold locally — what the old ReplayChart did on mount. Static seeds
    // (no `query`) and seeds that already carry atoms skip this.
    const loadedRef = useRef(false);
    useEffect(() => {
        if (loadedRef.current) return;
        if (ctrl.directive.query && !ctrl.directive.atoms) {
            loadedRef.current = true;
            ctrl.refetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Drill: translate a bucket/cell/period click into a child query, then
    // push it onto the controller's breadcrumb stack. No-op when the click
    // doesn't narrow (helpers return null) or the directive isn't replayable.
    const handleBucketClick = (
        idx: number,
        label: string,
        totalBuckets: number,
        daysPerBucket: number,
        atomKeyRange?: [number, number],
        periodKey?: string,
    ) => {
        const cur = ctrl.directive.query;
        if (!cur) return;
        let child: GraphQuery | null = null;
        if (periodKey) {
            child = narrowQueryToPeriod(cur, periodKey);
        } else if (atomKeyRange) {
            const anchorISO = ctrl.directive.atoms?.[0]?.iso ?? '';
            child = narrowQueryToAtomRange(cur, atomKeyRange[0], atomKeyRange[1], anchorISO);
        } else {
            child = narrowQueryToBucket(cur, idx, totalBuckets, daysPerBucket);
        }
        if (child) ctrl.drillDown(child, label);
    };

    return (
        <GraphRender
            chart={ctrl.directive}
            onToggle={ctrl.setToggle}
            onWindowChange={({ windowDays, asOf }) => ctrl.setQueryFields({ windowDays, asOf: asOf ?? undefined })}
            onBucketClick={handleBucketClick}
            isLoading={ctrl.isLoading}
            error={ctrl.error}
            isLive={ctrl.isLive}
            breadcrumbs={ctrl.breadcrumbs}
            onDrillUp={ctrl.drillUp}
        />
    );
}
