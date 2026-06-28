import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { useTween } from '../primitives/tween.js';
import type { TimelineSpan } from './useTimelineSpan.js';
import { axisToIso, resolveAxisRange } from './useTimelineSpan.js';
import {
    axisRangeToWindow, axisToFraction, fractionFromClientX, fractionToAxis,
    formatDateLabel, nextAxisRangeForDrag, pickDragMode,
    type DragState,
} from './range-slider-logic.js';
import { generateTicks } from './range-slider-ticks.js';

/* ── ChartRangeSlider ────────────────────────────────────────
 * Windowed range slider. Track is the timeline ruler; the segment
 * on it is the chart's `[from, to]` window, freely positioned —
 * neither edge is anchored. Three gestures: drag-left handle,
 * drag-right handle, drag-middle (preserves width). One commit per
 * gesture-end carrying `{ windowDays, asOf }`. Math lives in
 * `range-slider-logic.ts`; this file is pointer plumbing + render.
 * ──────────────────────────────────────────────────────────── */

export interface ChartRangeSliderProps {
    span: TimelineSpan;
    windowDays: number | null;
    asOf: string | null;
    leftMarginPx: number;
    rightMarginPx: number;
    onWindowChange?: (window: { windowDays: number | null; asOf: string | null }) => void;
    disabled?: boolean;
}

/* Visual constants mirror the heatmap's ContinuousLegend (ValueLegend.tsx):
 * 0.4rem track height, 14px tall × 4px handle bar. The track here is a flat
 * `bg-card` band — no gradient — because non-heatmap charts don't have a
 * value scale to ramp through.
 *
 * Hit zone is decoupled from visuals: the visible track is thin, but the
 * pointer-capture area is `HIT_PAD_PX` taller above and below so the slider
 * is grabbable without pixel-precise aim. Handle hit tolerance is generous
 * so the user doesn't have to land within 7px of a 4px-wide bar. */
const TRACK_HEIGHT_REM = 0.4;
const HIT_PAD_PX = 6;
const HANDLE_HIT_TOLERANCE_PX = 24;
const TWEEN_MS = 280;

export function ChartRangeSlider({
    span, windowDays, asOf, leftMarginPx, rightMarginPx, onWindowChange, disabled = false,
}: ChartRangeSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);
    /** RAF guard: coalesce pointermove → one commit per frame, no more.
     * Avoids spamming the controller / WS with sub-frame updates. */
    const rafRef = useRef<number | null>(null);
    const pendingAxisRef = useRef<{ from: number; to: number } | null>(null);

    /* Single source of truth for the visible position: the live query.
     * No local preview state — when the user drags, we commit the new
     * window via onWindowChange and the controller's response (the new
     * directive, with its echoed query) flows back as updated props.
     * The slider re-renders at the new position because that's where
     * the data IS. Any inertia comes from the data pipeline, not from
     * client-side ghost-tracking. */
    const [fromAxis, toAxis] = useMemo(
        () => resolveAxisRange(span, windowDays, asOf),
        [span, windowDays, asOf],
    );
    /* Auto-picked tier ticks for the timeline span. Cached on
     *  `(earliest, totalDays)` — neither changes during a drag, so the
     *  ticks computation runs once per timeline change, not per frame. */
    const ticks = useMemo(
        () => generateTicks(span.earliest, span.totalDays),
        [span.earliest, span.totalDays],
    );
    const fromTarget = axisToFraction(fromAxis, span.totalDays);
    const toTarget = axisToFraction(toAxis, span.totalDays);
    /* Handles tween toward the prop value to smoothly animate external
     * data updates (a new directive, an SSE-driven window change). But
     * during the user's own drag, the handle should sit at the pointer
     * with zero lag — tweening while the user is the source of motion
     * makes the handle feel like it's chasing the cursor. So we disable
     * the tween while a drag is active and let the handle track the prop
     * directly; the prop is updated via the rAF-coalesced commit, so the
     * handle still moves at most once per frame. */
    const tweenedFromFraction = useTween(fromTarget, TWEEN_MS, false);
    const tweenedToFraction = useTween(toTarget, TWEEN_MS, false);
    const isDragging = dragRef.current !== null;
    const fromFraction = isDragging ? fromTarget : tweenedFromFraction;
    const toFraction = isDragging ? toTarget : tweenedToFraction;

    /** Coalesced commit: schedule one onWindowChange per animation frame
     * with the latest pending axis range. Drops intermediate values.
     * Server caches identical queries, so dragging back over a window
     * you've already seen is instant (Stream cache hit). */
    const flushCommit = useCallback(() => {
        rafRef.current = null;
        const next = pendingAxisRef.current;
        pendingAxisRef.current = null;
        if (!next || !onWindowChange) return;
        onWindowChange(axisRangeToWindow(next.from, next.to, span));
    }, [onWindowChange, span]);

    const requestCommit = useCallback((next: { from: number; to: number }) => {
        pendingAxisRef.current = next;
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(flushCommit);
    }, [flushCommit]);

    const beginDrag = useCallback((e: React.PointerEvent) => {
        if (disabled || !trackRef.current) return;
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        const fraction = fractionFromClientX(e.clientX, trackRef.current);
        const trackPx = trackRef.current.getBoundingClientRect().width || 1;
        const tolerance = HANDLE_HIT_TOLERANCE_PX / trackPx;
        const mode = pickDragMode(fraction, fromFraction, toFraction, tolerance);
        const drag: DragState = { mode, startFromAxis: fromAxis, startToAxis: toAxis, startFraction: fraction };
        dragRef.current = drag;
        const pointerAxis = fractionToAxis(fraction, span.totalDays);
        requestCommit(nextAxisRangeForDrag(drag, pointerAxis, fraction, span.totalDays));
    }, [disabled, fromFraction, toFraction, fromAxis, toAxis, span.totalDays, requestCommit]);

    const moveDrag = useCallback((e: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || !trackRef.current) return;
        const fraction = fractionFromClientX(e.clientX, trackRef.current);
        const pointerAxis = fractionToAxis(fraction, span.totalDays);
        requestCommit(nextAxisRangeForDrag(drag, pointerAxis, fraction, span.totalDays));
    }, [span.totalDays, requestCommit]);

    const endDrag = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current) return;
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        dragRef.current = null;
        // If a commit is queued, let it land — the final pointer position is
        // already in pendingAxisRef. RAF will flush in <16ms.
    }, []);

    /** Cleanup: drop the RAF if we unmount mid-gesture. */
    useEffect(() => () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }, []);

    const fromIso = axisToIso(fromAxis, span);
    const toIso = axisToIso(toAxis, span);

    const isWindowed = fromFraction > 0.001 || toFraction < 0.999;

    return (
        <BaseBox style={{
            position: 'relative', width: '100%',
            paddingLeft: `${leftMarginPx}px`, paddingRight: `${rightMarginPx}px`,
            paddingTop: '8px', paddingBottom: '8px', boxSizing: 'border-box',
        }}>
            {/* Hit zone: vertically padded transparent wrapper that owns pointer
                events. Width matches the visible track (full inner width), so
                fraction math against `trackRef.getBoundingClientRect().width`
                stays correct. The visible track sits centered inside it. */}
            <BaseBox
                ref={trackRef}
                onPointerDown={beginDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                    position: 'relative',
                    paddingTop: `${HIT_PAD_PX}px`,
                    paddingBottom: `${HIT_PAD_PX}px`,
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.55 : 1,
                    touchAction: 'none',
                }}
            >
                <BaseBox style={{
                    position: 'relative',
                    height: `${TRACK_HEIGHT_REM}rem`,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-ghost, var(--border-main))',
                    borderRadius: 'var(--radius-sm)',
                    pointerEvents: 'none',
                }}>
                    {/* Tier ticks — auto-picked from span, minor + major.
                     *  Renders FIRST so the dimming veil + active fill
                     *  layer on top. Major ticks reach slightly above /
                     *  below the track and use stronger opacity so the
                     *  parent-unit boundary reads at a glance. */}
                    {ticks.map((tk, i) => (
                        <BaseBox key={i} style={{
                            position: 'absolute',
                            left: `${tk.fraction * 100}%`,
                            top: tk.major ? '-3px' : 0,
                            bottom: tk.major ? '-3px' : 0,
                            width: '1px',
                            background: 'var(--text-muted)',
                            opacity: tk.major ? 0.6 : 0.25,
                            pointerEvents: 'none',
                        }} />
                    ))}
                    {/* Out-of-window dimming: greyscale veil over clipped regions, mirrors the
                        heatmap legend so viewers see at a glance which slice is "active." */}
                    {isWindowed && (
                        <>
                            <BaseBox style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${fromFraction * 100}%`, background: 'var(--bg-main)',
                                opacity: 0.7, pointerEvents: 'none', borderRadius: 'inherit' }} />
                            <BaseBox style={{ position: 'absolute', right: 0, top: 0, bottom: 0,
                                width: `${(1 - toFraction) * 100}%`, background: 'var(--bg-main)',
                                opacity: 0.7, pointerEvents: 'none', borderRadius: 'inherit' }} />
                        </>
                    )}
                    {/* Active window fill — subtle accent in the selected band. */}
                    <BaseBox style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${fromFraction * 100}%`, right: `${(1 - toFraction) * 100}%`,
                        background: 'color-mix(in srgb, var(--text-main) 18%, transparent)',
                        borderRadius: 'inherit', pointerEvents: 'none',
                    }} />
                    <Handle fraction={fromFraction} />
                    <Handle fraction={toFraction} />
                </BaseBox>
            </BaseBox>
            {/* Active-window date labels — row ALWAYS reserves its
             *  height, only the labels mount conditionally. Without the
             *  reserved height, the card jumps when the user drags away
             *  from the endpoints (handles enter "windowed" state and
             *  the labels suddenly need a row). */}
            <BaseBox style={{ position: 'relative', marginTop: '6px', height: '12px' }}>
                {isWindowed && (
                    <>
                        <DateLabel fraction={fromFraction} text={formatDateLabel(fromIso)} disabled={disabled} emphasized />
                        <DateLabel fraction={toFraction} text={formatDateLabel(toIso)} disabled={disabled} emphasized />
                    </>
                )}
            </BaseBox>
        </BaseBox>
    );
}

/* Drag handle: 4px-wide vertical bar centered on the track, visually
 * reinforced by a transparent 16px hit-tracker for hover affordance. The
 * actual pointer events are caught by the parent track's wrapper (which
 * has HIT_PAD_PX vertical padding) — the handle itself is non-interactive
 * to keep the simple cursor-fraction math working. */
function Handle({ fraction }: { fraction: number }) {
    return (
        <BaseBox style={{
            position: 'absolute',
            left: `${fraction * 100}%`,
            top: '-6px',
            bottom: '-6px',
            width: '16px',
            transform: 'translateX(-50%)',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            pointerEvents: 'none',
        }}>
            <BaseBox style={{
                width: '4px',
                height: '14px',
                background: 'var(--text-main)',
                borderRadius: 'var(--radius-xs)',
                boxShadow: '0 0 0 1px var(--bg-card), 0 0 0 2px color-mix(in srgb, var(--text-main) 30%, transparent)',
                transition: 'box-shadow 120ms ease',
            }} />
        </BaseBox>
    );
}

function DateLabel({ fraction, text, disabled, emphasized = false }: { fraction: number; text: string; disabled: boolean; emphasized?: boolean }) {
    return (
        <BaseText variant="detail" style={{
            position: 'absolute', left: `${fraction * 100}%`, transform: 'translateX(-50%)',
            fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            opacity: disabled ? 0.4 : (emphasized ? 1 : 0.5),
            whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
        }}>
            {text}
        </BaseText>
    );
}
