import React from 'react';
import { BaseBox, type BaseBoxProps } from './BaseBox.js';
import { Nestable } from './BaseNested.js';
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
    /* Publish the tile's radius family (`sm` — the chrome corner)
     * AND its inner padding to nested descendants via <Nestable>.
     * Any <BaseNested> child (e.g. the search trigger's ⌘K hint)
     * reads this and:
     *   - picks the matching --radius-sm-inner-<inset> inner-radius
     *   - negates the parent's padding so its INSET is the total
     *     visible gap from the tile's border, not gap-on-top-of-
     *     gap (which would put nested badges floating mid-tile)
     *
     * Padding contract matches base-tile.css:
     *   shape=square → padding: var(--space-1-5)  (both axes)
     *   shape=auto   → padding: 0 var(--space-3)  (X only; Y is 0)
     */
    const padX = shape === 'square' ? 'var(--space-1-5)' : 'var(--space-3)';
    const padY = shape === 'square' ? 'var(--space-1-5)' : '0px';
    return (
        <Nestable parentRadius="sm" parentPaddingX={padX} parentPaddingY={padY}>
            <BaseBox ref={ref} as={as} className={cls} {...rest}>
                {children}
            </BaseBox>
        </Nestable>
    );
});
