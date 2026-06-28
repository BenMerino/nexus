import React from 'react';
import { parse } from 'date-fns';
import { CalendarDayView } from './CalendarDayView.js';

export interface DatePickerCalendarViewProps {
    viewDate: Date; value: string; onSelect: (date: Date) => void;
    /** Optional range highlight (inclusive ISO bounds). Endpoints render
     *  like the selected day; days strictly between get a primary tint. */
    rangeStart?: string; rangeEnd?: string;
    /** Inclusive ISO upper bound — days after it render dimmed + unpickable. */
    max?: string;
    /** Per-day disable predicate (ISO yyyy-MM-dd). Combines with `max`. */
    isDisabled?: (iso: string) => boolean;
}

/* The DatePicker's day grid is the shared CalendarDayView wearing the picker's
 * concerns: a single ISO `value` is parsed to the selected Date; range/max/
 * disable pass straight through. No grid logic restated here. */
export const DatePickerCalendarView: React.FC<DatePickerCalendarViewProps> = ({ viewDate, value, onSelect, rangeStart, rangeEnd, max, isDisabled }) => (
    <CalendarDayView
        monthDate={viewDate}
        selected={value ? parse(value, 'yyyy-MM-dd', new Date()) : null}
        onSelect={onSelect}
        rangeStart={rangeStart} rangeEnd={rangeEnd} max={max} isDisabled={isDisabled}
    />
);
