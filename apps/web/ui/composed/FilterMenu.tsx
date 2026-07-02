import { SlidersHorizontal } from '../icons/index.js';
import { BaseBox } from '../primitives/index.js';
import { FilterTrigger } from './FilterTrigger.js';
import { Disclosure } from './Disclosure.js';
import { MultiSelectPanel, type MultiSelectOption } from './MultiSelectPanel.js';

/* ── FilterMenu ───────────────────────────────────────────
 * One "Filter" button that opens a popover holding several filters
 * as collapsible sections — the canonical pattern when a view has a
 * handful of OCCASIONAL filters that don't each warrant their own
 * header button (Calendar's Provider/Status/Service; Statistics'
 * macro filters).
 *
 * Composition: FilterTrigger (the button + viewport-aware popover) +
 * one Disclosure per section, each body a MultiSelectPanel. FilterMenu
 * OWNS the panel (a section declares its options + selection, not opaque
 * markup) — so the composition graph reveals MultiSelectPanel → SearchField
 * automatically, and every call site stops re-rendering the same panel by
 * hand. `activeCount` drives the trigger badge — 0 hides it. */

export interface FilterMenuSection {
    /** Stable key. */
    key: string;
    label: string;
    /** Muted summary beside the label, e.g. "4 of 5". */
    summary?: React.ReactNode;
    /** The section's selectable options. */
    options: ReadonlyArray<MultiSelectOption>;
    /** Currently-selected values. */
    selected: ReadonlyArray<string>;
    /** Selection change handler. */
    onChange: (next: string[]) => void;
    /** Search-box hint for this section's panel. */
    searchPlaceholder?: string;
    /** Start this section expanded. Default false. */
    defaultOpen?: boolean;
}

export interface FilterMenuProps {
    sections: FilterMenuSection[];
    /** Number of filters currently narrowing — drives the badge (0 = none). */
    activeCount?: number;
    /** Trigger label. Default "Filter". */
    label?: string;
    /** Popover panel width. Default "20rem". */
    width?: string;
}

export function FilterMenu({ sections, activeCount = 0, label = 'Filter', width = '20rem' }: FilterMenuProps) {
    return (
        <FilterTrigger
            icon={<SlidersHorizontal style={{ width: 'var(--_ctl-icon)', height: 'var(--_ctl-icon)' }} />}
            label={label}
            badge={activeCount}
            align="right"
            // Surface lifted to the animated Popover element (glass + clip-reveal
            // co-located). The glass is owned by Popover; this passes only the
            // panel's non-surface extras. The inset (NO padding) is owned by
            // ListItem's .nest-row margin, same gutter as every list panel.
            panelStyle={{ width, maxHeight: '70vh', overflowY: 'auto' }}
        >
            {() => (
                /* controlSize tier for the headers + rows. Plain box (no glass), so
                 * it carries no backdrop-filter and can't reintroduce the clip
                 * conflict; the glass + clip live on the Popover element above. */
                <BaseBox controlSize="sm">
                    {sections.map(s => (
                        <Disclosure key={s.key} label={s.label} summary={s.summary} defaultOpen={s.defaultOpen}>
                            <MultiSelectPanel bare options={s.options} selected={s.selected}
                                onChange={s.onChange} searchPlaceholder={s.searchPlaceholder} />
                        </Disclosure>
                    ))}
                </BaseBox>
            )}
        </FilterTrigger>
    );
}
