import React, { useRef, useMemo, useState } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { BaseAction } from '../primitives/BaseAction.js';
import { isCartesian, CartesianRender } from './cartesian-render.js';
import { isRadial, RadialRender } from './radial-render.js';
import { isPolar, PolarRender } from './polar-render.js';
import { isGrid, GridRender } from './grid-render.js';
import { useContainerSize } from './useContainerSize.js';
import { useSemanticZoom } from './useSemanticZoom.js';
import { useToggleFilters } from './useToggleFilters.js';
import { compressForFamily } from './compress-data.js';
import { LegibilityAlert } from './LegibilityAlert.js';
import { ToggleBar } from './ToggleBar.js';
import type { GraphDirective, ChartData } from '../../architect/graph-composer.types.js';

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

export function GraphRender({ chart }: { chart: GraphDirective }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const container = useContainerSize(containerRef);
    const { filters, toggle, visibleData, visibleSeries } = useToggleFilters(chart);
    const { zoom, legibility } = useSemanticZoom(container, chart, filters);
    const t = chart.type;
    const ix = chart.interaction;
    const [axesOverride, setAxesOverride] = useState<string | undefined>(undefined);
    const canToggleAxes = t === 'heatmap';

    const resolved = useMemo((): GraphDirective => {
        const compressed = compressForFamily(chart, zoom) as ChartData;
        if (compressed === chart.data && visibleSeries.length === (chart.series?.length ?? 0)) return chart;
        return { ...chart, data: compressed, series: visibleSeries.length > 0 ? visibleSeries : chart.series };
    }, [chart, zoom, visibleData, visibleSeries]);

    const isCompact = t === 'sparkline' || t === 'gauge' || t === 'progress-ring';
    const isChat = chart.renderContext === 'chat';
    const tightBorder = legibility === 'tight' ? 'var(--status-warning, #f59e0b)' : 'var(--border-ghost, var(--border-main))';
    const contextBorder = isChat ? `1px solid ${tightBorder}` : `1px solid var(--border-subtle, var(--border-main))`;
    const contextBg = isChat ? 'var(--glass-bg, var(--bg-card))' : 'var(--bg-card)';

    return (
        <BaseBox
            ref={containerRef}
            style={{
                marginTop: '0.5rem',
                padding: isCompact ? '0.375rem 0.5rem' : '0.5rem 0.5rem 0.25rem',
                borderRadius: '0.75rem',
                border: contextBorder,
                background: contextBg,
                backdropFilter: isChat ? 'blur(12px)' : undefined,
                overflow: 'visible',
                maxHeight: isCompact ? undefined : '22rem',
            }}
        >
            {t !== 'sparkline' && (
                <BaseText variant="detail" weight="semibold" style={{ fontSize: '10px', marginBottom: '0.25rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {chart.title}{zoom.compressed ? ` (${['', 'weekly', 'monthly', 'quarterly'][zoom.level]})` : ''}
                </BaseText>
            )}
            {legibility === 'illegible'
                ? <LegibilityAlert chart={chart} />
                : <RenderFamily chart={resolved} w={container.width} h={container.height} axesOverride={axesOverride} />}
            {(filters.length >= 2 || canToggleAxes) && (
                <BaseBox direction="row" gap="2" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                    <ToggleBar filters={filters} onToggle={toggle} />
                    {canToggleAxes && <AxesToggle current={axesOverride ?? ix?.axes ?? 'none'} onToggle={() => {
                        const cur = axesOverride ?? ix?.axes ?? 'none';
                        setAxesOverride(cur === 'marginal' ? 'standard' : 'marginal');
                    }} />}
                </BaseBox>
            )}
        </BaseBox>
    );
}

function RenderFamily({ chart, w, h, axesOverride }: { chart: GraphDirective; w: number; h: number; axesOverride?: string }) {
    const t = chart.type;
    if (isCartesian(t)) return <CartesianRender chart={chart} width={Math.max(100, w)} height={Math.max(60, h)} />;
    if (isRadial(t))    return <RadialRender chart={chart} size={Math.max(60, Math.min(w, h))} />;
    if (isPolar(t))     return <PolarRender chart={chart} size={Math.max(60, Math.min(w, h))} />;
    if (isGrid(t))      return <GridRender chart={chart} width={Math.max(100, w)} height={Math.max(60, h)} axesOverride={axesOverride} />;
    return <CartesianRender chart={chart} width={Math.max(100, w)} height={Math.max(60, h)} />;
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
