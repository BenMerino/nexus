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
import { decimateByMinSlot } from './label-decimate.js';
import { abbreviateLabel } from './label-abbreviate.js';
import { wrapLabel } from './label-wrap.js';

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
    const { labels, range, xAt, anchors, leadingEdgeXs, trailingEdgeXs, keepAll } = el;
    const n = labels.length;
    const plotWidth = Math.max(1, range[1] - range[0]);
    const uniformStep = plotWidth / Math.max(1, n);
    const at = xAt ?? ((i: number) => range[0] + i * uniformStep + uniformStep / 2);

    /* Categorical x (institutions, journals): every bar's label IS its
     *  identity, so keep ALL of them and rotate to fit — never decimate a
     *  bar's name away. Abbreviation (`abbreviateLabel`, applied at render)
     *  shrinks each to its per-slot budget; rotation buys the vertical room.
     *  This bypasses the pixel-min-slot decimator that (correctly) thins
     *  TEMPORAL axes, where labels are samples, not identities. */
    if (keepAll && n > 0) {
        const allIdx = labels.map((_, i) => i);
        /* Reserve a gutter inside the bar slot so a wrapped line stays clear of
         *  its dividers. Without it the char budget (uniformStep / avg-char-px)
         *  let a single wide LOWERCASE word ("Horticulturae") pass the count
         *  test while its real pixels overran the slot edge — avg-char-px (5)
         *  under-measures all-lowercase words. Budgeting the gutter out makes
         *  such words ellipsise just before they'd touch the divider. */
        const maxChars = Math.max(X_LABEL_MIN_CHARS, Math.floor((uniformStep - LABEL_GUTTER_PX) / TICK_FONT_AVG_CHAR_PX));
        /* Categorical labels WRAP onto multiple upright lines (label-wrap)
         *  rather than rotate — easier to read and no edge overhang. */
        return { indices: allIdx, at, step: uniformStep, stride: 1, maxChars, rotate: false, wrap: true, range };
    }

    /* Per-row min-slot — widest label width + breathing room. Narrow
     *  tier rows ("W3", "May") stay dense; wide day labels still get
     *  breathing room. */
    const widestLabelChars = labels.reduce((m, l) => Math.max(m, l.length), 0);
    const minSlot = Math.max(X_LABEL_MIN_SLOT_PX_FLOOR, widestLabelChars * TICK_FONT_AVG_CHAR_PX + LABEL_GUTTER_PX);

    /* The decimator is the SINGLE spatial authority: a label places only
     *  if it clears neighbour labels AND its own bucket's boundary
     *  dividers, so dates never render on top of the grid ticks. The
     *  clearance test uses the label's FULL rendered width (floored at
     *  `X_LABEL_MIN_CHARS`). The previous hard 4-glyph CAP under-measured
     *  wide labels — a 5-char "1850s" that never truncates was treated as
     *  4 glyphs, so it cleared the test while really overrunning its
     *  divider by a glyph. Truncation (`maxChars`, computed post-place)
     *  only ever NARROWS a label, so testing the full width is the
     *  conservative bound and can't itself cause a collision. */
    const minRenderedHalfWidth = (i: number) => {
        const chars = Math.max(X_LABEL_MIN_CHARS, labels[i].length);
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

    /* The shared decimator is the single spatial authority. `priority`
     *  (axis edges + semantic anchors) place first and bypass the
     *  divider-clearance test — they always show even in a clipped sliver
     *  bucket. Interior mid-period labels DO yield to dividers via
     *  `clears`, which is where crowding actually happens. All placements
     *  respect label↔label `minSlot` so priorities never overlap. */
    const indices = decimateByMinSlot({
        centers: labels.map((_, i) => at(i)),
        minSlotPx: minSlot,
        priority: anchors ? [...anchors] : [],
        clears: clearsDividers,
    });
    const stride = indices.length > 1 ? Math.max(1, Math.round(n / indices.length)) : 1;
    let minNeighborGap = plotWidth;
    for (let i = 1; i < indices.length; i++) {
        minNeighborGap = Math.min(minNeighborGap, at(indices[i]) - at(indices[i - 1]));
    }
    const maxChars = Math.max(X_LABEL_MIN_CHARS, Math.floor(minNeighborGap / TICK_FONT_AVG_CHAR_PX));
    const rotate = stride === 1 && labels.some(l => l.length > maxChars);
    return { indices, at, step: uniformStep, stride, maxChars, rotate, wrap: false, range };
}

export function XAxisBand({
    el, hoveredIdx,
}: {
    el: Extract<ChromeElement, { kind: 'x-axis-band' }>;
    hoveredIdx: number | null;
}) {
    const { labels, y, keys, leadingEdgeXs, trailingEdgeXs } = el;
    const { indices, at, maxChars, rotate, wrap, range } = xAxisLabelLayout(el);
    const LINE_H = 10;
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
                const key = keys?.[i] ?? l;
                /* Categorical: wrap the REAL words onto upright centered lines
                 *  (Universidad / de Talca) instead of rotating or folding to
                 *  initials. The slot's char budget decides the breaks; each
                 *  line is a <tspan> stacked by LINE_H, block centered on the
                 *  bar. wrapLabel keeps whole words, ellipsising only a single
                 *  word that alone overruns the slot. */
                if (wrap) {
                    const lines = wrapLabel(l, maxChars);
                    return (
                        <text key={key}
                            textAnchor="middle"
                            fill={TICK_COLOR} fontSize={TICK_FONT} fontWeight={TICK_WEIGHT}
                            style={{ transform: `translate(${cx}px, ${y + 12}px)`, transition: LABEL_TRANSITION }}>
                            {lines.map((ln, li) => (
                                <tspan key={li} x={0} dy={li === 0 ? 0 : LINE_H}>{ln}</tspan>
                            ))}
                        </text>
                    );
                }
                const display = abbreviateLabel(l, maxChars);
                /* Edge-aware anchoring. For curves the first/last points sit
                 *  AT the plot edges (xR[0]/xR[1]); a centered label there
                 *  overhangs — left into the y-axis gutter, right past the
                 *  plot. When a non-rotated label's center is within half
                 *  its rendered width of an edge, anchor it INWARD so the
                 *  glyphs stay inside the plot: `start` at the left edge,
                 *  `end` at the right. Interior labels stay centered. */
                const halfW = (display.length * TICK_FONT_AVG_CHAR_PX) / 2;
                const anchor = rotate
                    ? 'end'
                    : cx - halfW < range[0] ? 'start'
                    : cx + halfW > range[1] ? 'end'
                    : 'middle';
                const transform = rotate
                    ? `translate(${cx}px, ${y + 14}px) rotate(-40deg)`
                    : `translate(${cx}px, ${y + 14}px)`;
                return (
                    <text key={key}
                        textAnchor={anchor}
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
                /* Tap rect is one decimated slot wide (step * stride), but
                 *  CLAMPED to the plot range. With sparse data a slot can be
                 *  a third of the plot wide; an unclamped rect centered near
                 *  an edge then hangs hundreds of px off the side (the rect
                 *  overflow bug). The hit-area is a convenience — it must never
                 *  extend past the plot edges. Build [left,right] from the
                 *  ideal slot, clamp both ends, derive width from the clamped
                 *  span. */
                const idealHalf = Math.max(step * stride, 24) / 2;
                const left = Math.max(range[0], cx - idealHalf);
                const right = Math.min(range[1], cx + idealHalf);
                const tapW = Math.max(0, right - left);
                const key = keys?.[i] ?? labels[i];
                return (
                    <rect key={key}
                        width={tapW} height={tapHeight}
                        fill="transparent" pointerEvents="all"
                        style={{
                            cursor,
                            transform: `translate(${left}px, ${y + 2}px)`,
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
