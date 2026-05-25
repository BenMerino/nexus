import React, { createContext, useContext, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { ToggleBar } from './ToggleBar.js';
import { rampColor } from './scales.js';
import { cs, fmtValue } from './svg-parts.js';
import { defaultLegendMode } from '../../architect/graph-composer.types.js';
import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ToggleFilter } from './graph-spatial.types.js';

/* ── Hover Probe Channel ─────────────────────────────────────
 * Renderers publish the currently hovered numeric value via this
 * context. The continuous legend reads it to draw a needle on
 * the gradient — turning the legend into a live readout.
 *
 * Renderers that don't publish: legend ignores (needle hidden).
 * Renderers that do: hover anywhere → needle slides + label updates.
 * ──────────────────────────────────────────────────────────── */
type HoverProbe = { value: number | null; setValue: (v: number | null) => void };
const HoverCtx = createContext<HoverProbe>({ value: null, setValue: () => { } });

export function HoverProbeProvider({ children }: { children: React.ReactNode }) {
    const [value, setValue] = useState<number | null>(null);
    const ctx = useMemo(() => ({ value, setValue }), [value]);
    return <HoverCtx.Provider value={ctx}>{children}</HoverCtx.Provider>;
}

/** Renderers call `useHoverProbe()` and invoke `setValue(v)` / `setValue(null)`
 *  on cell mouseenter/leave. No-op when no provider is mounted. */
export function useHoverProbe(): HoverProbe {
    return useContext(HoverCtx);
}

/* ── Color Clip State Hook ───────────────────────────────────
 * Owns the percentile clip window [lower, upper] in [0..1]. The
 * legend's drag handles call `setBounds`; GraphRender stamps the
 * `{lower, upper}` pair onto `directive.colorClip` so the pure
 * `family.sample()` reads it the same way it reads `seriesWeights`.
 *
 * No context, no provider — the bounds travel on the directive
 * itself, like every other client-runtime field on GraphDirective.
 * ──────────────────────────────────────────────────────────── */
export interface ColorClipState {
    lower: number;
    upper: number;
    setBounds: (l: number, u: number) => void;
}

export function useColorClip(): ColorClipState {
    const [bounds, setBoundsState] = useState<{ lower: number; upper: number }>({ lower: 0, upper: 1 });
    const setBounds = useCallback((l: number, u: number) => setBoundsState({ lower: l, upper: u }), []);
    return useMemo(() => ({ ...bounds, setBounds }), [bounds, setBounds]);
}

/* ── ValueLegend ─────────────────────────────────────────────
 * Universal "how to read this chart" surface. Three variants:
 *   - categorical: swatch+label chips (composes ToggleBar)
 *   - continuous:  gradient ramp + min/max value labels
 *   - size:        three reference dots at small/med/large
 *
 * Mode resolves from chart.legend (defaults to 'auto' → defaultLegendMode).
 * Renderers stay focused on marks; legend is drawn here.
 * ──────────────────────────────────────────────────────────── */

export function ValueLegend({ chart, filters, onToggle, clip }: {
    chart: GraphDirective;
    filters: ToggleFilter[];
    onToggle: (key: string) => void;
    /** Continuous-mode legends need a drag-handle state owner. Other modes
     *  ignore it. Optional so non-heatmap call sites stay untouched. */
    clip?: ColorClipState;
}) {
    const mode = chart.legend && chart.legend !== 'auto' ? chart.legend : defaultLegendMode(chart.type);
    if (mode === 'none') return null;
    if (mode === 'categorical') return <ToggleBar filters={filters} onToggle={onToggle} />;
    if (mode === 'continuous' && clip) return <ContinuousLegend chart={chart} clip={clip} />;
    if (mode === 'size') return <SizeLegend chart={chart} />;
    return null;
}

/** Gradient ramp bar with min/max labels, hover needle, and drag handles for
 *  percentile color-clipping. Reads `cs(chart).gradient` so the legend shows
 *  whatever ramp the renderer is sampling.
 *
 *  Handles publish bounds via ColorClip context. Renderers re-color in real
 *  time as the user drags. Bounds are normalized [0..1] of the data range. */
function ContinuousLegend({ chart, clip }: { chart: GraphDirective; clip: ColorClipState }) {
    const ramp = cs(chart).gradient ?? ['var(--status-success)', 'var(--status-warning)', 'var(--status-error)'];
    const data = chart.data as any[];
    const values = data.map((d: any) => d.value ?? 0).filter((v: any) => typeof v === 'number');
    const minV = values.length ? Math.min(...values) : 0;
    const maxV = values.length ? Math.max(...values) : 1;
    const stops = ramp.map((c, i) => `${c} ${(i / (ramp.length - 1)) * 100}%`).join(', ');
    const { value: hoverValue } = useHoverProbe();
    const { lower, upper, setBounds } = clip;
    const span = maxV - minV || 1;
    const needlePct = hoverValue == null ? null : Math.max(0, Math.min(1, (hoverValue - minV) / span)) * 100;
    const lowerVal = minV + lower * span;
    const upperVal = minV + upper * span;
    const barRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<'lower' | 'upper' | null>(null);

    // Pointer drag: anchor to bar's bounding rect, clamp into [0..1], keep
    // handles ordered (lower can't pass upper, min 4% gap so the gradient
    // window stays meaningful). Window-level move/up listeners so drag keeps
    // working even if the cursor leaves the bar.
    const onPointerDown = (which: 'lower' | 'upper') => (e: React.PointerEvent) => {
        e.preventDefault();
        setDragging(which);
    };
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: PointerEvent) => {
            const rect = barRef.current?.getBoundingClientRect();
            if (!rect) return;
            const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const GAP = 0.04;
            if (dragging === 'lower') setBounds(Math.min(t, upper - GAP), upper);
            else setBounds(lower, Math.max(t, lower + GAP));
        };
        const onUp = () => setDragging(null);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [dragging, lower, upper, setBounds]);

    // Reset on double-click anywhere on the bar — quick escape from a clipped state.
    const onDoubleClick = useCallback(() => setBounds(0, 1), [setBounds]);
    const isClipped = lower > 0.001 || upper < 0.999;

    return (
        <BaseBox display="flex" direction="row" density="tight" py="1" align="center" justify="center">
            <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)' }}>
                {fmtValue(minV, chart.currencyConfig)}
            </BaseText>
            <BaseBox ref={barRef as any} onDoubleClick={onDoubleClick} style={{
                position: 'relative',
                width: '8rem',
                height: '0.4rem',
                borderRadius: 'var(--radius-sm, 2px)',
                background: `linear-gradient(to right, ${stops})`,
                border: '1px solid var(--border-ghost, var(--border-main))',
            }}>
                {/* Out-of-window dimming: greyscale veil over clipped regions so
                    viewers see at a glance which slice of the ramp is "active." */}
                {isClipped && (
                    <>
                        <BaseBox style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${lower * 100}%`,
                            background: 'var(--bg-card)', opacity: 0.7, pointerEvents: 'none', borderRadius: 'inherit' }} />
                        <BaseBox style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(1 - upper) * 100}%`,
                            background: 'var(--bg-card)', opacity: 0.7, pointerEvents: 'none', borderRadius: 'inherit' }} />
                    </>
                )}
                {needlePct != null && (
                    <>
                        <BaseBox style={{ position: 'absolute', left: `${needlePct}%`, top: '-3px', bottom: '-3px',
                            width: '2px', transform: 'translateX(-50%)', background: 'var(--text-main)',
                            borderRadius: '1px', boxShadow: '0 0 0 1px var(--bg-card)', pointerEvents: 'none',
                            transition: 'left 80ms ease-out' }} />
                        <BaseText variant="detail" style={{ position: 'absolute', left: `${needlePct}%`, top: '100%',
                            marginTop: '0.125rem', transform: 'translateX(-50%)', fontSize: '9px', fontWeight: 700,
                            color: 'var(--text-main)', whiteSpace: 'nowrap', pointerEvents: 'none',
                            transition: 'left 80ms ease-out' }}>
                            {fmtValue(hoverValue!, chart.currencyConfig)}
                        </BaseText>
                    </>
                )}
                <Handle pct={lower * 100} active={dragging === 'lower'} onPointerDown={onPointerDown('lower')} />
                <Handle pct={upper * 100} active={dragging === 'upper'} onPointerDown={onPointerDown('upper')} />
                {isClipped && (
                    <>
                        <BaseText variant="detail" style={{ position: 'absolute', left: `${lower * 100}%`, bottom: '100%',
                            marginBottom: '0.25rem', transform: 'translateX(-50%)', fontSize: '8px', fontWeight: 600,
                            color: 'var(--text-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {fmtValue(lowerVal, chart.currencyConfig)}
                        </BaseText>
                        <BaseText variant="detail" style={{ position: 'absolute', left: `${upper * 100}%`, bottom: '100%',
                            marginBottom: '0.25rem', transform: 'translateX(-50%)', fontSize: '8px', fontWeight: 600,
                            color: 'var(--text-muted)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {fmtValue(upperVal, chart.currencyConfig)}
                        </BaseText>
                    </>
                )}
            </BaseBox>
            <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)' }}>
                {fmtValue(maxV, chart.currencyConfig)}
            </BaseText>
        </BaseBox>
    );
}

/** Drag handle: small vertical bar above/below the gradient. Cursor is `ew-resize`,
 *  hit-zone is wider than the visible mark so it's actually grabbable. */
function Handle({ pct, active, onPointerDown }: { pct: number; active: boolean; onPointerDown: (e: React.PointerEvent) => void }) {
    return (
        <BaseBox onPointerDown={onPointerDown} style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '-6px',
            bottom: '-6px',
            width: '14px',
            transform: 'translateX(-50%)',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
        }}>
            <BaseBox style={{
                width: '4px',
                height: '14px',
                background: 'var(--text-main)',
                borderRadius: '2px',
                boxShadow: active
                    ? '0 0 0 2px var(--bg-card), 0 0 0 3px var(--text-main)'
                    : '0 0 0 1px var(--bg-card)',
                transition: 'box-shadow 120ms ease',
            }} />
        </BaseBox>
    );
}

/** Reference circles at small/med/large with their `z` values. Bubble area
 *  scales with z, so showing three reference sizes lets viewers calibrate. */
function SizeLegend({ chart }: { chart: GraphDirective }) {
    const data = chart.data as any[];
    const zs = data.map((d: any) => d.z ?? 1).filter((v: any) => typeof v === 'number' && v > 0);
    if (zs.length < 2) return null;
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const midZ = (minZ + maxZ) / 2;
    const samples = [
        { v: minZ, r: 4 + (minZ / maxZ) * 16 * 0.3 },
        { v: midZ, r: 4 + (midZ / maxZ) * 16 * 0.65 },
        { v: maxZ, r: 4 + 16 },
    ];
    return (
        <BaseBox display="flex" direction="row" density="tight" py="1" align="end" justify="center">
            {samples.map((s, i) => (
                <BaseBox key={i} display="flex" direction="col" density="tight" align="center">
                    <BaseBox style={{
                        width: `${s.r * 1.5}px`,
                        height: `${s.r * 1.5}px`,
                        borderRadius: 'var(--radius-full, 999px)',
                        background: 'var(--primary)',
                        opacity: 0.6,
                    }} />
                    <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {fmtValue(Math.round(s.v), chart.currencyConfig)}
                    </BaseText>
                </BaseBox>
            ))}
        </BaseBox>
    );
}
