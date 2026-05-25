/**
 * X-axis band rendering for `ChartChromeLayer`: pixel-driven label
 * decimation, divider strokes, and the interactive tap-target layer.
 * Extracted here so the chrome layer file stays under the line ceiling.
 *
 * `xAxisLabelLayout` is the shared decimator — both the static text
 * renderer and the interactive tap-target renderer call into it so they
 * always agree on which labels are visible at the current width.
 */

import React from 'react';
import type { ChromeElement } from './chart-chrome.types.js';

export type LabelHover = { rowIdx: number; labelIdx: number } | null;

const TICK_COLOR = 'var(--text-muted)';
const TICK_FONT = 9;
const TICK_WEIGHT = 600;

/** Absolute floor for the per-row min-slot. Two short labels (e.g.
 *  "W1" and "W2") still need this much gap between centers so a tap
 *  target stays grabbable and the eye can separate them. */
const X_LABEL_MIN_SLOT_PX_FLOOR = 18;
/** Average glyph width at the tick font size. Used to estimate label
 *  pixel width from character count for the per-row min-slot. */
const TICK_FONT_AVG_CHAR_PX = 5;
/** Breathing room between label edges — bigger labels still want a
 *  visible gap so they don't read as one continuous string. */
const LABEL_GUTTER_PX = 8;

/** No CSS transitions on chrome elements — `useChartAnimation` lerps
 *  chrome positions every frame using the same easing as chart marks
 *  (`chrome-lerp.ts`). Adding a CSS transition would superimpose a
 *  second easing curve and visibly desync the row from the data. */
const LABEL_TRANSITION = 'none';

/** Pixel-driven label decimation: greedy interval scheduling,
 *  anchor-first. Edges (0, n-1) and `el.anchors` get placed first; the
 *  rest fill in source order, skipping any that would crash an existing
 *  placement (< minSlot gap). Output sorted ascending. */
export function xAxisLabelLayout(el: Extract<ChromeElement, { kind: 'x-axis-band' }>) {
    const { labels, range, xAt, anchors } = el;
    const n = labels.length;
    const plotWidth = Math.max(1, range[1] - range[0]);
    const uniformStep = plotWidth / Math.max(1, n);
    const at = xAt ?? ((i: number) => range[0] + i * uniformStep + uniformStep / 2);

    /* Per-row min-slot — widest label width + breathing room. Narrow
     *  tier rows ("W3", "May") stay dense; wide day labels still get
     *  breathing room. */
    const widestLabelChars = labels.reduce((m, l) => Math.max(m, l.length), 0);
    const minSlot = Math.max(X_LABEL_MIN_SLOT_PX_FLOOR, widestLabelChars * TICK_FONT_AVG_CHAR_PX + LABEL_GUTTER_PX);

    const placed = new Set<number>();
    const tryPlace = (i: number): boolean => {
        if (i < 0 || i >= n) return false;
        if (placed.has(i)) return true;
        const ci = at(i);
        for (const p of placed) {
            if (Math.abs(at(p) - ci) < minSlot) return false;
        }
        placed.add(i);
        return true;
    };

    if (n > 0) tryPlace(0);
    if (n > 1) tryPlace(n - 1);
    if (anchors) {
        for (const a of anchors) tryPlace(a);
    }
    for (let i = 1; i < n - 1; i++) tryPlace(i);

    const indices = [...placed].sort((a, b) => a - b);
    const stride = indices.length > 1 ? Math.max(1, Math.round(n / indices.length)) : 1;
    let minNeighborGap = plotWidth;
    for (let i = 1; i < indices.length; i++) {
        minNeighborGap = Math.min(minNeighborGap, at(indices[i]) - at(indices[i - 1]));
    }
    const maxChars = Math.max(4, Math.floor(minNeighborGap / TICK_FONT_AVG_CHAR_PX));
    const rotate = stride === 1 && labels.some(l => l.length > maxChars);
    return { indices, at, step: uniformStep, stride, maxChars, rotate, range };
}

export function XAxisBand({
    el, hoveredIdx,
}: {
    el: Extract<ChromeElement, { kind: 'x-axis-band' }>;
    hoveredIdx: number | null;
}) {
    const { labels, y, keys, leadingEdgeXs, trailingEdgeXs } = el;
    const { indices, at, maxChars, rotate, range } = xAxisLabelLayout(el);
    const DIVIDER_TOP_OFFSET = 6;
    const DIVIDER_H = 12;
    const hoverLeftX = hoveredIdx != null ? leadingEdgeXs?.[hoveredIdx] : undefined;
    const hoverRightX = hoveredIdx != null ? trailingEdgeXs?.[hoveredIdx] : undefined;
    const renderDivider = (x: number, opacity: number, idKey: string) => (
        <line key={idKey}
            x1={0} x2={0}
            y1={y + DIVIDER_TOP_OFFSET} y2={y + DIVIDER_TOP_OFFSET + DIVIDER_H}
            stroke={TICK_COLOR} strokeWidth={1} opacity={opacity}
            style={{ transform: `translateX(${x}px)`, transition: LABEL_TRANSITION }}
        />
    );
    return (
        <>
            {leadingEdgeXs && indices.slice(1).map((i) => {
                const x = leadingEdgeXs[i];
                if (typeof x !== 'number') return null;
                if (x < range[0] - 1 || x > range[1] + 1) return null;
                return renderDivider(x, 0.35, `div:${keys?.[i] ?? i}`);
            })}
            {typeof hoverLeftX === 'number' && hoverLeftX >= range[0] - 1 && hoverLeftX <= range[1] + 1 &&
                renderDivider(hoverLeftX, 0.85, 'hover-div-left')}
            {typeof hoverRightX === 'number' && hoverRightX >= range[0] - 1 && hoverRightX <= range[1] + 1 &&
                renderDivider(hoverRightX, 0.85, 'hover-div-right')}
            {indices.map((i) => {
                const l = labels[i];
                const cx = at(i);
                if (cx < range[0] - 1 || cx > range[1] + 1) return null;
                const display = l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l;
                const key = keys?.[i] ?? l;
                const transform = rotate
                    ? `translate(${cx}px, ${y + 14}px) rotate(-40deg)`
                    : `translate(${cx}px, ${y + 14}px)`;
                return (
                    <text key={key}
                        textAnchor={rotate ? 'end' : 'middle'}
                        fill={TICK_COLOR} fontSize={TICK_FONT} fontWeight={TICK_WEIGHT}
                        style={{ transform, transition: LABEL_TRANSITION }}>
                        {display}
                    </text>
                );
            })}
        </>
    );
}

/** Interactive layer for X-axis labels — transparent tap rects in the
 *  bottom margin, one per visible (post-decimation) label. Lives in a
 *  separate `<g pointerEvents="auto">` so plot-area clicks pass through
 *  to the hit layer below. */
export function XAxisBandTapTargets({
    el, rowIdx, onLabelClick, onLabelHover,
}: {
    el: Extract<ChromeElement, { kind: 'x-axis-band' }>;
    rowIdx: number;
    onLabelClick?: (idx: number, label: string, periodKey?: string) => void;
    onLabelHover: (h: LabelHover) => void;
}) {
    const { labels, y, keys } = el;
    const { indices, at, step, stride, range } = xAxisLabelLayout(el);
    const tapHeight = 18;
    const cursor = onLabelClick ? 'pointer' : 'default';
    return (
        <>
            {indices.map((i) => {
                const cx = at(i);
                if (cx < range[0] - 1 || cx > range[1] + 1) return null;
                const tapW = Math.max(step * stride, 24);
                const key = keys?.[i] ?? labels[i];
                return (
                    <rect key={key}
                        width={tapW} height={tapHeight}
                        fill="transparent" pointerEvents="all"
                        style={{
                            cursor,
                            transform: `translate(${cx - tapW / 2}px, ${y + 2}px)`,
                            transition: LABEL_TRANSITION,
                        }}
                        onMouseEnter={() => onLabelHover({ rowIdx, labelIdx: i })}
                        onMouseLeave={() => onLabelHover(null)}
                        onClick={(e) => {
                            if (!onLabelClick) return;
                            e.stopPropagation();
                            onLabelClick(i, labels[i], keys?.[i]);
                        }} />
                );
            })}
        </>
    );
}
