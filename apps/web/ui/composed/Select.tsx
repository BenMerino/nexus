import React from 'react';
import { ChevronDown } from '../icons/index.js';
import { BaseText, BaseIcon } from '../primitives/index.js';
import { PopoverTrigger } from './PopoverTrigger.js';
import { SingleSelectPanel, type SingleSelectOption } from './SingleSelectPanel.js';

/* ── Select ───────────────────────────────────────────────
 * The DNA single-choice dropdown. NOT a native <select> (which the OS draws,
 * un-themeable) — it's a PopoverTrigger (field skin) whose content is
 * the selected label and whose panel is a SingleSelectPanel. So it inherits
 * the one trigger family, the one input shell, the one list row (ListItem),
 * the one floating surface, and the one open/dismiss machinery — every part is
 * DNA, nothing native leaks up.
 *
 * Clean value API (value + onChange(value) + options[]), not the native
 * e.target.value / <option> shape. */

export interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: ReadonlyArray<SingleSelectOption>;
    /** Shown when nothing matches `value`. Default 'Select…'. */
    placeholder?: string;
    /** Show the panel's search box. Default: only when options exceed maxVisible. */
    searchable?: boolean;
    className?: string;
}

export function Select({ value, onChange, options, placeholder = 'Select…', searchable, className }: SelectProps) {
    const selected = options.find(o => o.value === value);
    return (
        <PopoverTrigger
            skin="field"
            className={className}
            trailing={({ open }) => (
                <BaseIcon icon={ChevronDown}
                    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : undefined }} />
            )}
            panel={(close) => (
                <SingleSelectPanel
                    options={options}
                    value={value}
                    onChange={(v) => { onChange(v); close(); }}
                    searchable={searchable}
                />
            )}
        >
            {/* Trigger text reads the CONTROL cascade (--_ctl-font/--_ctl-weight),
              * not a fixed body variant — the field label sizes with its tier like
              * every other input. BaseText injects its variant font inline, so the
              * cascade vars are passed inline here to win (the NEST_LABEL pattern). */}
            <BaseText color={selected ? 'main' : 'muted'} truncate
                style={{ flex: 1, fontSize: 'var(--_ctl-font)', fontWeight: 'var(--_ctl-weight)' as React.CSSProperties['fontWeight'] }}>
                {selected?.label ?? placeholder}
            </BaseText>
        </PopoverTrigger>
    );
}
