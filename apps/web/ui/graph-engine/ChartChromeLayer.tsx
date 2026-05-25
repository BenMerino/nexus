/**
 * SVG chrome overlay — renders the static non-data parts of a chart
 * (axes, threshold lines, text labels, callouts) plus the dynamic
 * crosshair when a hover state is active.
 *
 * Sits between the GPU canvas (below) and the hit layer (above) in the
 * stacking order. Pure SVG; text is native and high-DPI clean. Pointer
 * events are off so the hit layer above receives mouse input.
 */

import React from 'react';
import { linearScale, ticks as genTicks } from './scales.js';
import { fmtValue } from './svg-parts.js';
import type {
    ChromeElement,
    ChartChrome,
} from './chart-chrome.types.js';
import {
    XAxisBand,
    XAxisBandTapTargets,
    xAxisLabelLayout,
    type LabelHover,
} from './ChromeXAxisBand.js';

const TICK_COLOR = 'var(--text-muted)';
const TICK_FONT = 9;
const TICK_WEIGHT = 600;

export interface ChartChromeLayerProps {
    chrome: ChartChrome;
    width: number;
    height: number;
    /** Hover position in viewBox px — when set, crosshair renders. */
    hover?: { x: number; y: number } | null;
    /** Click on an X-axis label — fires the same drill-down as clicking
     *  the bucket itself. The `periodKey` (when set on the chrome
     *  element) is the calendar identity of the clicked label
     *  (e.g. `2026-04`, `2026-Q2`, `2026`, `2026-04-W2`); the page-level
     *  handler decodes it into `(windowDays, asOf)` via
     *  `narrowQueryToPeriod` for calendar-correct drill. When omitted,
     *  labels render as static text. */
    onLabelClick?: (idx: number, label: string, periodKey?: string) => void;
}

export const ChartChromeLayer: React.FC<ChartChromeLayerProps> = ({
    chrome, width, height, hover, onLabelClick,
}) => {
    const [labelHover, setLabelHover] = React.useState<LabelHover>(null);
    /* Static-chrome memo. The plot's hover position changes on every
     * pointer-move (~60Hz during scrub), but axes / labels / threshold
     * lines / tap-target rects don't depend on `hover` — only the
     * `<Crosshair>` does. Memoising the static branch means a hover
     * tick only re-renders Crosshair (one <g> with two <line>s), not
     * the whole SVG tree. Big win on charts with many axis tiers. */
    const staticChildren = React.useMemo(() => {
        const highlightBand = labelHover ? (() => {
            const el = chrome.elements[labelHover.rowIdx];
            if (!el || el.kind !== 'x-axis-band') return null;
            return <LabelHighlightBand el={el} idx={labelHover.labelIdx} />;
        })() : null;
        return (
            <>
                {highlightBand}
                {chrome.elements.map((el, i) => renderStaticElement(el, i, labelHover?.rowIdx === i ? labelHover.labelIdx : null))}
                {chrome.elements.map((el, i) =>
                    el.kind === 'x-axis-band'
                        ? <XAxisBandTapTargets
                            key={`tap-${i}`}
                            el={el}
                            rowIdx={i}
                            onLabelClick={onLabelClick}
                            onLabelHover={setLabelHover}
                        />
                        : null,
                )}
            </>
        );
    }, [chrome, labelHover, onLabelClick]);
    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                left: 0, right: 0, top: 0,
                margin: '0 auto',
                width: `${width}px`, height: `${height}px`,
                display: 'block',
                pointerEvents: 'none',
            }}
        >
            {staticChildren}
            {hover && chrome.crosshair && chrome.crosshair.mode !== 'none' && (
                <Crosshair hover={hover} cfg={chrome.crosshair} />
            )}
        </svg>
    );
};

/** Faint highlight box around the hovered label itself — sits in the
 *  axis title row, between the label's two flanking dividers. Spans
 *  only the label's row height, not the full plot. Reads as "this
 *  cell is the one you're pointing at" without overlaying the data. */
function LabelHighlightBand({
    el, idx,
}: {
    el: Extract<ChromeElement, { kind: 'x-axis-band' }>;
    idx: number;
}) {
    const { leadingEdgeXs, trailingEdgeXs, y } = el;
    if (!leadingEdgeXs || !trailingEdgeXs) return null;
    const x0 = leadingEdgeXs[idx];
    const x1 = trailingEdgeXs[idx];
    if (typeof x0 !== 'number' || typeof x1 !== 'number') return null;
    const w = x1 - x0;
    if (w <= 0) return null;
    /* Row geometry (must match XAxisBand's text + divider layout):
     *  text baseline lands at y + 14, dividers span y+6 → y+18.
     *  Box covers the whole row from just above the divider top to
     *  just below the text baseline. */
    const TOP = y + 2;
    const HEIGHT = 18;
    return (
        <rect
            x={x0}
            y={TOP}
            width={w}
            height={HEIGHT}
            rx={3} ry={3}
            fill="color-mix(in srgb, var(--text-main) 10%, transparent)"
            pointerEvents="none"
        />
    );
}

function renderStaticElement(el: ChromeElement, key: number, hoveredIdx: number | null): React.ReactNode {
    switch (el.kind) {
        case 'x-axis-band':
            return <XAxisBand key={key} el={el} hoveredIdx={hoveredIdx} />;
        case 'x-axis-linear':
            return <XAxisLinear key={key} el={el} />;
        case 'y-axis':
            return <YAxis key={key} el={el} />;
        case 'threshold-line':
            return <ThresholdLine key={key} el={el} />;
        case 'text':
            return <ChromeText key={key} el={el} />;
    }
}

function XAxisLinear({ el }: { el: Extract<ChromeElement, { kind: 'x-axis-linear' }> }) {
    const s = linearScale([el.domain.min, el.domain.max], el.range);
    return (
        <>
            {genTicks(el.domain).map((v, i) => (
                <text key={i} x={s(v)} y={el.y + 14} textAnchor="middle"
                    fill={TICK_COLOR} fontSize={TICK_FONT} fontWeight={TICK_WEIGHT}>
                    {v}
                </text>
            ))}
        </>
    );
}

function YAxis({ el }: { el: Extract<ChromeElement, { kind: 'y-axis' }> }) {
    const s = linearScale([el.domain.min, el.domain.max], el.range);
    return (
        <>
            {genTicks(el.domain).map((v, i) => (
                <text key={i} x={el.x - 4} y={s(v) + 3} textAnchor="end"
                    fill={TICK_COLOR} fontSize={TICK_FONT} fontWeight={TICK_WEIGHT}>
                    {fmtTick(v)}
                </text>
            ))}
        </>
    );
}

function fmtTick(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${+(v / 1_000_000).toPrecision(3)}M`;
    if (abs >= 10_000) return `${+(v / 1_000).toPrecision(3)}k`;
    return String(v);
}

function ThresholdLine({ el }: { el: Extract<ChromeElement, { kind: 'threshold-line' }> }) {
    return (
        <g>
            <line x1={el.xRange[0]} x2={el.xRange[1]} y1={el.y} y2={el.y}
                stroke={el.color} strokeDasharray="4 4" strokeWidth={1} />
            {el.label && (
                <text x={el.xRange[1] - 2} y={el.y - 4} textAnchor="end"
                    fontSize={9} fontWeight={600} fill={el.color}>
                    {el.label}
                </text>
            )}
        </g>
    );
}

function ChromeText({ el }: { el: Extract<ChromeElement, { kind: 'text' }> }) {
    const haloProps = el.halo
        ? { stroke: 'var(--bg-card)', strokeWidth: 2.5, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const }
        : {};
    return (
        <text
            x={el.x}
            y={el.y}
            textAnchor={el.anchor ?? 'middle'}
            dominantBaseline={el.baseline ?? 'alphabetic'}
            fontSize={el.fontSize ?? 9}
            fontWeight={el.fontWeight ?? 600}
            fill={el.color ?? 'var(--text-main)'}
            {...haloProps}
        >
            {el.text}
        </text>
    );
}

function Crosshair({
    hover,
    cfg,
}: {
    hover: { x: number; y: number };
    cfg: NonNullable<ChartChrome['crosshair']>;
}) {
    const stroke = TICK_COLOR;
    const t = cfg.transitionMs && cfg.transitionMs > 0
        ? `all ${cfg.transitionMs}ms ease-out`
        : undefined;
    return (
        <g opacity={0.4}>
            <line x1={hover.x} x2={hover.x} y1={hover.y} y2={cfg.yR[1]}
                stroke={stroke} strokeDasharray="3 3" strokeWidth={0.75}
                style={{ transition: t }} />
            {cfg.mode === 'both' && (
                <line x1={cfg.xR[0]} x2={hover.x} y1={hover.y} y2={hover.y}
                    stroke={stroke} strokeDasharray="3 3" strokeWidth={0.75}
                    style={{ transition: t }} />
            )}
        </g>
    );
}
