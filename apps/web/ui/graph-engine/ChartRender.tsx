/**
 * Unified chart renderer — single entry point for every chart type.
 *
 * Layers stacked top-to-bottom (see ChartCanvasStack for GPU split):
 *   1. ChartCanvasStack (GPU) — data marks + features (no-bloom overlay)
 *   2. ChartChromeLayer (SVG, no input) — axes, thresholds, labels
 *   3. ChartHitLayer (SVG, captures input) — invisible hit targets
 * Plus a portal-rendered TooltipOverlay above all three, plus an
 * optional RangeEndpointTags overlay when range-drag is active.
 *
 * Animation: `useChartAnimation` drives the AnimatedFamily contract
 * (sample → lerp → primitives) on an rAF loop. The chart's data marks
 * tween mathematically when the directive's data, weights, or layout
 * change — same time constant and convergence threshold for every
 * family.
 *
 * Chrome is non-animated; computed once per directive change.
 * Hit targets auto-derive from primitive shapes (per-primitive
 * polygon/polyline/circle/arc-path; rect-bbox for rects).
 */

import React, { useCallback, useMemo, useRef } from 'react';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { Primitive } from './chart-primitive.types.js';
import { ChartCanvasStack } from './ChartCanvasStack.js';
import { PlotDottedBackdrop } from './PlotDottedBackdrop.js';
import { HitLayerWithRef } from './ChartHitLayer.js';
import { ChartChromeLayer } from './ChartChromeLayer.js';
import { TooltipOverlay, useTooltip } from './svg-parts.js';
import { tipStateFromHover, anchorYFromHover } from './chart-hover-tooltip.js';
import { useDragRange, RangeHighlight, RangeEndpointTags } from './drag-range.js';
import { defaultInteraction } from '../../architect/graph-composer.types.js';
import { useChartTuning } from './ChartTuningContext.js';
import { buildFamilyAnimation, isRadial, isPolar } from './chart-families.js';
import { periodKeyFor } from '../../architect/graph-drilldown.js';
import { useChartAnimation } from './use-chart-animation.js';
import { useWorldGeo } from './useWorldGeo.js';
import { useAnimationMemoKeys } from './use-animation-memo-keys.js';

export interface ChartRenderProps {
    chart: GraphDirective;
    width: number;
    height: number;
    /** Optional family-specific override of the directive's
     *  `interaction.axes` config. Heatmap uses this to toggle marginal
     *  bars on/off via the QueryToggleBar. */
    axesOverride?: string;
    /** Cartesian bucket click is `(idx, label)`; heatmap cell adds the
     *  `[startKey, endKey]` atom range so the controller can narrow the
     *  slider window to exactly the atoms behind the cell. Tier-row
     *  axis-label clicks add `periodKey` (e.g. `2026-04`, `2026-Q2`,
     *  `2026`, `2026-04-W2`) so the controller can use calendar math
     *  via `narrowQueryToPeriod` instead of fold-factor arithmetic. */
    onBucketClick?: (idx: number, label: string, atomKeyRange?: [number, number], periodKey?: string) => void;
    /** Whether PLOT bucket/cell clicks may drill (false at finest
     *  granularity — a day bucket can't open). Axis-label clicks are NOT
     *  gated by this: a tier label is coarser than the buckets by
     *  construction and drills whenever it carries a `periodKey`. */
    plotDrillable?: boolean;
    /** Series-isolate handler — called when a pie wedge or polygon
     *  carrying a `series` or `label` payload is clicked. Routes the
     *  toggle through useToggleFilters' `toggle(key)`. */
    onToggleSeries?: (key: string) => void;
}

export function ChartRender({ chart: chartProp, width, height, axesOverride, onBucketClick, plotDrillable = true, onToggleSeries }: ChartRenderProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { tuning } = useChartTuning();
    /* Choropleth geometry is host-loaded (the engine's one fetch seam, like
     * useTimelineSpan) and stamped onto the directive so `sample` stays pure.
     * Non-geo charts pass through untouched (hook is inert when disabled). */
    const worldGeo = useWorldGeo(chartProp.type === 'choropleth');
    const chart = useMemo(
        () => (chartProp.type === 'choropleth' && worldGeo ? { ...chartProp, geo: worldGeo } : chartProp),
        [chartProp, worldGeo],
    );
    /* useTooltip is the canonical hook the old TooltipOverlay reads
     * from. Reusing it means the existing portal-based popup works
     * unchanged across the new substrate. */
    const { tip, show, hide } = useTooltip();
    /* SVG ref for TooltipOverlay's positioning (reads getBoundingClientRect). */
    const hitSvgRef = useRef<SVGSVGElement>(null);

    /* Build the family animation: family + layout + chrome + sizes. The memo
     * key uses explicit content fields (not the directive's object reference) so
     * heatmap-scale charts don't rebuild every frame just because the parent
     * re-rendered. The Map/Set fields need derived string keys — see
     * useAnimationMemoKeys. */
    const { seriesWeightsKey, colorClipKey, activeFeaturesKey } = useAnimationMemoKeys(chart);
    const animation = useMemo(() => {
        return buildFamilyAnimation(chart, width, height, axesOverride);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        chart.type, chart.data, chart.series, seriesWeightsKey, colorClipKey,
        activeFeaturesKey, chart.features,
        chart.colorScheme, chart.thresholds, chart.interaction,
        chart.plotInsets, chart.gaussian, chart.range, chart.geo,
        width, height, axesOverride,
    ]);
    const { layoutSize, dragResolve, isoToFrame, plotXR, plotYR } = animation;

    /* rAF-driven animation: sample → lerp → primitives + chrome. The
     * hook owns the loop; React re-renders when either output changes.
     * Chrome rides the same eased clock as marks, so labels/dividers
     * physically share the bars' motion — no CSS transitions needed. */
    const { primitives, featurePrimitives, chrome } = useChartAnimation({
        family: animation.family,
        chart: animation.chart,
        layout: animation.layout,
        chrome: animation.chrome,
        width,
        height,
    });

    /* Range-drag: only enabled when the directive opts in AND the family
     * supplied a resolver (cartesian-only). Mouse handlers translate
     * client coords through the hit svg's bounding rect. */
    const ix = chart.interaction ?? defaultInteraction(chart.type);
    const dragEnabled = !!ix.dragRange && !!dragResolve && !!plotYR;
    const { range, onDown: dragDown, onDrag: dragMove, onUp: dragUp, clear: dragClear } = useDragRange();
    const dragHandlers = dragEnabled ? {
        onMouseDown: (e: React.MouseEvent<SVGSVGElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ep = dragResolve!(e.clientX - rect.left, rect.width);
            if (ep) { dragClear(); hide(); dragDown(ep); }
        },
        onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => {
            if (!range.dragging) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ep = dragResolve!(e.clientX - rect.left, rect.width);
            if (ep) dragMove(ep);
        },
        onMouseUp: () => { if (range.dragging) dragUp(); },
        /* Releasing the button OUTSIDE the svg never fires onMouseUp here
         *  (no pointer capture), which left `dragging` latched — on
         *  re-entry the selection chased the cursor with the button up.
         *  Leaving mid-drag commits the range at the last inside point. */
        onMouseLeave: () => { if (range.dragging) dragUp(); },
    } : {};
    /* Only consumed by RangeEndpointTags (rendered when drag is enabled) —
     *  computing unconditionally forced a layout read (getBoundingClientRect)
     *  on every render, including every ~60fps animation re-render. */
    const dragScale = (dragEnabled && plotYR) ? (() => {
        const rect = hitSvgRef.current?.getBoundingClientRect();
        return {
            x: rect && rect.width !== 0 ? rect.width / layoutSize.w : 1,
            y: rect && rect.height !== 0 ? rect.height / layoutSize.h : 1,
        };
    })() : { x: 1, y: 1 };

    /* Stable so the memoized hit layer doesn't rebuild every mark on each tooltip mousemove. */
    const handleHover = useCallback((data: unknown, _p: Primitive, e: React.MouseEvent<SVGElement>) => {
        const target = e.currentTarget as SVGGraphicsElement;
        const rect = hitSvgRef.current?.getBoundingClientRect();
        if (!rect || !target.getBBox) return;
        const bb = target.getBBox();
        const cx = bb.x + bb.width / 2;
        const cy = anchorYFromHover(data, bb.y + bb.height / 2);
        const sx = rect.width / layoutSize.w;
        const sy = rect.height / layoutSize.h;
        const tipState = tipStateFromHover(chart, data, cx, cy, sx, sy);
        if (tipState) show(tipState);
    }, [chart, layoutSize.w, layoutSize.h, show]);

    const handleClick = useCallback((data: unknown) => {
        const d = data as { idx?: number; label?: string; __startISO?: string; series?: string; row?: string; col?: string; startKey?: number; endKey?: number };
        /* Series-isolate: pie/donut wedges and radar/polygon series fire
         * onToggleSeries with the legend key (label for pie, series name
         * for radar/multi-line). The receiving toggle() flips the
         * activeSeries set, which fades the others out via seriesWeights. */
        if (onToggleSeries && (typeof d?.series === 'string' || typeof d?.label === 'string')) {
            const isRadialOrPolar = isRadial(chart.type) || isPolar(chart.type);
            if (isRadialOrPolar) {
                const key = d.series ?? d.label!;
                onToggleSeries(key);
                return;
            }
        }
        /* Heatmap cell-click: row+col are present; the cell's atom-key
         *  range encodes which slice of the timeline to drill into. */
        if (onBucketClick && plotDrillable && typeof d?.row === 'string' && typeof d?.col === 'string' && typeof d?.startKey === 'number' && typeof d?.endKey === 'number') {
            onBucketClick(d.startKey, `${d.row} ${d.col}`, [d.startKey, d.endKey]);
            return;
        }
        /* Cartesian bucket-click. The drill needs the bucket's CALENDAR
         *  identity, not its formatted label: "2020s"/"Mar" can't be parsed,
         *  so label-driven drills fell back to fuzzy bucket-index math and
         *  landed on the wrong span (clicking a decade showed the neighbouring
         *  decades). Derive the period key from the bucket's `__startISO` +
         *  the resolved fold unit and pass it through the dedicated
         *  `periodKey` parameter — `label` stays human-readable for the
         *  breadcrumb/annotations. Categorical bars carry no `__startISO` →
         *  no periodKey; their drill keeps using the bucket index. */
        if (onBucketClick && plotDrillable && typeof d?.idx === 'number' && typeof d?.label === 'string') {
            const pk = typeof d.__startISO === 'string'
                ? periodKeyFor(d.__startISO, chart.__foldUnit)
                : null;
            onBucketClick(d.idx, d.label, undefined, pk ?? undefined);
        }
    }, [onToggleSeries, onBucketClick, plotDrillable, chart.type, chart.__foldUnit]);
    /* Wire the handler ONLY when a click can actually act: drillable plot
     *  buckets, or series-isolate — which applies to radial/polar alone
     *  (see the guard in handleClick). Wiring it for `onToggleSeries` on
     *  cartesian charts gave every non-drillable line/area plot a pointer
     *  cursor over a click that did nothing — the cursor IS the contract. */
    const seriesIsolate = !!onToggleSeries && (isRadial(chart.type) || isPolar(chart.type));
    const clickHandler = ((onBucketClick && plotDrillable) || seriesIsolate) ? handleClick : undefined;

    /* Stable adapter — an inline closure here would defeat ChartChromeLayer's
     *  static-chrome memo (deps include onLabelClick), forcing the full axis
     *  tree (decimation × every band row) to rebuild on every tooltip
     *  mousemove re-render of this component. */
    const handleLabelClick = useCallback(
        (idx: number, label: string, periodKey?: string) => onBucketClick?.(idx, label, undefined, periodKey),
        [onBucketClick],
    );

    /* Stable hover ref — keyed on coords so downstream memos don't churn. */
    const hover = useMemo(() => tip ? { x: tip.vbX, y: tip.vbY } : null, [tip?.vbX, tip?.vbY]);

    return (
        /* Active-area wrapper. Border + radius ring just the plot + axes
         *  (title row and slider sit outside this div). Wrapper height
         *  exactly matches the canvas — no padding shell. */
        <div ref={wrapperRef} style={{ width: '100%', height: `${layoutSize.h}px`, position: 'relative', border: chart.hideFrame ? 'none' : '1px solid var(--border-main)', borderRadius: chart.hideFrame ? 0 : '0.75rem' }}>
            <PlotDottedBackdrop plotXR={plotXR} plotYR={plotYR} layoutW={layoutSize.w} layoutH={layoutSize.h} />
            <ChartCanvasStack
                primitives={primitives}
                featurePrimitives={featurePrimitives}
                width={layoutSize.w}
                height={layoutSize.h}
                glow={tuning.glow}
                iridescence={tuning.iridescence}
                edgeSoftness={tuning.edgeSoftness}
                saturation={tuning.saturation}
            />
            <HitLayerWithRef
                ref={hitSvgRef}
                primitives={primitives}
                width={layoutSize.w}
                height={layoutSize.h}
                onHover={handleHover}
                onLeave={hide}
                onClick={clickHandler}
                rangeYR={plotYR ?? undefined}
                rangeRect={dragEnabled && plotYR ? <RangeHighlight range={range} yR={plotYR} isoToFrame={isoToFrame} /> : null}
                rangeCursor={dragEnabled ? (range.dragging ? 'crosshair' : undefined) : undefined}
                dragHandlers={dragHandlers}
            />
            {/* Chrome sits ABOVE the hit layer so axis-label tap targets
              * win against the hit-layer's plot-area hit shapes. Static
              * chrome elements (axes/labels/threshold lines) are
              * `pointer-events: none` so they don't block plot clicks;
              * only the label <rect> tap targets opt in via
              * `pointerEvents="all"`. */}
            <ChartChromeLayer
                chrome={chrome}
                width={layoutSize.w}
                height={layoutSize.h}
                hover={hover}
                onLabelClick={onBucketClick ? handleLabelClick : undefined}
            />
            {dragEnabled && plotYR && <RangeEndpointTags range={range} scaleX={dragScale.x} scaleY={dragScale.y} currencyCfg={chart.currencyConfig} isoToFrame={isoToFrame} />}
            <TooltipOverlay
                tip={tip}
                yLabel={chart.yLabel}
                currencyCfg={chart.currencyConfig}
                svgRef={hitSvgRef}
                ms={chrome.crosshair?.transitionMs ?? 80}
            />
        </div>
    );
}


