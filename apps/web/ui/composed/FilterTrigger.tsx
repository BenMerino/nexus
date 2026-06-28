import React from 'react';
import { PopoverTrigger } from './PopoverTrigger.js';

/* ── FilterTrigger ────────────────────────────────────────
 * The header-cluster member of the PopoverTrigger family: a chip (icon · label)
 * that opens a popover. A THIN alias over <PopoverTrigger> (chip skin). Used for
 * filters, saved views, column visibility, calendar provider/status filters, etc.
 *
 * When the filter is CARRYING a selection (`badge > 0`), the WHOLE chip takes the
 * active appearance — BaseTile's active halo, the purpose-built "carrying an
 * applied filter" state (base-tile.css) — instead of appending a count badge. So
 * an idle chip has NO badge and NO reserved trailing slot (it hugs its label);
 * applying a filter changes the chip's own appearance, not its width. (Previously
 * a fixed-size count badge rode a permanently-reserved slot — filter-trigger.css,
 * now removed.) */

export interface FilterTriggerProps {
    /** Icon rendered before the label (lucide-react component, BaseText, or any node). */
    icon?: React.ReactNode;
    /** Trigger label. Empty string is allowed (icon-only trigger). */
    label?: string;
    /** How many filters are applied. >0 → the chip shows its active appearance.
     *  No count is rendered; the chip's own state carries "filter applied". */
    badge?: number;
    /** Panel alignment under the trigger. Default 'left'. */
    align?: 'left' | 'right';
    /** Popover panel renderer. Receives `close()` so the panel can
     *  dismiss itself on action. Unmounted while closed. */
    children: (close: () => void) => React.ReactNode;
    /** Optional className on the trigger (rarely needed). */
    className?: string;
    /** Panel glass surface + className, co-located onto the animated element. */
    panelStyle?: React.CSSProperties;
    panelClassName?: string;
}

export function FilterTrigger({ icon, label, badge, align = 'left', children, className, panelStyle, panelClassName }: FilterTriggerProps) {
    return (
        <PopoverTrigger
            icon={icon}
            label={label || undefined}
            align={align}
            className={className}
            panel={children}
            active={!!badge && badge > 0}
            panelStyle={panelStyle}
            panelClassName={panelClassName}
        />
    );
}
