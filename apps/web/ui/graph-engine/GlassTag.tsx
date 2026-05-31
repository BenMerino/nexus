import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';

/* ── GlassTag ────────────────────────────────────────────────
 * The chart-engine's canonical floating-tag surface. Used by the
 * hover tooltip, the range-comparison badge, and the range-endpoint
 * value tags. All three share the same recipe: glass background,
 * blur-saturate backdrop, ghost border, soft shadow, rounded-sm.
 *
 * Centralising the recipe means a tweak to the surface trickles
 * through every floating chart overlay (S3-SOURCE). The previous
 * implementations had the same six lines copy-pasted across three
 * files; if you change one you must change all three or the chart
 * loses visual coherence.
 *
 * The component is a thin shim — `BaseBox` does the layout work and
 * accepts inline `style` for positioning. Callers stay responsible
 * for `position` / `left` / `top` / `transform` / `zIndex` since
 * those vary per consumer (portal vs. wrapper-relative, top vs.
 * midpoint, etc.).
 * ──────────────────────────────────────────────────────────── */

export interface GlassTagProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
    /** Shadow weight. Tooltip uses `xl` (portaled, off the card),
     *  range-badge / endpoint tags use `lg` (inside the card). */
    shadow?: 'sm' | 'md' | 'lg' | 'xl';
    /** Border color override — defaults to the ghost-border token.
     *  Range-badge passes a status color so the border encodes
     *  positive / negative delta. */
    borderColor?: string;
    children?: React.ReactNode;
}

export function GlassTag({ shadow = 'lg', borderColor, style, children, ...rest }: GlassTagProps) {
    return (
        <BaseBox
            px="3" py="2" radius="control" shadow={shadow}
            style={{
                background: 'var(--glass-bg, var(--bg-card))',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${borderColor ?? 'var(--border-ghost, var(--border-main))'}`,
                pointerEvents: 'none',
                ...style,
            }}
            {...rest}
        >
            {children}
        </BaseBox>
    );
}
