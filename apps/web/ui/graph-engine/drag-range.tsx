import React, { useState, useCallback, useRef } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { GlassTag } from './GlassTag.js';
import { fmtValue } from './svg-parts.js';
import type { DragEndpoint } from './chart-primitives-cartesian.js';

/* ── Drag Range ──────────────────────────────────────────────
 * Click-drag on a cartesian chart to select a range of data
 * points and compare start vs end values.
 *
 * Produces: SVG highlight rect + two endpoint tags (label + value;
 * end tag also carries the % delta colored green/red).
 * ──────────────────────────────────────────────────────────── */

export interface RangeEndpoint {
    /** Bucket index in the FRAME the endpoint was captured in. Stale
     *  after a pan/zoom — do NOT trust for rendering. Used only for
     *  the start-vs-end ordering at capture time. */
    idx: number;
    /** Display label at capture time. Re-derived at render time from
     *  the current frame's bucket lookup by `iso`. */
    label: string;
    /** Value at capture time. Same caveat as `label`. */
    value: number;
    /** ViewBox-x at capture time. Stale after pan/zoom. Renderer
     *  re-projects from `iso` against the current layout. */
    vbX: number;
    /** ViewBox-y at capture time. Same caveat as `vbX`. */
    vbY: number;
    /** Bucket's `__startISO` — the durable timeline anchor. The
     *  selection survives pan/zoom because the iso is matched against
     *  the new frame's buckets, not against stale pixel positions. */
    iso?: string;
}

export interface DragRangeState {
    start: RangeEndpoint | null;
    end: RangeEndpoint | null;
    dragging: boolean;
}

const INIT: DragRangeState = { start: null, end: null, dragging: false };

export function useDragRange() {
    const [range, setRange] = useState<DragRangeState>(INIT);
    const startRef = useRef<RangeEndpoint | null>(null);

    const onDown = useCallback((ep: RangeEndpoint) => {
        startRef.current = ep;
        setRange({ start: ep, end: ep, dragging: true });
    }, []);

    const onDrag = useCallback((ep: RangeEndpoint) => {
        if (!startRef.current) return;
        setRange({ start: startRef.current, end: ep, dragging: true });
    }, []);

    const onUp = useCallback(() => {
        setRange(prev => {
            if (!prev.start || !prev.end || prev.start.idx === prev.end.idx) return INIT;
            const [s, e] = prev.start.idx < prev.end.idx ? [prev.start, prev.end] : [prev.end, prev.start];
            return { start: s, end: e, dragging: false };
        });
        startRef.current = null;
    }, []);

    const clear = useCallback(() => { startRef.current = null; setRange(INIT); }, []);

    return { range, onDown, onDrag, onUp, clear };
}

/** Resolve a stored endpoint against the current frame. Returns the
 *  live `{vbX, value, label}` when the iso is visible; null when the
 *  iso is off-screen (panned past, zoomed out of the window). If the
 *  endpoint has no iso (legacy / non-time-series), falls back to the
 *  stored cache so behaviour degrades gracefully. */
function liveFor(
    ep: RangeEndpoint,
    isoToFrame: ((iso: string) => DragEndpoint | null) | null,
): DragEndpoint | null {
    if (!ep.iso || !isoToFrame) return { idx: ep.idx, label: ep.label, value: ep.value, vbX: ep.vbX, vbY: ep.vbY, iso: ep.iso };
    return isoToFrame(ep.iso);
}

/** Two vertical rails — one at each endpoint — drawn full-plot-height
 *  behind the endpoint dots. Replaces the filled selection band; reads
 *  as "these are the two points I'm comparing" without obscuring the
 *  data between them. Both rails re-project from `iso` every frame, so
 *  they stay glued to their buckets across pan/zoom. */
export function RangeHighlight({ range, yR, isoToFrame }: {
    range: DragRangeState; yR: [number, number];
    isoToFrame?: ((iso: string) => DragEndpoint | null) | null;
}) {
    if (!range.start || !range.end) return null;
    const liveStart = liveFor(range.start, isoToFrame ?? null);
    const liveEnd = liveFor(range.end, isoToFrame ?? null);
    if (!liveStart || !liveEnd) return null;
    return (
        <g pointerEvents="none">
            <line x1={liveStart.vbX} x2={liveStart.vbX} y1={yR[0]} y2={yR[1]}
                stroke="var(--text-muted)" strokeWidth={1} opacity={0.5} />
            <line x1={liveEnd.vbX} x2={liveEnd.vbX} y1={yR[0]} y2={yR[1]}
                stroke="var(--text-muted)" strokeWidth={1} opacity={0.5} />
        </g>
    );
}

/** Value tags pinned to the drag selection's two endpoints. The start
 *  tag shows the start bucket's label + value; the end tag adds the
 *  percentage delta relative to start, colored by direction (green up,
 *  red down).
 *
 *  Endpoints are re-projected from their stored `iso` every render via
 *  `isoToFrame` — so on pan/zoom each tag moves WITH its bucket. An
 *  endpoint whose iso isn't visible in the current window is hidden;
 *  the other one stays. Δ% uses live values, so a partial-visibility
 *  view still reports the right percentage from the stored counterpart. */
export function RangeEndpointTags({ range, scaleX, scaleY, currencyCfg, isoToFrame, plotXR }: {
    range: DragRangeState; scaleX: number; scaleY: number;
    currencyCfg?: { currency?: string; currencyFormat?: string };
    isoToFrame?: ((iso: string) => DragEndpoint | null) | null;
    /** Plot x-range in viewBox px. The end tag points right by default, but
     *  the right edge of the card has no axis gutter — a right-pointing tag
     *  on the last bucket overflows the clipped card. So when the end
     *  endpoint sits in the right portion of the plot, the tag flips to point
     *  inward (left) instead. The start tag keeps pointing left: the left
     *  side has the y-axis gutter, so its outer tag always has room. */
    plotXR?: [number, number] | null;
}) {
    if (!range.start || !range.end) return null;
    if (range.start.idx === range.end.idx) return null;
    const [storedS, storedE] = range.start.idx < range.end.idx
        ? [range.start, range.end]
        : [range.end, range.start];
    const liveS = liveFor(storedS, isoToFrame ?? null);
    const liveE = liveFor(storedE, isoToFrame ?? null);
    const sVal = liveS?.value ?? storedS.value;
    const eVal = liveE?.value ?? storedE.value;
    const delta = eVal - sVal;
    const pct = sVal !== 0 ? Math.round((delta / sVal) * 100) : 0;
    const deltaColor = delta >= 0 ? 'var(--status-success, #10b981)' : 'var(--status-error, #ef4444)';
    const sign = delta >= 0 ? '+' : '';
    const span = plotXR ? Math.max(1, plotXR[1] - plotXR[0]) : 1;
    const endSide: 'left' | 'right' = (plotXR && liveE && (liveE.vbX - plotXR[0]) / span > 0.6) ? 'left' : 'right';
    return (
        <>
            {liveS && (
                <EndpointMarker
                    x={liveS.vbX * scaleX} y={liveS.vbY * scaleY}
                    side="left" dotColor="var(--text-main)"
                    label={liveS.label} value={fmtValue(liveS.value, currencyCfg)}
                />
            )}
            {liveE && (
                <EndpointMarker
                    x={liveE.vbX * scaleX} y={liveE.vbY * scaleY}
                    side={endSide} dotColor={deltaColor}
                    label={liveE.label} value={fmtValue(liveE.value, currencyCfg)}
                    delta={sVal !== 0 ? `${sign}${pct}%` : undefined}
                    deltaColor={deltaColor}
                    borderColor={deltaColor}
                />
            )}
        </>
    );
}

/* Visual constants for the endpoint marker:
 *   DOT_R px radius for the on-curve dot
 *   GAP px between dot and tag's nearest edge */
const DOT_R = 4;
const GAP = 8;

/** Marker = a dot on the data point at (x, y) + a tag adjacent to it.
 *  The tag sits to the OUTSIDE of the selection band (left tag's right
 *  edge near the dot, right tag's left edge near the dot) so the band
 *  itself stays unobscured. End tag's dot uses the delta-color so the
 *  up/down direction reads at a glance even before the user reads the %.
 */
function EndpointMarker({ x, y, side, dotColor, label, value, delta, deltaColor, borderColor }: {
    x: number; y: number; side: 'left' | 'right'; dotColor: string;
    label: string; value: string;
    delta?: string; deltaColor?: string; borderColor?: string;
}) {
    /* Tag is positioned so its nearest edge sits `GAP` away from the dot.
     *  CSS translate-X handles the "anchor by far edge" math without us
     *  measuring the tag's width. */
    const tagLeft = side === 'left' ? x - DOT_R - GAP : x + DOT_R + GAP;
    const tagTranslate = side === 'left' ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
    return (
        <>
            <BaseBox style={{
                position: 'absolute', left: x, top: y,
                width: `${DOT_R * 2}px`, height: `${DOT_R * 2}px`,
                transform: 'translate(-50%, -50%)',
                background: dotColor, borderRadius: '50%',
                boxShadow: '0 0 0 2px var(--bg-card)',
                pointerEvents: 'none', zIndex: 49,
            }} />
            <GlassTag
                shadow="md"
                borderColor={borderColor}
                style={{ position: 'absolute', left: tagLeft, top: y, transform: tagTranslate, zIndex: 49 }}
            >
                <BaseText variant="detail" style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    {label}
                </BaseText>
                <BaseText style={{ fontSize: 12, fontWeight: 700 }}>
                    {value}
                    {delta && (
                        <BaseText as="span" style={{ color: deltaColor, marginLeft: 6, fontSize: 11, fontWeight: 700 }}>
                            {delta}
                        </BaseText>
                    )}
                </BaseText>
            </GlassTag>
        </>
    );
}
