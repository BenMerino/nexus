import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BaseBox, BaseText, BaseTile } from '../primitives/index.js';
import './filter-trigger.css';

/* ── FilterTrigger ────────────────────────────────────────
 * Header-cluster pattern: a trigger button that toggles a
 * popover panel below it. Used everywhere the page header
 * needs "click chip → see popover" — filters, saved views,
 * column visibility, calendar provider/status filters, etc.
 *
 * Owns:
 *   - open state (internal, not exposed to caller)
 *   - click-outside-to-close behavior
 *   - panel positioning (top: 100%, alignment configurable)
 *   - trigger styling shared with DataTable's existing
 *     dt-trigger / dt-trigger--active classes
 *
 * The caller supplies:
 *   - the trigger label (and optional icon, badge count)
 *   - the popover panel, as a function of close()
 *
 * The panel is unmounted while closed — caller's popover
 * doesn't have to handle visibility internally. */

export interface FilterTriggerProps {
    /** Icon rendered before the label (lucide-react component, BaseText, or any node). */
    icon?: React.ReactNode;
    /** Trigger label. Empty string is allowed (icon-only trigger). */
    label?: string;
    /** When truthy, appended as `(N)` after the label. Skipped if 0. */
    badge?: number;
    /** Panel alignment under the trigger. Default 'left'. */
    align?: 'left' | 'right';
    /** Popover panel renderer. Receives `close()` so the panel can
     *  dismiss itself on action. Unmounted while closed. */
    children: (close: () => void) => React.ReactNode;
    /** Optional className on the trigger (rarely needed). */
    className?: string;
}

export function FilterTrigger({ icon, label, badge, align = 'left', children, className }: FilterTriggerProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);

    /* Position the panel via the trigger's viewport rect and portal it to
     * <body>. The panel must escape ancestor overflow contexts — page-header
     * zones use `overflow-x: auto`, which per CSS spec promotes
     * `overflow-y: visible` to `auto`, clipping any in-flow absolute child.
     *
     * `align` is the PREFERRED side; we flip to the other when the preferred
     * one would push the panel off-screen (e.g. the rightmost trigger like
     * Service, left-aligned, overflowing the right edge). The panel width is
     * read from panelRef once it's mounted. */
    useLayoutEffect(() => {
        if (!open || !ref.current) return;
        const GUTTER = 8;
        const update = () => {
            const r = ref.current!.getBoundingClientRect();
            const w = panelRef.current?.offsetWidth ?? 0;
            const base: React.CSSProperties = {
                position: 'fixed',
                top: r.bottom + 4,
                // Above the base-modal overlay (z-index 300): triggers can be
                // hosted inside modals (e.g. the service picker), and the
                // portaled panel must layer over its host surface.
                zIndex: 400,
            };
            // Resolve the actual side: keep the preferred unless it overflows.
            const leftOverflows = r.left + w > window.innerWidth - GUTTER;
            const rightOverflows = r.right - w < GUTTER;
            const side =
                align === 'right'
                    ? (rightOverflows && !leftOverflows ? 'left' : 'right')
                    : (leftOverflows && !rightOverflows ? 'right' : 'left');
            if (side === 'right') base.right = window.innerWidth - r.right;
            else base.left = r.left;
            setPanelStyle(base);
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open, align]);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (ref.current?.contains(t)) return;
            if (panelRef.current?.contains(t)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const close = () => setOpen(false);
    const hasBadge = !!badge && badge > 0;

    return (
        <BaseBox ref={ref} style={{ position: 'relative' }}>
            <BaseTile
                shape="auto"
                active={open}
                onClick={() => setOpen(o => !o)}
                className={`dt-trigger ${open ? 'dt-trigger--active' : ''} ${className ?? ''}`}
            >
                {icon}
                {/* Label is constant — the count rides in a separate fixed-size
                 * badge (see filter-trigger.css). The badge slot is ALWAYS in
                 * the layout (hidden via opacity when empty), so selecting never
                 * re-measures the tile and shifts the rest of the header cluster. */}
                {label && <BaseText variant="detail">{label}</BaseText>}
                <BaseText as="span" className={`ft-badge ${hasBadge ? '' : 'ft-badge--empty'}`} aria-hidden={!hasBadge}>
                    {badge ?? 0}
                </BaseText>
            </BaseTile>
            {open && createPortal(
                /* Mount as soon as `open` so panelRef populates and the layout
                 * effect can measure width to decide left/right. Hidden until
                 * positioned (panelStyle set) to avoid a flash at the wrong x. */
                <div
                    ref={panelRef}
                    style={panelStyle ?? { position: 'fixed', top: 0, left: 0, visibility: 'hidden', zIndex: 200 }}
                >
                    {children(close)}
                </div>,
                document.body,
            )}
        </BaseBox>
    );
}
