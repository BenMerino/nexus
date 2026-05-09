import React, { useState, useCallback, useRef } from 'react';
import { BaseBox } from '../primitives/BaseBox';
import { BaseText } from '../primitives/BaseText';
import { fmtValue } from './svg-parts';

/* ── Drag Range ──────────────────────────────────────────────
 * Click-drag on a cartesian chart to select a range of data
 * points and compare start vs end values.
 *
 * Produces: SVG highlight rect + portalled comparison badge.
 * ──────────────────────────────────────────────────────────── */

export interface RangeEndpoint {
    idx: number;
    label: string;
    value: number;
    vbX: number;
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

/** SVG highlight rect for the selected range */
export function RangeHighlight({ range, yR }: { range: DragRangeState; yR: [number, number] }) {
    if (!range.start || !range.end) return null;
    const x1 = Math.min(range.start.vbX, range.end.vbX);
    const x2 = Math.max(range.start.vbX, range.end.vbX);
    if (x2 - x1 < 1) return null;
    return (
        <rect
            x={x1} y={yR[0]} width={x2 - x1} height={yR[1] - yR[0]}
            fill="var(--primary)" opacity={0.08} pointerEvents="none" rx={2}
        />
    );
}

/** Comparison badge — glass surface, absolute within chart wrapper */
export function RangeBadge({ range, scaleX, yLabel, currencyCfg }: {
    range: DragRangeState; svgRef?: React.RefObject<SVGSVGElement | null>;
    scaleX: number; yLabel?: string; currencyCfg?: { currency?: string; currencyFormat?: string };
}) {
    if (!range.start || !range.end || range.dragging) return null;
    if (range.start.idx === range.end.idx) return null;
    const [s, e] = range.start.idx < range.end.idx ? [range.start, range.end] : [range.end, range.start];
    const delta = e.value - s.value;
    const pct = s.value !== 0 ? Math.round((delta / s.value) * 100) : 0;
    const sign = delta >= 0 ? '+' : '';
    const color = delta >= 0 ? 'var(--status-success, #10b981)' : 'var(--status-error, #ef4444)';
    const midX = ((s.vbX + e.vbX) / 2) * scaleX;

    return (
        <BaseBox
            px="3" py="2" surfaceRadius="sm" shadow="lg"
            style={{ position: 'absolute', left: midX, top: -4, transform: 'translate(-50%, -100%)', zIndex: 50,
                background: 'var(--glass-bg, var(--bg-card))', backdropFilter: 'blur(12px)',
                border: `1px solid ${color}`, pointerEvents: 'none' }}
        >
            <BaseText variant="detail" style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                {s.label} → {e.label}
            </BaseText>
            <BaseText style={{ color, fontSize: 13, fontWeight: 700 }}>
                {delta < 0 ? '-' : '+'}{fmtValue(Math.abs(delta), currencyCfg)} ({sign}{pct}%) {yLabel || ''}
            </BaseText>
        </BaseBox>
    );
}
