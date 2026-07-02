import React, { useContext, useState, useCallback } from 'react';
import { BaseBox, BaseText, Divider as BaseDivider } from '../primitives/index.js';
import { ListItem, type ListItemVariant } from './ListItem.js';
import { Popover } from './Popover.js';
import { SegmentedControl, type Segment } from './SegmentedControl.js';
import { ActionMenuContext } from './ActionMenuContext.js';

/* ── ActionMenu ────────────────────────────────────────────
 * THE context / action menu archetype — the surface a right-click (or a "⋯"
 * trigger) summons: a stack of action rows, optional grouped switchers, group
 * dividers. Until now this was hand-rolled per call site (the calendar's
 * `.ctx-menu`); this is its one home, built ON the list-popover pipeline so it
 * insets, sizes and curves exactly like Dropdown / MultiSelect / Select:
 *
 *   • body = a <Popover> panel — Popover owns the glass surface + the glassReveal
 *     animation + outside-close (the ONE popover engine). ActionMenu just supplies
 *     the point anchor (x/y from the right-click) + a controlSize="sm" CLUSTER box
 *     (the surface doesn't own sizing), NO padding. The row inset is owned by
 *     ListItem's `.nest-row` margin, so an ActionMenu row sits at the same gutter
 *     as a Dropdown row by construction.
 *   • action rows = <ActionMenu.Item> → ListItem (`as="button"`). Same hover /
 *     active / danger treatment as every other list row.
 *   • group breaks = <ActionMenu.Divider> → the shared inset Divider.
 *   • <ActionMenu.Group> hosts a labelled SegmentedControl (the calendar's
 *     Attendance / Payment switchers) inside the same controlSize tier.
 *
 * Positioning: pass `x`/`y` for a fixed viewport-anchored menu (right-click);
 * omit them for an inline menu the caller positions (DNA catalog, a column
 * inside a popover). Either way the surface + inset machinery is identical. */

export interface ActionMenuProps {
    children: React.ReactNode;
    /** Fixed viewport coordinates (right-click summon). Omit for an inline menu
     *  the caller places itself. */
    x?: number;
    y?: number;
    /** Dismiss on outside click / Escape. Wired when provided. */
    onClose?: () => void;
    width?: string;
    minWidth?: string;
    className?: string;
}

function ActionMenuRoot({ children, x, y, onClose, width, minWidth = '180px', className }: ActionMenuProps) {
    /* `open` drives Popover's enter/exit. A close request only flips `open` false
     * so the exit tween plays inside Popover (which owns the AnimatePresence); the
     * real `onClose` (which unmounts us) fires on Popover's onExitComplete, AFTER
     * the animation. The caller renders us conditionally, so this two-step is what
     * lets the exit run before we vanish. */
    const [open, setOpen] = useState(true);
    const requestClose = useCallback(() => setOpen(false), []);

    const anchor = (x != null && y != null) ? { x, y } : undefined;

    return (
        <ActionMenuContext.Provider value={{ close: requestClose }}>
            <Popover
                open={open}
                onOpenChange={(next) => { if (!next) requestClose(); }}
                onExitComplete={onClose}
                anchor={anchor}
                panelStyle={{ ...(width && { width }), minWidth }}
                panelClassName={className}
            >
                {() => (
                    /* controlSize CLUSTER (sizing, not surface). Stop propagation so
                     * a click on a row doesn't bubble to an outside-close. */
                    <BaseBox controlSize="sm" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        {children}
                    </BaseBox>
                )}
            </Popover>
        </ActionMenuContext.Provider>
    );
}

interface ItemProps {
    children: React.ReactNode;
    onClick?: () => void;
    /** Keep the menu open after the click (default closes it). */
    closeOnClick?: boolean;
    disabled?: boolean;
    /** `danger` reddens the whole row (label + glyph). */
    variant?: ListItemVariant;
    /** Leading glyph — goes through ListItem's icon slot. Pass a plain icon with
     *  NO color so it inherits the row's text color (danger reddens it). */
    leftIcon?: React.ReactNode;
}

function Item({ children, onClick, closeOnClick = true, disabled, variant, leftIcon }: ItemProps) {
    const ctx = useContext(ActionMenuContext);
    const handle = () => {
        if (disabled) return;
        onClick?.();
        if (closeOnClick) ctx?.close();
    };
    return (
        <ListItem as="button" onClick={handle} disabled={disabled} variant={variant} leftIcon={leftIcon}>
            {children}
        </ListItem>
    );
}

interface GroupProps<T extends string> {
    /** Section heading above the switcher (e.g. "Attendance", "Payment"). */
    label: string;
    segments: Segment<T>[];
    value: T;
    onChange: (value: T) => void;
}

/* A labelled SegmentedControl row — the calendar's Attendance / Payment
 * switchers. Wears `.nest-row` so its inset matches the action rows below it;
 * the switcher reads the panel's controlSize tier by construction. */
function Group<T extends string>({ label, segments, value, onChange }: GroupProps<T>) {
    return (
        <BaseBox className="nest-row" display="flex" direction="col" gap="1">
            <BaseText variant="label" color="muted">{label}</BaseText>
            <SegmentedControl variant="pill" stretch segments={segments} value={value} onChange={onChange} />
        </BaseBox>
    );
}

const Divider = ({ className }: { className?: string }) => <BaseDivider inset className={className} />;

export const ActionMenu = Object.assign(ActionMenuRoot, { Item, Group, Divider });
