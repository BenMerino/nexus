import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BaseBox } from '../primitives/index.js';
import { overlaySurface, glassRevealProps } from './overlay-surface.js';
import { useOutsideClose } from './useOutsideClose.js';
import { registerPanel } from './popover-registry.js';

/* ── Popover ──────────────────────────────────────────────
 * The "click a trigger → an anchored panel opens" foundation. Owns the
 * machinery every dropdown/picker/menu was reimplementing by hand:
 *   - open state (internal)
 *   - click-outside-to-close
 *   - portal to <body> (escapes ancestor overflow clipping)
 *   - viewport-aware positioning with edge-flip
 *
 * The TRIGGER is a slot — a render prop receiving { open, toggle, ref }.
 * Pass a BaseTile chip, an InputFrame, a Button, anything. The PANEL is a
 * render prop receiving close(). This decoupling is the whole point: the
 * pickers (TimePicker/DatePicker) use an input trigger, the filters use a
 * chip — same machinery, different trigger.
 *
 * Variant axis: `align` ('left' | 'right') is the PREFERRED side; it flips
 * when the preferred side would overflow the viewport. */

export interface PopoverTriggerArgs {
    open: boolean;
    toggle: () => void;
    /** Attach to the trigger element so positioning can read its rect. */
    ref: React.RefObject<HTMLDivElement | null>;
}

export interface PopoverProps {
    /** Trigger slot. Receives open state + toggle + the ref to anchor to. OMIT for
     *  a trigger-less summon (a right-click ActionMenu / a caller-driven dropdown)
     *  — then pass `anchor` for placement and drive `open` yourself. */
    trigger?: (args: PopoverTriggerArgs) => React.ReactNode;
    /** Panel slot. Receives close() so it can dismiss on action. Unmounted while closed. */
    children: (close: () => void) => React.ReactNode;
    /** Preferred panel side under the trigger; flips on overflow. Default 'left'. */
    align?: 'left' | 'right';
    /** Start open on mount. For inline editors and the DNA catalog (which shows
     *  the OPENED composed). Default false — the normal click-to-open flow. */
    defaultOpen?: boolean;
    /** Fixed viewport point to anchor the panel to (a right-click summon). When
     *  given, placement skips the trigger-rect read + edge-flip and pins the panel
     *  at {x,y}. The ONE positioning path besides trigger-anchored. */
    anchor?: { x: number; y: number };
    /** Controlled open state — when provided, the caller owns open/close (e.g. a
     *  conditionally-mounted menu that drives its own lifecycle). Pair with
     *  `onOpenChange` so Popover's internal dismiss requests reach the caller. */
    open?: boolean;
    /** Fires when Popover wants to change open state (outside-click, Escape, a
     *  child calling close()). The controlled-mode counterpart of `open`. */
    onOpenChange?: (open: boolean) => void;
    /** Fires after the close/exit animation finishes (AnimatePresence onExitComplete).
     *  For conditionally-mounted callers (a right-click menu) that must let the exit
     *  tween play before they unmount themselves. */
    onExitComplete?: () => void;
    /** Anchor placement to an EXTERNAL trigger element instead of Popover's own
     *  trigger slot — for compounds whose trigger is a sibling, not a child
     *  (Dropdown.Trigger + Dropdown.Panel). When given, omit `trigger`. */
    triggerRef?: React.RefObject<HTMLElement | null>;
    /** Non-surface panel overrides (width, overflow, padding, --_nest-* vars),
     *  merged onto the animated element AFTER Popover's own `overlaySurface`
     *  default. Popover owns the glass; do NOT re-spread `overlaySurface` here.
     *  A surface prop passed here still wins (escape hatch), but that should be
     *  rare. Render `children` surface-less. */
    panelStyle?: React.CSSProperties;
    /** className for the animated panel element (e.g. `nest-controls` for the
     *  picker grid's nesting cascade). Co-located with panelStyle. */
    panelClassName?: string;
}

export function Popover({ trigger, children, align = 'left', defaultOpen = false, anchor, open: openProp, onOpenChange, onExitComplete, triggerRef, panelStyle, panelClassName }: PopoverProps) {
    /* Open state is controlled when `open` is passed, else internal. setOpen routes
     * to onOpenChange in controlled mode so the caller owns the lifecycle (e.g. a
     * conditionally-mounted ActionMenu), and to local state otherwise. */
    const [openLocal, setOpenLocal] = useState(defaultOpen);
    const open = openProp ?? openLocal;
    const setOpen = (next: boolean) => {
        if (openProp === undefined) setOpenLocal(next);
        onOpenChange?.(next);
    };
    const ref = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [placed, setPlaced] = useState<React.CSSProperties | null>(null);

    /* Portal-position the panel from the trigger's viewport rect. The panel
     * must escape ancestor overflow contexts (header zones use overflow-x:auto,
     * which per spec promotes overflow-y to auto, clipping in-flow children).
     * `align` is preferred; flip to the other side when it would overflow. */
    useLayoutEffect(() => {
        if (!open) return;
        const GUTTER = 8;
        /* Point-anchored (right-click summon): pin at {x,y}, no rect read / flip.
         * Static, so no resize/scroll listeners — set once and done. */
        if (anchor) {
            setPlaced({ position: 'fixed', top: anchor.y, left: anchor.x, zIndex: 400 });
            return;
        }
        // Trigger-anchored: derive placement from the trigger's rect (+ edge-flip).
        // Read from an external trigger ref when given (compound Dropdown), else
        // Popover's own trigger-slot ref.
        const anchorEl = triggerRef?.current ?? ref.current;
        if (!anchorEl) return;
        const update = () => {
            const r = anchorEl.getBoundingClientRect();
            const w = panelRef.current?.offsetWidth ?? 0;
            const base: React.CSSProperties = { position: 'fixed', top: r.bottom + 4, zIndex: 400 };
            const leftOverflows = r.left + w > window.innerWidth - GUTTER;
            const rightOverflows = r.right - w < GUTTER;
            const side =
                align === 'right'
                    ? (rightOverflows && !leftOverflows ? 'left' : 'right')
                    : (leftOverflows && !rightOverflows ? 'right' : 'left');
            if (side === 'right') base.right = window.innerWidth - r.right;
            else base.left = r.left;
            setPlaced(base);
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [open, align, anchor, triggerRef]);

    // The panel portals outside the anchor, so it's an extra "inside" region. The
    // trigger ref (own or external) guards the click-inside test; trigger-less
    // menus rely on the panelRef alone.
    useOutsideClose(triggerRef ?? ref, open, () => setOpen(false), [panelRef]);

    /* Register this panel in the shared open-panel set while open, so a click
     * inside it never reads as "outside" for an ANCESTOR popover (nested
     * popovers — e.g. the chart Custom date calendar opened inside the range
     * popover — don't collapse their parent). Registered after paint so
     * panelRef is attached; unregistered on close/unmount. */
    useLayoutEffect(() => {
        if (!open || !panelRef.current) return;
        return registerPanel(panelRef.current);
    }, [open, placed]);

    const close = () => setOpen(false);
    const toggle = () => setOpen(!open);

    /* Inline mode: no trigger slot, no anchor, AND no external trigger ref → the
     * caller mounts Popover in place (the DNA catalog showing an opened menu). The
     * panel renders in-flow (no portal/fixed). A triggerRef-driven compound is NOT
     * inline — it portals + anchors to that ref. */
    const inline = !trigger && !anchor && !triggerRef;

    /* The animated glass panel — the ONE place Popover owns the surface. `overlaySurface`
     * applies by default so backdrop-filter + clip-reveal co-locate by construction (a
     * child surface under the clipping parent reads transparent); callers pass only
     * non-surface extras via `panelStyle`. Inline drops the fixed/portal placement. */
    const panel = (
        <AnimatePresence onExitComplete={onExitComplete}>
            {open && (
                <motion.div
                    ref={panelRef}
                    className={panelClassName}
                    {...glassRevealProps}
                    style={{
                        ...glassRevealProps.style,
                        ...overlaySurface,
                        ...panelStyle,
                        ...(inline
                            ? { position: 'relative' }
                            : (placed ?? { position: 'fixed', top: 0, left: 0, visibility: 'hidden', zIndex: 200 })),
                    }}
                >
                    {children(close)}
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (inline) return panel;

    return (
        <BaseBox ref={ref} style={{ position: 'relative' }}>
            {trigger?.({ open, toggle, ref })}
            {createPortal(panel, document.body)}
        </BaseBox>
    );
}
