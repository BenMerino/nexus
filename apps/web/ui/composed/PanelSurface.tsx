import React from 'react';
import { BaseBox, type ControlSize } from '../primitives/index.js';

/* ── PanelSurface ─────────────────────────────────────────────
 * The ONE BODY recipe for a list popover (MultiSelect / SingleSelect / the body
 * inside FilterMenu's sections). It groups the structure every list panel shares:
 *   • an opt-in `controlSize` cluster (to align the SearchField + ListItem rows),
 *   • a `.nest-scroll` scroll region (with maxHeight) around the list.
 *
 * It owns NO glass. The surface (overlaySurface + the glassReveal animation +
 * the border) is owned by the ONE popover engine — `Popover` — that this body is
 * always placed inside. Putting glass here too would DOUBLE the border/shadow/blur
 * (Popover's + this one). Being glass-less makes that impossible by construction.
 *
 * It does NOT own a control-size tier either. `controlSize` is a CLUSTER concern
 * (the box grouping the controls), orthogonal to the body — so list panels pass
 * `controlSize="sm"` explicitly. A grid/text body omits it (inherits :root md).
 *
 * Crucially it adds **NO padding**. The row inset is owned by the ONE list
 * primitive — `ListItem` (its `.nest-row` margin) — so the same row sits at the
 * same gutter in every panel. A panel that wraps content in a padded surface
 * would stack panel-padding on top of the row margin, making identical rows
 * render at different gutters per panel (the bug that motivated this). The
 * surface is grouped here; the inset stays on the list. Neither leaks into the
 * other.
 *
 * `header` (search / bulk actions) and `footer` (count summary) sit OUTSIDE the
 * scroll region — they're caller chrome that varies per panel; `children` is the
 * scrollable list of <ListItem>s. Omit `scroll` for menus that size their own
 * items (Dropdown) — then `children` render directly with no scroll wrapper. */

export interface PanelSurfaceProps {
    /** Search row / bulk actions — fixed above the scrolling list. */
    header?: React.ReactNode;
    /** Count summary / chrome — fixed below the scrolling list. */
    footer?: React.ReactNode;
    /** The list rows (<ListItem>s). Scrolls when `scroll` is set. */
    children: React.ReactNode;
    /** Wrap `children` in a `.nest-scroll` region capped at this maxHeight.
     *  Omit for menus that size their own items (Dropdown). */
    maxHeight?: string;
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    className?: string;
    /** Publish a --_ctl-* tier for nested controls. Omit for grids/text bodies
     *  (they inherit the :root md default). List/action panels pass "sm" to align
     *  their SearchField + ListItem rows. The cluster owns sizing, not the surface. */
    controlSize?: ControlSize;
}

export function PanelSurface({
    header, footer, children, maxHeight, width, minWidth, maxWidth, className, controlSize,
}: PanelSurfaceProps) {
    return (
        <BaseBox controlSize={controlSize} className={className}
            style={{ ...(width && { width }), ...(minWidth && { minWidth }), ...(maxWidth && { maxWidth }) }}>
            {header}
            {maxHeight
                ? <BaseBox className="nest-scroll" style={{ maxHeight, overflowY: 'auto' }}>{children}</BaseBox>
                : children}
            {footer}
        </BaseBox>
    );
}
