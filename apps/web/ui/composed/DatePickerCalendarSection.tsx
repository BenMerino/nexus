import React, { useState } from 'react';
import { DatePickerCalendarHeader, type CalendarHeaderMode } from './DatePickerCalendarHeader.js';
import { DatePickerCalendarView } from './DatePickerCalendarView.js';
import { DatePickerMonthYearView } from './DatePickerMonthYearView.js';

/* ── DatePickerCalendarSection ────────────────────────────
 * One month calendar with zoomable navigation: header (clickable
 * month / year segments + stride-aware chevrons) over the day grid,
 * which swaps to a month or year grid while a title segment is
 * active. Owns ONLY the zoom mode — viewDate stays controlled by
 * the host (DatePicker, DateRangeCalendarView). */

export interface DatePickerCalendarSectionProps {
    viewDate: Date;
    setViewDate: (date: Date) => void;
    /** Passthrough to the day grid (see DatePickerCalendarView). */
    value: string;
    onSelect: (date: Date) => void;
    rangeStart?: string;
    rangeEnd?: string;
    max?: string;
    /** Passthrough to the day grid — per-day disable predicate (see
     *  DatePickerCalendarView). Booking calendar greys closed days with it. */
    isDisabled?: (iso: string) => boolean;
}

export function DatePickerCalendarSection({ viewDate, setViewDate, value, onSelect, rangeStart, rangeEnd, max, isDisabled }: DatePickerCalendarSectionProps) {
    const [mode, setMode] = useState<CalendarHeaderMode>('days');
    return (
        <>
            <DatePickerCalendarHeader
                viewDate={viewDate} setViewDate={setViewDate} mode={mode}
                onModeToggle={(tier) => setMode(m => m === tier ? 'days' : tier)}
            />
            {mode === 'days'
                ? <DatePickerCalendarView viewDate={viewDate} value={value} onSelect={onSelect} rangeStart={rangeStart} rangeEnd={rangeEnd} max={max} isDisabled={isDisabled} />
                : <DatePickerMonthYearView mode={mode} viewDate={viewDate} onPick={(d) => { setViewDate(d); setMode('days'); }} />}
        </>
    );
}
