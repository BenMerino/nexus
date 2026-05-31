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
/** Min gap a label must keep from its bucket's boundary dividers. The
 *  decimator drops a label that can't clear its dividers by this much,
 *  so dates never render on top of the grid ticks. */
const DIVIDER_CLEARANCE_PX = 2;
/** Minimum glyphs a truncated label renders at (matches the `maxChars`
 *  floor below). The divider-clearance test uses this as the label's
 *  smallest possible footprint — a label only yields to a divider when
 *  even its ellipsised form (`X…`) wouldn't fit inside its bucket. */
const X_LABEL_MIN_CHARS = 4;

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
    const { labels, range, xAt, anchors, leadingEdgeXs, trailingEdgeXs } = el;
    const n = labels.length;
    const plotWidth = Math.max(1, range[1] - range[0]);
    const uniformStep = plotWidth / Math.max(1, n);
    const at = xAt ?? ((i: number) => range[0] + i * uniformStep + uniformStep / 2);

    /* Per-row min-slot — widest label width + breathing room. Narrow
     *  tier rows ("W3", "May") stay dense; wide day labels still get
     *  breathing room. */
    const widestLabelChars = labels.reduce((m, l) => Math.max(m, l.length), 0);
    const minSlot = Math.max(X_LABEL_MIN_SLOT_PX_FLOOR, widestLabelChars * TICK_FONT_AVG_CHAR_PX + LABEL_GUTTER_PX);

    /* The decimator is the SINGLE spatial authority: a label places only
     *  if it clears neighbour labels AND its own bucket's boundary
     *  dividers, so dates never render on top of the grid ticks. The
     *  clearance test uses the label's MINIMUM rendered footprint — the
     *  ellipsis-truncation floor (`X_LABEL_MIN_CHARS` glyphs) — because
     *  a label that doesn't fit whole is shortened (and may rotate)
     *  before it is dropped. So we only drop a label when even its
     *  truncated form would overrun a divider. Dividers always render
     *  (they're the grid); the label yields. */
    const minRenderedHalfWidth = (i: number) => {
        const chars = Math.min(labels[i].length, X_LABEL_MIN_CHARS);
        return (chars * TICK_FONT_AVG_CHAR_PX) / 2;
    };
    const clearsDividers = (i: number): boolean => {
        const lead = leadingEdgeXs?.[i];
        const trail = trailingEdgeXs?.[i];
        if (typeof lead !== 'number' || typeof trail !== 'number') return true;
        const c = at(i);
        const hw = minRenderedHalfWidth(i) + DIVIDER_CLEARANCE_PX;
        return (c - hw) >= lead && (c + hw) <= trail;
    };

    const placed = new Set<number>();
    /* `priority` placements (axis edges + semantic anchors) are
     *  navigationally important and bypass the divider-clearance test —
     *  they always show even in a clipped sliver bucket. Interior
     *  mid-period labels DO yield to dividers, which is where crowding
     *  actually happens. All placements still respect label↔label
     *  `minSlot` so priorities never overlap each other. */
    const tryPlace = (i: number, priority = false): boolean => {
        if (i < 0 || i >= n) return false;
        if (placed.has(i)) return true;
        if (!priority && !clearsDividers(i)) return false;
        const ci = at(i);
        for (const p of placed) {
            if (Math.abs(at(p) - ci) < minSlot) return false;
        }
        placed.add(i);
        return true;
    };

    if (n > 0) tryPlace(0, true);
    if (n > 1) tryPlace(n - 1, true);
    if (anchors) {
        for (const a of anchors) tryPlace(a, true);
    }
    for (let i = 1; i < n - 1; i++) tryPlace(i);

    const indices = [...placed].sort((a, b) => a - b);
    const stride = indices.length > 1 ? Math.max(1, Math.round(n / indices.length)) : 1;
    let minNeighborGap = plotWidth;
    for (let i = 1; i < indices.length; i++) {
        minNeighborGap = Math.min(minNeighborGap, at(indices[i]) - at(indices[i - 1]));
    }
    const maxChars = Math.max(X_LABEL_MIN_CHARS, Math.floor(minNeighborGap / TICK_FONT_AVG_CHAR_PX));
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
