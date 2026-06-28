import React from 'react';
import { BaseAction, BaseBox, BaseText, BaseTile, type ButtonVariant, type ButtonSize } from '../primitives/index.js';
import { Popover } from './Popover.js';
import { InputFrame } from './InputFrame.js';

/* ── PopoverTrigger ───────────────────────────────────────
 * The ONE "a trigger that opens a popover" family. Every dropdown / picker /
 * filter was hand-assembling the same sentence over <Popover>: an icon + a
 * label/content + a trailing affordance that opens an anchored panel. They
 * differed only in the SKIN and the slots filled — not the archetype.
 *
 * Popover is a BEHAVIOR worn by a role-primitive — NOT a control type. Three
 * skins, ONE family (each is a different ROLE, all sharing the same control DNA
 * — --_ctl-h / --text-control / --radius-control):
 *   • chip  (default) — a BaseTile. Header chrome: content-sized, hugs its
 *     label. Today's FilterTrigger.
 *   • field           — an InputFrame. Form input: full-width shell. Today's
 *     Select trigger.
 *   • action          — a BaseAction. A real button that opens a panel (a
 *     Save ▾ / + New menu). The (action × opens-popover) cell.
 *   • glyph           — a BaseAction iconOnly. A small square icon button (an
 *     ⓘ / ? / sliders glyph) that opens a panel. The bare trigger for info /
 *     hint popovers — no label, no trailing, just the glyph. InfoPopover wears it.
 *
 * State feedback lives at the PRIMITIVE, not here: BaseTile owns its `active`
 * halo, InputFrame its `:focus-within` ring, BaseAction its press. The trigger
 * stays dumb — it fills slots and wires open/toggle; it never decides how
 * open/focus looks. Layer direction holds: composed depends on primitive, the
 * popover behavior is attached here, never baked into the primitive.
 *
 * Content is a SLOT: pass a label, an icon+label, or an editable <input>. The
 * trigger doesn't know or care which — editability is the molecule's business
 * (TimePicker puts its <input> in `children`), so the family never forks. */

export type PopoverTriggerSkin = 'chip' | 'field' | 'action' | 'glyph';

export interface PopoverTriggerProps {
    /** Role skin. `chip` = BaseTile chrome (default); `field` = InputFrame
     *  full-width shell; `action` = BaseAction button; `glyph` = BaseAction
     *  iconOnly (small square icon button — the `icon` IS the trigger). */
    skin?: PopoverTriggerSkin;
    /** Leading glyph (lucide node, BaseText, anything). */
    icon?: React.ReactNode;
    /** Convenience label when `children` is just text. Ignored if `children` given. */
    label?: React.ReactNode;
    /** Content slot — overrides `label`. A BaseText, an editable <input>, etc. */
    children?: React.ReactNode;
    /** Trailing affordance: a chevron, a count badge, a unit. A function form
     *  receives `{ open }` so an affordance can reflect open state (e.g. a
     *  chevron that rotates) without the trigger knowing what it is. */
    trailing?: React.ReactNode | ((args: { open: boolean }) => React.ReactNode);
    /** action skin only — forwarded to BaseAction. */
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Panel renderer; receives close(). Unmounted while closed. */
    panel: (close: () => void) => React.ReactNode;
    /** Panel alignment under the trigger; flips on overflow. Default 'left'. */
    align?: 'left' | 'right';
    /** Start with the panel open (inline editors, DNA catalog). Default false. */
    defaultOpen?: boolean;
    /** Chip skin: force the active appearance even when closed — e.g. a filter
     *  chip that is CARRYING a selection. ORed with `open`, so the chip shows the
     *  BaseTile active halo while open OR while active. (BaseTile's active state
     *  is purpose-built for "carrying an applied filter" — base-tile.css.) */
    active?: boolean;
    className?: string;
    /** Panel glass surface + className, co-located onto Popover's animated element
     *  so backdrop-filter and the clip-reveal share one node. Render `panel`
     *  surface-less when set. */
    panelStyle?: React.CSSProperties;
    panelClassName?: string;
}

export function PopoverTrigger({
    skin = 'chip', icon, label, children, trailing, variant, size, panel, align = 'left', defaultOpen = false, active = false, className, panelStyle, panelClassName,
}: PopoverTriggerProps) {
    const content = children ?? (label != null
        // Plain layout span (not BaseText) so it inherits the skin's control
        // font/weight instead of stamping its own --text-body inline.
        ? <BaseBox as="span">{label}</BaseBox>
        : null);

    return (
        <Popover
            align={align}
            defaultOpen={defaultOpen}
            panelStyle={panelStyle}
            panelClassName={panelClassName}
            trigger={({ open, toggle }) => {
                const trail = typeof trailing === 'function' ? trailing({ open }) : trailing;
                if (skin === 'field') {
                    return (
                        <InputFrame onClick={toggle} leading={icon} trailing={trail} className={className}>
                            {content}
                        </InputFrame>
                    );
                }
                if (skin === 'glyph') {
                    // Small square icon button — the glyph IS the trigger. No
                    // label/trailing; iconOnly owns the equal-padding round chrome.
                    return (
                        <BaseAction
                            variant={variant ?? 'ghost'} size={size ?? 'sm'} iconOnly
                            onClick={toggle} className={className}
                        >
                            {icon}
                        </BaseAction>
                    );
                }
                if (skin === 'action') {
                    return (
                        <BaseAction
                            variant={variant} size={size} onClick={toggle}
                            leftIcon={icon} rightIcon={trail} className={className}
                        >
                            {content}
                        </BaseAction>
                    );
                }
                return (
                    <BaseTile
                        shape="auto"
                        active={open || active}
                        onClick={toggle}
                        className={`dt-trigger ${(open || active) ? 'dt-trigger--active' : ''} ${className ?? ''}`}
                    >
                        {/* Mute the leading glyph via the SAME affordance slot the
                         * field skin uses (input-frame.css) — so a chip's leading
                         * icon reads --text-muted exactly like a field's, instead
                         * of inheriting BaseTile's --text-main. One leading-icon
                         * colour role across skins; DatePicker (field) and
                         * DateRangePicker (chip) now match by construction. */}
                        {icon && <BaseBox as="span" className="input-frame__affordance">{icon}</BaseBox>}
                        {content}
                        {trail}
                    </BaseTile>
                );
            }}
        >
            {panel}
        </Popover>
    );
}

/* Re-export BaseText so callers that pass a styled value label don't reach past
 * the family for it. */
export { BaseText as PopoverTriggerLabel };
