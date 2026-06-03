import React, { useMemo, useRef, useState } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { BaseAction } from '../primitives/BaseAction.js';
import { useContainerSize } from './useContainerSize.js';
import { useChartLegibility } from './useChartLegibility.js';
import { useToggleFilters } from './useToggleFilters.js';
import { ValueLegend, HoverProbeProvider, useColorClip } from './ValueLegend.js';
import { defaultLegendMode } from '../../architect/graph-composer.types.js';
import { ChartBody } from './ChartBody.js';
import { ChartKpiHeader } from './ChartKpiHeader.js';
import { CardProvider } from './CardContext.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import { resolveAtomicDirective } from './graph-resolve-atoms.js';

/* ── GraphRender ─────────────────────────────────────────────
 * Universal orchestrator with spatial awareness.
 *
 * Pipeline: container resize → DPR calc → semantic zoom →
 * data compression → family renderer (or legibility alert).
 *
 * Families:
 *   Cartesian → bar, stacked-bar, area, stacked-area, line,
 *               sparkline, distribution, waterfall, scatter, bubble
 *   Radial    → pie, donut, gauge, progress-ring
 *   Polar     → radar
 *   Grid      → heatmap, treemap, funnel
 * ──────────────────────────────────────────────────────────── */

export interface GraphRenderProps {
    chart: GraphDirective;
    /** Optional toggle handler. When provided, the QueryToggleBar pills
     * become interactive and call this on click. The page (or wrapping
     * controller via `useDirectiveController`) owns the actual recompose
     * + state. Render stays pure. */
    onToggle?: (toggleId: string, value: string) => void;
    /** Loading hint for the toggle bar — dimmed while the controller is
     * mid-fetch. Render itself doesn't fetch. */
    isLoading?: boolean;
    /** Error hint for the toggle bar — surfaces a small "refresh failed"
     * pill when the controller's last refetch errored. */
    error?: string | null;
    /** Optional bucket-click handler. Fires when the user clicks any
     * data primitive (cartesian bucket, heatmap cell, etc.). For
     * cartesian, `idx`/`totalBuckets`/`daysPerBucket` carry fold-factor
     * geometry. For heatmap cells, `atomKeyRange` carries the cell's
     * `[startKey, endKey]` slice of the atom timeline; the page narrows
     * `windowDays`/`asOf` to that range. Wired only when narrowing
     * would actually shrink the view — finest-zoom clicks are no-ops. */
    onBucketClick?: (
        idx: number,
        label: string,
        totalBuckets: number,
        daysPerBucket: number,
        atomKeyRange?: [number, number],
        periodKey?: string,
    ) => void;
    /** Optional positioned-window setter. The slider expresses a windowed
     * range `[from, to]` over the genesis-to-today timeline. Width is
     * `windowDays`, right-edge anchor is `asOf` (ISO `YYYY-MM-DD`).
     * `windowDays = null` means all-time. `asOf = null` means anchored to
     * "now" (server resolves at compose time). The slider commits both
     * fields together so the controller can issue a single recompose with
     * the new positioned window. Wire to `controller.setQueryFields({...})`. */
    onWindowChange?: (window: { windowDays: number | null; asOf: string | null }) => void;
    /** Whether this chart is receiving Stream pushes (Phase 5). When `true`,
     * a small pulsing badge renders in the title row. When `undefined`, the
     * badge is omitted entirely (use this for static demos / non-replayable
     * directives). When `false`, a dim/static variant renders so layout
     * doesn't jitter on disconnect. Wire via `controller.isLive`. */
    isLive?: boolean;
    /** Drill breadcrumbs from `useDirectiveController`. When non-empty,
     *  a "← Back" chip renders inside the chart's title row (NOT as a
     *  sibling row above). Wire via `controller.breadcrumbs`. */
    breadcrumbs?: { label: string }[];
    /** Pop one drill level. Wire via `controller.drillUp`. */
    onDrillUp?: () => void;
}

export function GraphRender({ chart, onToggle, isLoading = false, error, onBucketClick, onWindowChange, isLive, breadcrumbs, onDrillUp }: GraphRenderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const container = useContainerSize(containerRef);
    const { filters, toggle, activeSet, seriesWeights } = useToggleFilters(chart);
    const clip = useColorClip();
    const legibility = useChartLegibility(container, chart);
    const t = chart.type;
    const ix = chart.interaction;
    const [axesOverride, setAxesOverride] = useState<string | undefined>(undefined);
    const canToggleAxes = t === 'heatmap';

    // Geometric atom flow. Atoms are the canonical timeline (stable epoch-day
    // keys). The visible window [windowStartKey, windowEndKey] is real-valued
    // and derived continuously from query.windowDays / asOf — slider drag
    // moves these endpoints without ever rebuilding the atom array.
    //
    // Calendar fold groups atoms by user-chosen unit (or auto-picked).
    // Each bucket carries [startKey, endKey] — its own fixed atom range.
    // The renderer maps these through linearScale to plot pixels:
    //
    //   pixelStart = linearScale(bucket.startKey, [windowStartKey, windowEndKey], plotRange)
    //   pixelEnd   = linearScale(bucket.endKey + 1, ...)
    //   width      = pixelEnd - pixelStart
    //
    // As the window endpoints move continuously, every bucket's pixel x
    // and width interpolate continuously. Buckets at the window edges
    // get clipped by the plot range. No bucket-count snapping. No
    // snapshot lerp. The math IS the animation.
    const containerWidth = container?.width ?? 0;
    const colorClip = useMemo(() => ({ lower: clip.lower, upper: clip.upper }), [clip.lower, clip.upper]);
    const resolved = useMemo(
        () => resolveAtomicDirective(chart, { activeSet, seriesWeights, colorClip }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [chart, containerWidth, activeSet, seriesWeights, colorClip],
    );

    const isCompact = t === 'sparkline' || t === 'gauge' || t === 'progress-ring';
    const isChat = chart.renderContext === 'chat';
    const tightBorder = legibility === 'tight' ? 'var(--status-warning, #f59e0b)' : 'var(--border-ghost, var(--border-main))';
    const contextBorder = isChat ? `1px solid ${tightBorder}` : `1px solid var(--border-main)`;
    const contextBg = isChat ? 'var(--glass-bg, var(--bg-card))' : 'var(--bg-main)';

    return (
        <HoverProbeProvider>
            <BaseBox
                ref={containerRef}
                style={{
                    position: 'relative',
                    marginTop: '0.5rem',
                    /* No outer padding — chart-config canvases extend to
                     * fill this card via position:absolute. Inner padding
                     * applies to chrome (title, slider, legend) so they
                     * stay readable while the molecule grid covers the
                     * entire card surface. */
                    borderRadius: '0.75rem',
                    border: contextBorder,
                    background: contextBg,
                    backdropFilter: isChat ? 'blur(12px)' : undefined,
                    /* `overflow: visible` so the chart canvas's
                     * bloom-margin can paint past the card border into
                     * surrounding space — halos visibly bleed onto
                     * adjacent elements instead of clipping at the card
                     * edge. */
                    overflow: 'visible',
                }}
            >
                <CardProvider cardRef={containerRef}>
                {container && (
                <BaseBox style={{ position: 'relative', zIndex: 1, padding: isCompact ? '0.375rem 0.5rem' : '0.5rem 0.5rem 0.25rem' }}>
                    {resolved.kpi && <ChartKpiHeader chart={resolved} />}
                    <ChartBody
                        chart={chart}
                        resolved={resolved}
                        container={container}
                        legibility={legibility}
                        axesOverride={axesOverride}
                        onBucketClick={onBucketClick}
                        onToggle={onToggle}
                        onToggleSeries={toggle}
                        onWindowChange={onWindowChange}
                        isLoading={isLoading}
                        error={error}
                        t={t}
                        isLive={isLive}
                        breadcrumbs={breadcrumbs}
                        onDrillUp={onDrillUp}
                    />

                    {(() => {
                        const mode = chart.legend && chart.legend !== 'auto' ? chart.legend : defaultLegendMode(t);
                        const showLegend = mode === 'continuous' || mode === 'size' || (mode === 'categorical' && filters.length >= 2);
                        if (!showLegend && !canToggleAxes) return null;
                        return (
                            <BaseBox display="flex" direction="row" density="tight" justify="center" style={{ flexWrap: 'wrap' }}>
                                {showLegend && <ValueLegend chart={resolved} filters={filters} onToggle={toggle} clip={clip} />}
                                {canToggleAxes && <AxesToggle current={axesOverride ?? ix?.axes ?? 'none'} onToggle={() => {
                                    const cur = axesOverride ?? ix?.axes ?? 'none';
                                    setAxesOverride(cur === 'marginal' ? 'standard' : 'marginal');
                                }} />}
                            </BaseBox>
                        );
                    })()}
                </BaseBox>
                )}
                </CardProvider>
            </BaseBox>
        </HoverProbeProvider>
    );
}

function AxesToggle({ current, onToggle }: { current: string; onToggle: () => void }) {
    return (
        <BaseAction onClick={onToggle} style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 0.25rem)',
            padding: 'var(--space-0-5, 0.125rem) var(--space-2, 0.5rem)',
            borderRadius: 'var(--radius-full, 999px)', cursor: 'pointer',
            border: '1px solid var(--border-ghost, var(--border-main))',
            background: current === 'marginal' ? 'var(--bg-card)' : 'transparent',
            opacity: current === 'marginal' ? 1 : 0.4, transition: 'opacity 150ms ease',
        }}>
            <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600 }}>Σ</BaseText>
        </BaseAction>
    );
}
