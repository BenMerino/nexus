import React from 'react';
import { BaseBox, BaseText, BaseCheckbox } from '../primitives/index.js';
import { NEST_LABEL } from './nest-row.js';
import './list-item.css';

/* ── ListItem ──────────────────────────────────────────────
 * The foundational primitive for rendering a row in a list.
 * Scoped explicitly to LIST use cases — sidebar items, dropdown
 * menu items, avatar menu items. NOT for standalone buttons,
 * nav-bar tiles, primary CTAs, or anything outside the list
 * family — those keep their own primitives.
 *
 * Pure rendering. Consumers wrap it to give it behavior
 * (NavLink for routes, button onClick for actions):
 *
 *   <ListItem as="button" onClick={fn} leftIcon={Icon}>Profile</ListItem>
 *   <NavLink to={to}>
 *     {({ isActive }) => <ListItem active={isActive}>Label</ListItem>}
 *   </NavLink>
 *
 * Visual reference: the avatar dropdown's items (Profile / Interface /
 * Notifications / Security / Log Out). Same look across every list. */

export type ListItemVariant = 'default' | 'danger' | 'appointment';

export interface ListItemProps {
    /** Host element. Defaults to <div>. Pass 'button' to make it
     *  clickable, or pass NavLink/anchor for routes. */
    as?: React.ElementType;
    variant?: ListItemVariant;
    /** Active/selected state — drives background tint + text color. */
    active?: boolean;
    /** Disabled — half-opacity, no hover. */
    disabled?: boolean;
    /** Render a leading checkbox (multi-select rows). Its checked state is
     *  driven by `active` — the same prop that tints the row. Replaces the
     *  hand-rolled inline checkbox every select panel used to pass as leftIcon. */
    selectable?: boolean;
    /** Optional left-side icon. Ignored when `selectable` (the checkbox takes
     *  the leading slot). */
    leftIcon?: React.ReactNode;
    /** Optional right-side accessory — checkmark, badge, chevron. */
    rightAccessory?: React.ReactNode;
    /** Item label. */
    children?: React.ReactNode;
    /** Optional muted secondary line(s) under the label — for richer rows
     *  (search results, entity pickers). String or array; stacks the label
     *  into a column. Single-line rows omit it and render unchanged. */
    sublabel?: React.ReactNode | React.ReactNode[];
    className?: string;
    /** Passthrough — onClick, href, to, etc. land on the host element. */
    [key: string]: any;
}

export const ListItem = React.forwardRef<HTMLElement, ListItemProps>(({
    as,
    variant = 'default',
    active = false,
    disabled = false,
    selectable = false,
    leftIcon,
    rightAccessory,
    children,
    sublabel,
    className,
    ...rest
}, ref) => {
    const subs = sublabel == null ? [] : Array.isArray(sublabel) ? sublabel : [sublabel];
    const cls = [
        'nest-row',                     // the shared inset-row mechanism (width/margin/corner)
        'list-item',
        `list-item--${variant}`,
        active && 'list-item--active',
        disabled && 'list-item--disabled',
        className,
    ].filter(Boolean).join(' ');

    /* If host is a button, ensure default type and disabled prop pass through. */
    const interactiveProps =
        as === 'button' ? { type: rest.type ?? 'button', disabled: disabled || undefined } : {};

    return (
        <BaseBox ref={ref as any} as={as} className={cls} aria-disabled={disabled || undefined} {...interactiveProps} {...rest}>
            {selectable ? (
                <BaseBox className="list-item__icon">
                    {/* Sized to --_ctl-icon — the SAME glyph-size authority BaseIcon
                      * uses — so the checkbox box matches the search lupe's box and
                      * both center identically in the shared --nest-lead slot. Not
                      * --nest-lead (the slot width), which pinned the box to the
                      * whole column and drifted from the lupe by the border. */}
                    <BaseCheckbox checked={active} presentational size="var(--_ctl-icon)" />
                </BaseBox>
            ) : (
                leftIcon && <BaseBox className="list-item__icon">{leftIcon}</BaseBox>
            )}
            {subs.length > 0 ? (
                <BaseBox display="flex" direction="col" style={{ minWidth: 0 }}>
                    {children != null && <BaseText as="span" className="list-item__label" style={NEST_LABEL}>{children}</BaseText>}
                    {subs.map((s, i) => <BaseText key={i} variant="detail" color="muted">{s}</BaseText>)}
                </BaseBox>
            ) : (
                children != null && <BaseText as="span" className="list-item__label" style={NEST_LABEL}>{children}</BaseText>
            )}
            {rightAccessory && <BaseBox className="list-item__accessory">{rightAccessory}</BaseBox>}
        </BaseBox>
    );
});
