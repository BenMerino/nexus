import React from 'react';
import { format, parse } from 'date-fns';
import { Disclosure } from './Disclosure.js';
import { DateRangeCalendarView } from './DateRangeCalendarView.js';
import type { DateRangeValue } from './DateRangePicker.js';

/* ── DateRangeCalendarSection ─────────────────────────────
 * The "Custom range" tier of the FULL DateRangePicker (presets +
 * custom): ONE disclosure row (collapsed by default, single chevron)
 * that expands the single-calendar click-click range view. Hosts that
 * vessel ONLY custom dates (the chart header's Custom chip) mount
 * `DateRangeCalendarView` directly instead. */

export interface DateRangeCalendarSectionProps {
    value: DateRangeValue;
    onCommit: (start: string, end: string) => void;
}

const pretty = (iso: string): string => format(parse(iso, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy');

export function DateRangeCalendarSection({ value, onCommit }: DateRangeCalendarSectionProps) {
    const summary = value.preset === 'custom' ? `${pretty(value.start)} → ${pretty(value.end)}` : undefined;
    return (
        <Disclosure label="Custom range" summary={summary}>
            <DateRangeCalendarView value={value} onCommit={onCommit} />
        </Disclosure>
    );
}
