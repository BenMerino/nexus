import React from 'react';
import { BaseBox, type BaseBoxProps } from './BaseBox.js';
import './base-tile.css';

/* ── BaseTile ──────────────────────────────────────────────
 * The chrome-tile primitive. One source of truth for the visual
 * contract that header chrome (avatar, search trigger, filter
 * triggers, action buttons, sync indicator, location picker, rail
 * nav icons) all share:
 *
 *   - Outer height: --space-8 (locks the row's vertical rhythm)
 *   - Corner family: --radius-sm (chrome corner)
 *   - Default surface: --bg-card with --border-main, hover lift
 *     to --bg-elevated
 *   - Square (icon-only) or content-sized width
 *
 * Variants:
 *   default — neutral chrome (avatar, search, filter triggers)
 *   primary — gradient brand surface (the universal "+" tile,
 *             primary destructive confirmations, etc.)
 *
 * Width policy:
 *   shape="square" — width = --space-8 (icon-only tiles)
 *   shape="auto"   — width = content-sized (text+icon tiles,
 *                    search bar with placeholder + ⌘K hint)
 *
 * Replaces the legacy `.header-chrome-tile` className-as-contract
 * pattern. Three different components (BaseAction header buttons,
 * AvatarMenu trigger, FusedSearchHeader trigger) used to compose
 * the contract by opting into a className — they all compose this
 * primitive directly now. */

export interface BaseTileProps extends Omit<BaseBoxProps, 'as'> {
    as?: React.ElementType;
    /** Visual variant.
     *  - `default`: neutral chrome surface with border (avatar, search,
     *    filter triggers, header tiles in general).
     *  - `primary`: gradient brand surface (the universal "+" creation
     *    tile, primary destructive confirmations).
     *  - `bare`: no border, no surface at rest. Surface and border
     *    appear ONLY on hover or when `active=true`. For nav-rail
     *    icons that should fade into the rail until the user looks
     *    at them. Same height / radius / focus contract as other
     *    variants — only the resting surface differs. */
    variant?: 'default' | 'primary' | 'bare';
    /** Width policy. Square locks to --space-8 for icon-only tiles
     *  (matches the row's vertical rhythm exactly). Auto sizes to
     *  content (for tiles with placeholder text, kbd hints, etc.). */
    shape?: 'square' | 'auto';
    /** Active visual state — used for filter triggers that hold an
     *  open popover or that have an applied filter. Renders a halo
     *  shadow without changing the tile's surface. */
    active?: boolean;
}

export const BaseTile = React.forwardRef<HTMLElement, BaseTileProps>(function BaseTile({
    as = 'button',
    variant = 'default',
    shape = 'auto',
    active = false,
    className,
    children,
    ...rest
}, ref) {
    const cls = [
        'base-tile',
        `base-tile--${variant}`,
        `base-tile--${shape}`,
        active ? 'base-tile--active' : null,
        className,
    ].filter(Boolean).join(' ');
    /* Parent-owned nesting: the tile publishes its concentric --_nest-* vars in
     * base-tile.css (anchored to --_ctl-radius + per-shape --_nest-pad), so a
     * nested child (e.g. the ⌘K hint) reads var(--_nest-corner). No context
     * provider needed — the cascade flows through the DOM. */
    return (
        <BaseBox ref={ref} as={as} className={cls} {...rest}>
            {children}
        </BaseBox>
    );
});
