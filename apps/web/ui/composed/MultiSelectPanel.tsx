import React, { useMemo, useState } from 'react';
import { BaseAction, BaseBox, BaseText } from '../primitives/index.js';
import { SearchField } from './SearchField.js';
import { ListItem } from './ListItem.js';
import { PanelSurface } from './PanelSurface.js';

/* ── MultiSelectPanel ────────────────────────────────────
 * Generic checkbox-list popover for filter chips. Pair with
 * <FilterTrigger> in a header cluster:
 *
 *   <FilterTrigger icon={…} label="Provider" badge={selected.length}>
 *     {() => <MultiSelectPanel options={…} selected={…} onChange={…} />}
 *   </FilterTrigger>
 *
 * Owns:
 *   - search-within-options
 *   - "Clear" + "All" shortcuts
 *   - render order: caller's option order, stable across toggles
 *     (selection state never reorders the list)
 *
 * Stays unopinionated about *what* is being selected — the caller
 * supplies labels and values. */

export interface MultiSelectOption {
    value: string;
    label: string;
}

export interface MultiSelectPanelProps {
    options: ReadonlyArray<MultiSelectOption>;
    selected: ReadonlyArray<string>;
    onChange: (next: string[]) => void;
    /** Placeholder shown when nothing is selected. */
    emptyLabel?: string;
    /** Search input hint. */
    searchPlaceholder?: string;
    /** Max visible options before scroll. Default 8. */
    maxVisible?: number;
    /** Drop the standalone card chrome (border/shadow/radius/width) so the
     *  panel sits flush inside a host surface — e.g. a Disclosure body. */
    bare?: boolean;
}

export function MultiSelectPanel({
    options, selected, onChange,
    emptyLabel = 'No options',
    searchPlaceholder = 'Search…',
    maxVisible = 8,
    bare = false,
}: MultiSelectPanelProps) {
    const [q, setQ] = useState('');
    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const allValues = useMemo(() => options.map(o => o.value), [options]);

    /* Render in the caller's option order, filtered by the search query
     * only. Deliberately NOT sorted by selection state — toggling an
     * option must never move it, so the row stays under the cursor for
     * rapid multi-select. */
    const visible = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return ql
            ? options.filter(o => o.label.toLowerCase().includes(ql))
            : options;
    }, [options, q]);

    const toggle = (value: string) => {
        if (selectedSet.has(value)) onChange(selected.filter(v => v !== value));
        else onChange([...selected, value]);
    };

    /* SearchField + bulk actions — fixed above the scrolling list. "All" selects
     * every option, "None" deselects all. */
    const header = (
        <SearchField value={q} onChange={setQ} placeholder={searchPlaceholder}
            trailing={
                <BaseBox display="flex" align="center" density="tight">
                    <BaseAction variant="ghost" size="sm" onClick={() => onChange(allValues)} disabled={selected.length === options.length}>All</BaseAction>
                    <BaseAction variant="ghost" size="sm" onClick={() => onChange([])} disabled={selected.length === 0}>None</BaseAction>
                </BaseBox>
            }
        />
    );
    /* Count footer — orients the user in a long list: how many selected / match. */
    const footer = options.length > maxVisible ? (
        <BaseBox pad="tight" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <BaseText variant="detail" color="muted">
                {q.trim() ? `${visible.length} of ${options.length} match` : `${selected.length} of ${options.length} selected`}
            </BaseText>
        </BaseBox>
    ) : undefined;
    const rows = visible.length === 0
        ? <BaseBox pad="normal"><BaseText variant="detail" color="muted">{emptyLabel}</BaseText></BaseBox>
        : visible.map(opt => (
            <ListItem key={opt.value} as="button" selectable active={selectedSet.has(opt.value)}
                onClick={() => toggle(opt.value)}>{opt.label}</ListItem>
        ));
    const list = (
        <BaseBox className="nest-scroll" style={{ maxHeight: `calc(var(--space-8) * ${maxVisible})`, overflowY: 'auto' }}>
            {rows}
        </BaseBox>
    );

    /* bare: skip the PanelSurface wrapper entirely — the host (a FilterMenu
     * Disclosure body) already owns the controlSize cluster + scroll, so we emit
     * just the rows. Otherwise the shared PanelSurface owns controlSize + scroll
     * (NO glass — Popover supplies that; NO padding — the row inset stays the
     * ListItem's alone, identical gutter in every panel). */
    if (bare) {
        return <>{header}{list}{footer}</>;
    }
    return (
        <PanelSurface controlSize="sm" header={header} footer={footer}
            maxHeight={`calc(var(--space-8) * ${maxVisible})`} minWidth="14rem" maxWidth="20rem">
            {rows}
        </PanelSurface>
    );
}
