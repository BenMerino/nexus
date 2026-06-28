import React from 'react';
import { Search } from '../icons/index.js';
import { BaseBox, BaseIcon } from '../primitives/index.js';
import { InputFrame } from './InputFrame.js';

/* ── SearchField ──────────────────────────────────────────
 * THE search input. Every searchable surface (MultiSelectPanel,
 * SingleSelectPanel, SearchSelector…) was hand-rolling the same assembly:
 * an InputFrame + a leading <Search> glyph + a bare <input type="search">.
 * Identical three lines, copied per panel — so "search" had no component
 * identity: invisible to the composition graph, uncatalogued, undriftable.
 *
 * This names it. It's an InputFrame worn as search — owns the icon and the
 * bare-input reset; stays a CONTROLLED shell (value + onChange) so the host
 * keeps the query state + filter logic (whose meaning is the host's, not the
 * field's). `trailing` carries host affordances (All/None bulk actions). Now
 * a panel that searches COMPOSES SearchField → the graph sees the edge → the
 * catalog shows "search" as a real building block. */

export interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Trailing affordances (e.g. All/None bulk actions). */
    trailing?: React.ReactNode;
    className?: string;
}

export function SearchField({ value, onChange, placeholder = 'Search…', trailing, className }: SearchFieldProps) {
    /* Inset + width + concentric corner come from the shared `.nest-row`
     * mechanism (theme.css) — same as the ListItem rows beside it. The corner
     * reaches InputFrame via --input-frame-radius, which mirrors .nest-row's
     * formula off the same vars. No geometry restated here or at call sites. */
    return (
        <InputFrame leading={<BaseIcon icon={Search} size="xs" color="var(--text-muted)" />} trailing={trailing}
            className={`nest-row search-field ${className ?? ''}`}>
            <BaseBox as="input" type="search" value={value} onChange={(e: any) => onChange(e.target.value)}
                placeholder={placeholder} className="input-frame__input" />
        </InputFrame>
    );
}
