import React, { useState } from 'react';
import { format, parse } from 'date-fns';
import { BaseBox, BaseText } from '../primitives/index.js';
import { Button } from './Button.js';
import { DatePickerCalendarSection } from './DatePickerCalendarSection.js';
import type { DateRangeValue } from './DateRangePicker.js';

/* ── DateRangeCalendarView ────────────────────────────────
 * ONE calendar, click-click range selection — the modern pattern (click a
 * day to set the start, click another to set the end; the days between fill
 * with a primary tint; clicking again restarts). Replaces the old TWO-calendar
 * side-by-side layout (pick-start-left / pick-end-right), which was wide,
 * forced the user to map "left = start", and read dated.
 *
 * The range highlight is already owned by CalendarDayView (rangeStart/rangeEnd
 * → tinted between-days); this just drives a two-click state machine on top of
 * the single shared grid. Pure panel content — hosts decide the vessel (chart
 * header chip popover; the DateRangePicker panel). Same props as before
 * (`value` / `onCommit` / `max`) so it's a drop-in replacement. */

export interface DateRangeCalendarViewProps {
    value: DateRangeValue;
    onCommit: (start: string, end: string) => void;
    /** Inclusive ISO upper bound — see DatePickerCalendarView.max. */
    max?: string;
}

const toDate = (iso: string): Date => parse(iso, 'yyyy-MM-dd', new Date());
const iso = (d: Date): string => format(d, 'yyyy-MM-dd');

export function DateRangeCalendarView({ value, onCommit, max }: DateRangeCalendarViewProps) {
    /* Open at the start month (or the end month for an all-time range, to avoid
     *  paging back to 1970). */
    const [viewDate, setViewDate] = useState<Date>(() => toDate(value.preset === 'all' ? value.end : value.start));
    /* Two-click machine: `anchor` is the first-clicked day while we await the
     *  second. null = no pick in progress (the next click STARTS a new range). */
    const [anchor, setAnchor] = useState<string | null>(null);

    const pick = (day: Date) => {
        const d = iso(day);
        if (anchor === null) {
            // First click: begin a new range at this day (collapsed to one day).
            setAnchor(d);
            onCommit(d, d);
        } else {
            // Second click: close the range; order the two endpoints so it can't invert.
            const [start, end] = d < anchor ? [d, anchor] : [anchor, d];
            setAnchor(null);
            onCommit(start, end);
        }
    };

    /* `nest-controls` + radius="card" pad="row" publishes the --_nest-*
     *  cascade (same as DatePicker's body wrapper). WITHOUT it --_nest-corner
     *  is unset, so the day cell's selected pill + the range-segment band fall
     *  back to a FLAT --radius-control instead of the concentric corner that
     *  curves parallel to the panel — i.e. they stop following the corner-
     *  construction pipeline. This wrapper is what makes dayRadius/pillRadius
     *  (CalendarDayView) resolve to real nested values. */
    return (
        <BaseBox className="nest-controls" radius="card" pad="row"
            display="flex" direction="col" density="tight" style={{ minWidth: '15rem' }}>
            <BaseBox display="flex" direction="row" align="center" justify="between">
                {/* `label` variant IS the uppercase micro-label (tracking + weight
                 *  from tokens) — no inline textTransform/letterSpacing reimpl. */}
                <BaseText variant="label" color="muted">
                    {anchor !== null ? 'Pick end date' : 'Pick start date'}
                </BaseText>
                {/* Reuse the Button primitive + the canonical Today treatment
                 *  (color: --primary), matching DatePickerFooter — not a
                 *  hand-rolled BaseAction with inline font sizes. */}
                <Button type="button" variant="ghost" size="sm" style={{ color: 'var(--primary)' }}
                    onClick={() => { const now = new Date(); setViewDate(now); setAnchor(null); onCommit(value.start, iso(now)); }}>
                    Today
                </Button>
            </BaseBox>
            <DatePickerCalendarSection
                viewDate={viewDate} setViewDate={setViewDate} value="" onSelect={pick}
                rangeStart={value.start} rangeEnd={value.end} max={max}
            />
        </BaseBox>
    );
}
