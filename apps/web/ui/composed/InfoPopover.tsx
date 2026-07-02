import React from 'react';
import { BaseBox } from '../primitives/index.js';
import { PopoverTrigger } from './PopoverTrigger.js';
import { Info } from '../icons/index.js';

/* ── InfoPopover ──────────────────────────────────────────
 * The finished "ⓘ → information panel" element — the informational sibling of
 * the list-popovers (Select, Dropdown, DatePicker). Same pipeline, different
 * JOB: where those present a value/choice/date, this PRESENTS INFORMATION.
 *
 *   glyph trigger (PopoverTrigger skin='glyph')   — the small ⓘ button
 *     + Popover (behavior: anchor / reveal / dismiss + the glass surface it owns)
 *     + body content (text/rows, with its own inset)            = InfoPopover
 *
 * Popover alone is behavior + surface, not a finished element (no content, no
 * inset) — InfoPopover is the composition that makes it whole. Popover owns the
 * glass on its animated node; `panelStyle` carries only non-surface extras
 * (maxWidth); the body is rendered surface-less and owns its own padding. */

export interface InfoPopoverProps {
    /** Panel content — the information to present (text, term/blurb rows, …). */
    children: React.ReactNode;
    /** Trigger glyph. Defaults to the ⓘ icon. Pass any node for a ?/sliders/etc. */
    glyph?: React.ReactNode;
    /** Panel side under the glyph; flips on overflow. Default 'right' (the glyph
     *  usually sits at the right edge of a label). */
    align?: 'left' | 'right';
    /** Max panel width. Default '32ch' — comfortable for a paragraph or a few rows. */
    maxWidth?: string;
    /** Accessible label for the trigger. Default 'More information'. */
    ariaLabel?: string;
    className?: string;
}

export function InfoPopover({
    children, glyph, align = 'right', maxWidth = '32ch', ariaLabel = 'More information', className,
}: InfoPopoverProps) {
    return (
        <PopoverTrigger
            skin="glyph"
            align={align}
            icon={glyph ?? <Info width={15} height={15} aria-label={ariaLabel} />}
            className={className}
            panelStyle={{ maxWidth }}
            panelClassName="nest-controls"
            panel={() => (
                // Surface-less: the panel owns the glass (panelStyle); the body
                // owns its inset. A child surface under the clipping panel would
                // read transparent.
                <BaseBox className="space-y-3" pad="normal">
                    {children}
                </BaseBox>
            )}
        />
    );
}
