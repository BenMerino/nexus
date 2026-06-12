import React, { useState } from 'react';
import { format, parse } from 'date-fns';
import { BaseAction, BaseBox, BaseText } from '../primitives/index.js';
import { DatePickerCalendarSection } from './DatePickerCalendarSection.js';
import type { DateRangeValue } from './DateRangePicker.js';

/* ── DateRangeCalendarView ────────────────────────────────
 * TWO inline month grids side by side — pick the start on the left
 * calendar, the end on the right (with a Today quick action). Each
 * pick commits immediately; picking past the other endpoint drags
 * it along so the range can never invert. Pure panel content: hosts
 * decide the vessel (chart header chip popover; Disclosure tier in
 * the full DateRangePicker). */

export interface DateRangeCalendarViewProps {
    value: DateRangeValue;
    onCommit: (start: string, end: string) => void;
    /** Inclusive ISO upper bound — see DatePickerCalendarView.max. */
    max?: string;
}

const toDate = (iso: string): Date => parse(iso, 'yyyy-MM-dd', new Date());

export function DateRangeCalendarView({ value, onCommit, max }: DateRangeCalendarViewProps) {
    /* All-time ranges start at the epoch — open both calendars at the
     *  END month instead of paging back to 1970. */
    const [startView, setStartView] = useState<Date>(() => toDate(value.preset === 'all' ? value.end : value.start));
    const [endView, setEndView] = useState<Date>(() => toDate(value.end));

    const pickStart = (day: Date) => {
        const iso = format(day, 'yyyy-MM-dd');
        onCommit(iso, iso > value.end ? iso : value.end);
    };
    const pickEnd = (day: Date) => {
        const iso = format(day, 'yyyy-MM-dd');
        onCommit(iso < value.start ? iso : value.start, iso);
    };

    const colStyle: React.CSSProperties = { minWidth: '15rem' };
    const colLabel: React.CSSProperties = { textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 };
    /* Both header rows share one height so the two calendars stay level
     *  even though only End carries the Today quick action. */
    const colHead: React.CSSProperties = { minHeight: '1.75rem', marginBottom: 'var(--space-1)' };

    /* density="tight" = --space-2 per side of the divider, matching the host
     * panel's pad="tight" — each column's content sits the same distance from
     * the divider as from the panel border. */
    return (
        <BaseBox display="flex" direction="row" density="tight" style={{ alignItems: 'flex-start' }}>
            <BaseBox style={colStyle}>
                <BaseBox display="flex" direction="row" align="center" style={colHead}>
                    <BaseText variant="detail" color="muted" style={colLabel}>Start</BaseText>
                </BaseBox>
                <DatePickerCalendarSection viewDate={startView} setViewDate={setStartView} value="" onSelect={pickStart}
                    rangeStart={value.start} rangeEnd={value.end} max={max} />
            </BaseBox>
            <BaseBox style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border-subtle, var(--border-main))' }} />
            <BaseBox style={colStyle}>
                <BaseBox display="flex" direction="row" align="center" justify="between" style={colHead}>
                    <BaseText variant="detail" color="muted" style={colLabel}>End</BaseText>
                    {/* Quick action: snap the range's end to today and
                      * bring the calendar back to the current month. */}
                    <BaseAction
                        variant="ghost" size="sm"
                        onClick={() => { const now = new Date(); setEndView(now); pickEnd(now); }}
                        style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--primary-text, var(--text-main))' }}
                    >
                        Today
                    </BaseAction>
                </BaseBox>
                <DatePickerCalendarSection viewDate={endView} setViewDate={setEndView} value="" onSelect={pickEnd}
                    rangeStart={value.start} rangeEnd={value.end} max={max} />
            </BaseBox>
        </BaseBox>
    );
}
