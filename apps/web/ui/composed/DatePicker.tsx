import React, { useRef } from 'react';
import { format } from 'date-fns';
import { BaseBox } from '../primitives/index.js';
import { Popover } from './Popover.js';
import { useDatePicker } from './useDatePicker.js';
import { DatePickerInput } from './DatePickerInput.js';
import { DatePickerCalendarSection } from './DatePickerCalendarSection.js';
import { DatePickerFooter } from './DatePickerFooter.js';

export interface DatePickerProps {
    value: string; onChange: (value: string) => void;
    className?: string; placeholder?: string;
}

/* Non-surface panel extras only — the glass is owned by Popover. The
 * inset/concentric triple is NOT here either: a `<BaseBox radius="card" pad="row">`
 * body wrapper publishes --_nest-* via the cascade (one source), so nested controls
 * + the day grid curve parallel to the panel by construction.
 *
 * FIXED width (not minWidth): the day grid fills its column (table-layout:fixed)
 * for header-aligned edges, so the table carries no intrinsic width to anchor the
 * panel — without a cap it expands to its container. A fixed width keeps it sized. */
const PANEL_STYLE = {
    width: '248px',
} as React.CSSProperties;

export function DatePicker({ value, onChange, className = '', placeholder = 'DD-MM-YYYY' }: DatePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const picker = useDatePicker(value, onChange);

    return (
        <BaseBox className={`w-full ${className}`}>
            <Popover
                panelStyle={PANEL_STYLE}
                trigger={({ open, toggle }) => {
                    /* DatePickerInput calls setIsOpen(true) (click input) and
                     * setIsOpen(!open) (chevron). Popover exposes only toggle, so
                     * adapt: flip only when the requested state differs. */
                    const setIsOpen = (v: boolean) => { if (v !== open) toggle(); };
                    return (
                        <DatePickerInput
                            isOpen={open} setIsOpen={setIsOpen} inputValue={picker.inputValue} inputRef={inputRef}
                            handleInputChange={picker.handleInputChange} handleBlur={picker.handleBlur}
                            handleKeyDown={(e) => { if (e.key === 'Enter') { picker.handleBlur(); if (open) toggle(); } }}
                            placeholder={placeholder}
                        />
                    );
                }}
            >
                {(close) => {
                    const selectDate = (date: Date) => { onChange(format(date, 'yyyy-MM-dd')); close(); };
                    /* Glass + clip-reveal live on Popover's animated element (panelStyle).
                     * This body wrapper owns the INSET layer: radius="card" pad="row"
                     * publishes the --_nest-* triple via the cascade, so the nav buttons
                     * + day grid curve parallel to the panel by construction. */
                    return (
                        <BaseBox className="nest-controls" radius="card" pad="row">
                            <DatePickerCalendarSection viewDate={picker.viewDate} setViewDate={picker.setViewDate} value={value} onSelect={selectDate} />
                            <DatePickerFooter onToday={() => selectDate(new Date())} onClose={close} />
                        </BaseBox>
                    );
                }}
            </Popover>
        </BaseBox>
    );
}
