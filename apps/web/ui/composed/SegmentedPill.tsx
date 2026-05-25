/**
 * SegmentedPill — single rounded-pill container with N inline segments
 * and a sliding indicator that translates to the active segment. Used
 * for "pick one of these" choices where the options live on a continuum
 * (window-width: 7/30/90/all, granularity: day/week/month, etc.).
 *
 * The indicator is one absolutely-positioned `<BaseBox>` whose `left`
 * and `width` are computed from the active option's measured DOM offset
 * — no fixed segment width assumption, so labels of any length work.
 * Position updates run in a `useLayoutEffect` so the indicator sits
 * correctly on first paint without an empty-flash.
 *
 * The shell uses the same glass-tag recipe the chart engine uses for
 * tooltips and range badges so the visual language stays coherent.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseText } from '../primitives/BaseText.js';

export interface SegmentedPillOption<TValue extends string = string> {
    value: TValue;
    label: string;
}

export interface SegmentedPillProps<TValue extends string = string> {
    options: SegmentedPillOption<TValue>[];
    value: TValue;
    onChange: (next: TValue) => void;
    disabled?: boolean;
}

interface IndicatorRect {
    left: number;
    width: number;
}

export function SegmentedPill<TValue extends string = string>({
    options, value, onChange, disabled,
}: SegmentedPillProps<TValue>) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [indicator, setIndicator] = useState<IndicatorRect | null>(null);
    const activeIdx = options.findIndex(o => o.value === value);

    /* Recompute the indicator's left/width whenever the active segment
     * changes OR the container resizes. Measured from DOM offsets so
     * variable-length labels (e.g. "DAY" vs "QUARTER") sit correctly. */
    useLayoutEffect(() => {
        const measure = () => {
            const container = containerRef.current;
            const seg = segmentRefs.current[activeIdx];
            if (!container || !seg) return;
            const cRect = container.getBoundingClientRect();
            const sRect = seg.getBoundingClientRect();
            setIndicator({ left: sRect.left - cRect.left, width: sRect.width });
        };
        measure();
        const obs = new ResizeObserver(measure);
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, [activeIdx, options.length]);

    return (
        <BaseBox
            ref={containerRef as React.Ref<HTMLDivElement>}
            style={{
                position: 'relative', display: 'inline-flex', flexDirection: 'row',
                /* Horizontal padding matches vertical so the indicator
                 * never crowds the shell edge when it's at the left or
                 * right segment. Asymmetric padding made the edges feel
                 * cramped vs. the middle; matching them keeps the gap
                 * between indicator and shell uniform on all sides. */
                padding: '4px',
                borderRadius: 'var(--radius-full, 999px)',
                border: '1px solid var(--border-ghost, var(--border-main))',
                background: 'transparent',
                opacity: disabled ? 0.55 : 1,
                transition: 'opacity 180ms ease',
            }}
        >
            {/* Sliding indicator. transform-based animation so layout
              * doesn't reflow when it moves; the segments below paint
              * their text over a stable position. */}
            {indicator && (
                <BaseBox style={{
                    position: 'absolute', top: '4px', bottom: '4px',
                    left: 0,
                    width: `${indicator.width}px`,
                    transform: `translateX(${indicator.left - 0}px)`,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-ghost, var(--border-main))',
                    borderRadius: 'var(--radius-full, 999px)',
                    transition: 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), width 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }} />
            )}
            {options.map((opt, i) => {
                const active = opt.value === value;
                return (
                    <BaseAction
                        key={opt.value}
                        ref={(el) => { segmentRefs.current[i] = el; }}
                        onClick={() => { if (!active && !disabled) onChange(opt.value); }}
                        style={{
                            position: 'relative', zIndex: 1,
                            padding: 'var(--space-0-5, 0.125rem) var(--space-2, 0.5rem)',
                            borderRadius: 'var(--radius-full, 999px)',
                            background: 'transparent',
                            border: 'none',
                            cursor: active ? 'default' : 'pointer',
                            opacity: active ? 1 : 0.55,
                            transition: 'opacity 180ms ease',
                        }}
                    >
                        <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {opt.label}
                        </BaseText>
                    </BaseAction>
                );
            })}
        </BaseBox>
    );
}
