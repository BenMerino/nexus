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
import { ChartHitLayerInner, type ChartHitLayerProps } from './ChartHitLayer.js';
import { ChartChromeLayer } from './ChartChromeLayer.js';
import { TooltipOverlay, useTooltip } from './svg-parts.js';
import { tipStateFromHover } from './chart-hover-tooltip.js';
import { useDragRange, RangeHighlight, RangeEndpointTags } from './drag-range.js';
import { defaultInteraction } from '../../architect/graph-composer.types.js';
import { useChartTuning } from './ChartTuningContext.js';
import { buildFamilyAnimation, isRadial, isPolar } from './chart-families.js';
import { useChartAnimation } from './use-chart-animation.js';

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
    /** Series-isolate handler — called when a pie wedge or polygon
     *  carrying a `series` or `label` payload is clicked. Routes the
     *  toggle through useToggleFilters' `toggle(key)`. */
    onToggleSeries?: (key: string) => void;
}

export function ChartRender({ chart, width, height, axesOverride, onBucketClick, onToggleSeries }: ChartRenderProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { tuning } = useChartTuning();
    /* useTooltip is the canonical hook the old TooltipOverlay reads
     * from. Reusing it means the existing portal-based popup works
     * unchanged across the new substrate. */
    const { tip, show, hide } = useTooltip();
    /* SVG ref for TooltipOverlay's positioning (reads getBoundingClientRect). */
    const hitSvgRef = useRef<SVGSVGElement>(null);

    /* Build the family animation: family + layout + chrome + sizes.
     * Memo key uses explicit content fields (not the directive's object
     * reference) so heatmap-scale charts don't rebuild every frame
     * just because the parent re-rendered. The seriesWeights map is
     * the most frequently-changing field — its values are stringified
     * into a stable key so weight tweens trigger fresh sampling. */
    const seriesWeightsKey = useMemo(() => {
        if (!chart.seriesWeights) return '';
        const parts: string[] = [];
        for (const [k, v] of chart.seriesWeights) {
            parts.push(`${k}:${v.toFixed(3)}`);
        }
        parts.sort();
        return parts.join('|');
    }, [chart.seriesWeights]);
    /* Stable key for the continuous-legend clip window. Like
     * `seriesWeightsKey`, it lets the animation rebuild when the user
     * drags the gradient handles without invalidating on identity-only
     * directive churn. */
    const colorClipKey = chart.colorClip
        ? `${chart.colorClip.lower.toFixed(3)}:${chart.colorClip.upper.toFixed(3)}`
        : '';
    /* Stable key for active-features Set (sets don't compare by identity
     *  in deps). Sorted join keeps the key insertion-order-independent. */
    const activeFeaturesKey = useMemo(() => {
        if (!chart.activeFeatures || chart.activeFeatures.size === 0) return '';
        return Array.from(chart.activeFeatures).sort().join('|');
    }, [chart.activeFeatures]);
    const animation = useMemo(() => {
        return buildFamilyAnimation(chart, width, height, axesOverride);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        chart.type, chart.data, chart.series, seriesWeightsKey, colorClipKey,
        activeFeaturesKey, chart.features,
        chart.colorScheme, chart.thresholds, chart.interaction,
        chart.plotInsets, chart.gaussian, chart.range,
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
    } : {};
    const dragScaleX = (() => {
        const rect = hitSvgRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return 1;
        return rect.width / layoutSize.w;
    })();
    const dragScaleY = (() => {
        const rect = hitSvgRef.current?.getBoundingClientRect();
        if (!rect || rect.height === 0) return 1;
        return rect.height / layoutSize.h;
    })();

    /* Stable so the memoized hit layer doesn't rebuild every mark on each tooltip mousemove. */
    const handleHover = useCallback((data: unknown, _p: Primitive, e: React.MouseEvent<SVGElement>) => {
        const target = e.currentTarget as SVGGraphicsElement;
        const rect = hitSvgRef.current?.getBoundingClientRect();
        if (!rect || !target.getBBox) return;
        const bb = target.getBBox();
        const cx = bb.x + bb.width / 2;
        /* Full-height hover rails (line/area families) report a bbox center
         *  at mid-plot — wrong for the crosshair + tooltip anchor. When the
         *  rail carries the datum's pixel-y (`pointY`), anchor to it. */
        const pointY = (data as { pointY?: number } | null)?.pointY;
        const cy = typeof pointY === 'number' ? pointY : bb.y + bb.height / 2;
        const sx = rect.width / layoutSize.w;
        const sy = rect.height / layoutSize.h;
        const tipState = tipStateFromHover(chart, data, cx, cy, sx, sy);
        if (tipState) show(tipState);
    }, [chart, layoutSize.w, layoutSize.h, show]);

    const handleClick = useCallback((data: unknown) => {
        const d = data as { idx?: number; label?: string; series?: string; row?: string; col?: string; startKey?: number; endKey?: number };
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
        if (onBucketClick && typeof d?.row === 'string' && typeof d?.col === 'string' && typeof d?.startKey === 'number' && typeof d?.endKey === 'number') {
            onBucketClick(d.startKey, `${d.row} ${d.col}`, [d.startKey, d.endKey]);
            return;
        }
        /* Cartesian bucket-click. */
        if (onBucketClick && typeof d?.idx === 'number' && typeof d?.label === 'string') {
            onBucketClick(d.idx, d.label);
        }
    }, [onToggleSeries, onBucketClick, chart.type]);
    const clickHandler = (onBucketClick || onToggleSeries) ? handleClick : undefined;

    /* Stable hover ref — keyed on coords so downstream memos don't churn. */
    const hover = useMemo(() => tip ? { x: tip.vbX, y: tip.vbY } : null, [tip?.vbX, tip?.vbY]);

    return (
        /* Active-area wrapper. Border + radius ring just the plot + axes
         *  (title row and slider sit outside this div). Wrapper height
         *  exactly matches the canvas — no padding shell. */
        <div ref={wrapperRef} style={{ width: '100%', height: `${layoutSize.h}px`, position: 'relative', border: '1px solid var(--border-main)', borderRadius: '0.75rem' }}>
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
                onLabelClick={onBucketClick ? (idx, label, periodKey) => onBucketClick(idx, label, undefined, periodKey) : undefined}
            />
            {dragEnabled && plotYR && <RangeEndpointTags range={range} scaleX={dragScaleX} scaleY={dragScaleY} currencyCfg={chart.currencyConfig} isoToFrame={isoToFrame} />}
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

/* The HitLayer's <svg> root is the chart's main pointer surface. It
 * forwards a ref so TooltipOverlay can compute viewport coords from
 * getBoundingClientRect, and accepts optional drag handlers + a range
 * highlight rect rendered behind the hit targets when range-drag is
 * active. */
type HitLayerWithRefProps = ChartHitLayerProps & {
    rangeYR?: [number, number];
    rangeRect?: React.ReactNode;
    rangeCursor?: React.CSSProperties['cursor'];
    dragHandlers?: {
        onMouseDown?: (e: React.MouseEvent<SVGSVGElement>) => void;
        onMouseMove?: (e: React.MouseEvent<SVGSVGElement>) => void;
        onMouseUp?: () => void;
    };
};
const HitLayerWithRef = React.forwardRef<SVGSVGElement, HitLayerWithRefProps>(
    function HitLayerWithRef(props, ref) {
        const { rangeYR: _yr, rangeRect, rangeCursor, dragHandlers, ...rest } = props;
        void _yr;
        return (
            <svg
                ref={ref}
                viewBox={`0 0 ${props.width} ${props.height}`}
                width={props.width}
                height={props.height}
                style={{
                    /* Sized to the chart canvas (`props.width/height` =
                     *  `layoutSize.w/h`), centered horizontally in the
                     *  wrapper via auto margins on both-edges-anchored
                     *  absolute box. Matches `ChartGeometryCanvas` so
                     *  the hit targets align with the GPU marks. */
                    position: 'absolute',
                    left: 0, right: 0, top: 0,
                    margin: '0 auto',
                    width: `${props.width}px`, height: `${props.height}px`,
                    display: 'block',
                    cursor: rangeCursor,
                }}
                onMouseLeave={props.onLeave}
                onMouseDown={dragHandlers?.onMouseDown}
                onMouseMove={dragHandlers?.onMouseMove}
                onMouseUp={dragHandlers?.onMouseUp}
            >
                {rangeRect}
                <ChartHitLayerInner {...rest} />
            </svg>
        );
    }
);

