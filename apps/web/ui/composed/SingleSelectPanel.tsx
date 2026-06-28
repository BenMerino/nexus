import React, { useMemo, useState } from 'react';
import { Check } from '../icons/index.js';
import { BaseBox, BaseText, BaseIcon } from '../primitives/index.js';
import { SearchField } from './SearchField.js';
import { ListItem } from './ListItem.js';
import { PanelSurface } from './PanelSurface.js';

/* ── SingleSelectPanel ───────────────────────────────────
 * Single-choice twin of <MultiSelectPanel>. Same FilterTrigger-popover look —
 * searchable, themed, flat — but picks ONE value and (optionally) closes. Use
 * it wherever a field chooses one option from a list, so single- and
 * multi-select share one molecule family instead of falling back to a native
 * <select>:
 *
 *   <FilterTrigger label={current?.label ?? '—'}>
 *     {(close) => <SingleSelectPanel options={…} value={…} onChange={(v) => { set(v); close(); }} />}
 *   </FilterTrigger>
 */

export interface SingleSelectOption {
    value: string;
    label: string;
    /** Optional right-side adornment for this row — a tag, a star, a hint.
     *  Renders before the selected-check. Declarative: the panel owns row
     *  layout, the host supplies data (not markup). */
    rightAccessory?: React.ReactNode;
    /** Dim the row (half-opacity) while keeping it selectable — e.g. an
     *  inactive-but-switchable location. NOT `disabled` (which blocks click). */
    dimmed?: boolean;
    /** Block selection (greyed, no hover, not clickable) — e.g. a range with
     *  no data. Pair with `rightAccessory` to say WHY ("No data"), so the row
     *  reads as "exists but empty", not a mystery dead button. The currently
     *  selected option should never be passed `disabled` (the user must be
     *  able to see + leave it). */
    disabled?: boolean;
}

export interface SingleSelectPanelProps {
    options: ReadonlyArray<SingleSelectOption>;
    value: string;
    onChange: (next: string) => void;
    emptyLabel?: string;
    searchPlaceholder?: string;
    /** Max visible options before scroll. Default 8. */
    maxVisible?: number;
    /** Hide the search box (use for short lists, e.g. 2–3 options). Default:
     *  search shown only when options exceed `maxVisible`. */
    searchable?: boolean;
    /** Drop the standalone card chrome so the panel sits flush in a host. */
    bare?: boolean;
    /** Optional pinned footer below the scrolling list — e.g. a "Custom…" row
     *  that opens its own picker. Stays visible while the list scrolls (twin of
     *  MultiSelectPanel's footer). */
    footer?: React.ReactNode;
}

export function SingleSelectPanel({
    options, value, onChange,
    emptyLabel = 'No options',
    searchPlaceholder = 'Search…',
    maxVisible = 8,
    searchable,
    bare = false,
    footer,
}: SingleSelectPanelProps) {
    const [q, setQ] = useState('');
    const showSearch = searchable ?? options.length > maxVisible;

    const visible = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return ql ? options.filter(o => o.label.toLowerCase().includes(ql)) : options;
    }, [options, q]);

    /* SearchField carries its own inset + nested corner like the rows — shown only
     * when the list is long enough (or forced via `searchable`). */
    const header = showSearch
        ? <SearchField value={q} onChange={setQ} placeholder={searchPlaceholder} />
        : undefined;
    const rows = visible.length === 0
        ? <BaseBox pad="normal"><BaseText variant="detail" color="muted">{emptyLabel}</BaseText></BaseBox>
        : visible.map(opt => (
            <ListItem key={opt.value} as="button" active={opt.value === value}
                disabled={opt.disabled}
                onClick={() => { if (!opt.disabled) onChange(opt.value); }}
                style={opt.dimmed && !opt.disabled ? { opacity: 0.5 } : undefined}
                leftIcon={<BaseIcon icon={Check} color="var(--primary-text)" style={{ opacity: opt.value === value ? 1 : 0 }} />}
                rightAccessory={opt.rightAccessory}>
                {opt.label}
            </ListItem>
        ));
    const list = (
        <BaseBox className="nest-scroll" style={{ maxHeight: `calc(var(--space-8) * ${maxVisible})`, overflowY: 'auto' }}>
            {rows}
        </BaseBox>
    );

    /* bare: the host owns the wrapper (controlSize + scroll), so emit just the rows.
     * Otherwise PanelSurface owns controlSize + scroll (NO glass — Popover supplies
     * that), NO padding —
     * the row inset stays the ListItem's, identical across every list panel. */
    if (bare) return <>{header}{list}{footer}</>;
    return (
        <PanelSurface controlSize="sm" header={header} footer={footer} maxHeight={`calc(var(--space-8) * ${maxVisible})`}
            minWidth="12rem" maxWidth="20rem">
            {rows}
        </PanelSurface>
    );
}
