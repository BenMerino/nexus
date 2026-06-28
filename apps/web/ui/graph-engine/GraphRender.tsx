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
    /** Positioned-window setter — commits the range chip's picks. Width is
     * `windowDays`, right-edge anchor is `asOf` (ISO `YYYY-MM-DD`).
     * `windowDays = null` means all-time. `asOf = null` means anchored to
     * "now" (server resolves at compose time; rolling presets keep
     * rolling). `periodKey` is present when the picked range IS a whole
     * calendar period — pass it through so the window carries the same
     * identity a drill would stamp. Wire to
     * `controller.setQueryFields({...})`. */
    onWindowChange?: (window: { windowDays: number | null; asOf: string | null; periodKey?: string }) => void;
    /** Whether this chart is receiving Stream pushes (Phase 5). When `true`,
     * a small pulsing badge renders in the title row. When `undefined`, the
     * badge is omitted entirely (use this for static demos / non-replayable
     * directives). When `false`, a dim/static variant renders so layout
     * doesn't jitter on disconnect. Wire via `controller.isLive`. */
    isLive?: boolean;
    /** Opt in to showing the live/paused badge. Off by default — most
     *  charts don't need to advertise their live wiring. `isLive` still
     *  drives the badge's active/paused state when `showLive` is set. */
    showLive?: boolean;
    /** Drill breadcrumbs from `useDirectiveController`. When non-empty,
     *  a "← Back" chip renders inside the chart's title row (NOT as a
     *  sibling row above). Wire via `controller.breadcrumbs`. */
    breadcrumbs?: { label: string }[];
    /** Pop one drill level. Wire via `controller.drillUp`. */
    onDrillUp?: () => void;
    /** Suppress the chart's own card surface (border + radius + bg). GraphRender
     *  OWNS the card by default — the single, identical chart card everywhere.
     *  Pass `bare` only when the chart is ONE element inside a richer composite
     *  card the host already draws (a landing feature card, a storefront block),
     *  so it doesn't double-border. Chat charts ignore this (always glass). */
    bare?: boolean;
}

export function GraphRender({ chart, onToggle, isLoading = false, error, onBucketClick, onWindowChange, isLive, showLive = false, breadcrumbs, onDrillUp, bare = false }: GraphRenderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // A choropleth is shape-locked to the world's 2:1 — size the container to
    // that aspect (no max-height cap) so the map fills it with no letterbox.
    const container = useContainerSize(
        containerRef,
        chart.type === 'choropleth' ? { aspect: 0.5, maxHeight: Infinity } : undefined,
    );
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
    const colorClip = useMemo(() => ({ lower: clip.lower, upper: clip.upper }), [clip.lower, clip.upper]);
    /* Two-stage resolve. The FOLD (placements, bucket sequence, yMax,
     *  neighbors) is a pure function of the directive and is the expensive
     *  half — keyed on `chart` alone. Toggle weights / color clips are
     *  client-runtime presentation state stamped in a second, cheap memo:
     *  `seriesWeights` is a NEW Map on every rAF frame of a legend tween
     *  (~17 frames per toggle), and keying the fold on it forced 17
     *  consecutive full refolds per legend click. */
    const resolvedBase = useMemo(() => resolveAtomicDirective(chart), [chart]);
    const resolved = useMemo(
        () => ({ ...resolvedBase, activeSeries: activeSet, seriesWeights, colorClip }),
        [resolvedBase, activeSet, seriesWeights, colorClip],
    );

    const isCompact = t === 'sparkline' || t === 'gauge' || t === 'progress-ring';
    /* Horizontal padding of the inner chart box (0.5rem each side). The chart
     *  width must be inset by this total so the SVG fits INSIDE the padded box
     *  instead of overflowing it. Kept as one constant feeding both the style
     *  and the width inset so they never drift. */
    const CHART_BOX_PAD_X = 8;
    const isChat = chart.renderContext === 'chat';
    /* GraphRender owns THE chart card — the single source of the chart's surface
     * (border + radius + bg). Pages place <GraphRender> directly and add NO card
     * wrapper of their own; double-wrapping was the "card inside a card" (two
     * borders, two radii) busy-ness. One owner → every chart card is identical
     * with zero per-page discipline.
     *   - chat: standalone glass bubble (blur + glass-bg).
     *   - dashboard: a clean card on the page background (--bg-card surface). */
    const tightBorder = legibility === 'tight' ? 'var(--status-warning, #f59e0b)' : 'var(--border-subtle, var(--border-main))';
    /* THE one chart border — a HAIRLINE (--border-subtle), no shadow. Elevation
     * comes from the page-gray vs card-white tone contrast, not a heavy frame
     * (the calm Linear/Stripe dashboard look). The inner plot frame is gone, so
     * this is the only border the chart draws.
     * `bare` (chart inside a host composite card) → no surface, fill the host. */
    const contextBorder = bare ? 'none' : (isChat ? `1px solid ${tightBorder}` : '1px solid var(--border-subtle)');
    const contextBg = bare ? 'transparent' : (isChat ? 'var(--glass-bg, var(--bg-card))' : 'var(--bg-card)');
    const contextRadius = bare ? '0' : 'var(--radius-card)';

    return (
        <HoverProbeProvider>
            <BaseBox
                ref={containerRef}
                style={{
                    position: 'relative',
                    /* marginTop only in chat (separates the bubble from the
                     * message above). On a dashboard the page lays the card out
                     * directly (its own gap), so no top margin here. */
                    marginTop: isChat ? '0.5rem' : 0,
                    /* No outer padding — chart-config canvases extend to
                     * fill this card via position:absolute. Inner padding
                     * applies to chrome (title, slider, legend) so they
                     * stay readable while the molecule grid covers the
                     * entire card surface. */
                    borderRadius: contextRadius,
                    border: contextBorder,
                    background: contextBg,
                    backdropFilter: isChat ? 'blur(12px)' : undefined,
                    /* Clip to the card. This was `visible` only so the
                     * bloom halo could bleed past the border; bloom is
                     * disabled now (BLOOM_MARGIN_PX = 0, glow default 0),
                     * so `visible` just leaks chart content — axis labels,
                     * radial callouts, the canvas — out of the wrapper.
                     * The hover tooltip renders in a `position:fixed`
                     * portal, so it still escapes regardless of clipping.
                     * Re-enabling bloom means flipping this back to
                     * `visible` alongside BLOOM_MARGIN_PX. */
                    overflow: 'hidden',
                }}
            >
                <CardProvider cardRef={containerRef}>
                {container && (
                <BaseBox style={{ position: 'relative', zIndex: 1, padding: isCompact ? `0.375rem ${CHART_BOX_PAD_X}px` : `0.5rem ${CHART_BOX_PAD_X}px 0.25rem` }}>
                    {resolved.kpi && <ChartKpiHeader chart={resolved} />}
                    <ChartBody
                        chart={chart}
                        resolved={resolved}
                        /* Inset width by this box's horizontal padding (both
                         *  sides). `container` is the OUTER wrapper's full
                         *  width; the chart renders INSIDE this padded box, so
                         *  a chart sized to the full width overflows it — and,
                         *  centered (margin:0 auto), clips both edges (right
                         *  columns + left row-labels, exactly the heatmap bug). */
                        container={{ width: Math.max(1, container.width - CHART_BOX_PAD_X * 2), height: container.height }}
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
                        showLive={showLive}
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
            borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            border: '1px solid var(--border-ghost, var(--border-main))',
            background: current === 'marginal' ? 'var(--bg-card)' : 'transparent',
            opacity: current === 'marginal' ? 1 : 0.4, transition: 'opacity 150ms ease',
        }}>
            <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600 }}>Σ</BaseText>
        </BaseAction>
    );
}
