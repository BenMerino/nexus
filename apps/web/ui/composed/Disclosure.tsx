import { useState } from 'react';
import { ChevronDown } from '../icons/index.js';
import { BaseBox, BaseText, BaseAction } from '../primitives/index.js';
import { NEST_LABEL } from './nest-row.js';
import './disclosure.css';

/* ── Disclosure ───────────────────────────────────────────
 * The ARIA disclosure pattern: a labeled header that toggles a
 * body open/closed. Collapsed by default; the header shows a
 * label plus an optional muted `summary` (e.g. "4 of 5") so a
 * stack of disclosures stays compact until expanded.
 *
 * Generic — the caller supplies the label, summary, and body.
 * First used to stack filters inside FilterMenu (Calendar), but
 * carries no filter-specific logic. */

export interface DisclosureProps {
    label: string;
    /** Optional muted summary shown beside the label (e.g. "4 of 5"). */
    summary?: React.ReactNode;
    /** Revealed body. */
    children: React.ReactNode;
    /** Start expanded. Default false. */
    defaultOpen?: boolean;
}

export function Disclosure({ label, summary, children, defaultOpen = false }: DisclosureProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <BaseBox className="disclosure">
            <BaseAction
                variant="ghost"
                size="sm"
                onClick={() => setOpen(o => !o)}
                className="nest-row disclosure__head"
            >
                <BaseText as="span" className="disclosure__label" style={NEST_LABEL}>{label}</BaseText>
                {summary != null && <BaseText variant="detail" color="muted">{summary}</BaseText>}
                <ChevronDown
                    className="disclosure__chev"
                    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
                />
            </BaseAction>
            {open && <BaseBox className="disclosure__body">{children}</BaseBox>}
        </BaseBox>
    );
}
