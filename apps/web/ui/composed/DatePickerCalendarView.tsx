import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parse } from 'date-fns';
import { BaseAction } from '../primitives/index.js';

export interface DatePickerCalendarViewProps {
    viewDate: Date; value: string; onSelect: (date: Date) => void;
    /** Optional range highlight (inclusive ISO bounds). Endpoints render
     *  like the selected day; days strictly between get a primary tint.
     *  `rangeStart` alone marks a pending range's first pick. Single-date
     *  consumers (DatePicker) just omit these. */
    rangeStart?: string; rangeEnd?: string;
    /** Inclusive ISO upper bound — days after it render dimmed and
     *  unpickable. Hosts whose window clamps to today (chart range
     *  popover) pass it so a pick can never silently collapse. */
    max?: string;
}

/* Selected-day fill + strip end-caps use the concentric-nesting corner
 * (host radius − pad − border via the --_nest-* publication) instead of
 * a half-height circle. Unhosted falls back to the control radius. */
const dayRadius = 'max(0px, calc(var(--_nest-r, var(--radius-control)) - var(--_nest-pad, 0px) - 1px))';

export const DatePickerCalendarView: React.FC<DatePickerCalendarViewProps> = ({ viewDate, value, onSelect, rangeStart, rangeEnd, max }) => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const thStyle: React.CSSProperties = { paddingBottom: '0.5rem', textAlign: 'center', width: '2rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem' };

    return (
        <table style={{ width: '100%', fontSize: '0.75rem' }}>
            <thead>
                <tr>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <th key={i} style={thStyle}>{d}</th>)}</tr>
            </thead>
            <tbody>
                {weeks.map((week, wi) => (
                    <tr key={wi}>
                        {week.map((day, di) => {
                            const iso = format(day, 'yyyy-MM-dd');
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const isStart = iso === rangeStart;
                            const isEnd = iso === rangeEnd;
                            const isSelected = isStart || isEnd || (!!value && isSameDay(day, parse(value, 'yyyy-MM-dd', new Date())));
                            /* The range tint lives on the CELL (gap-free → one
                             *  continuous strip across the week), with rounded
                             *  caps only at the true endpoints. The endpoint
                             *  day keeps its solid circle on top. */
                            const hasRange = !!rangeStart && !!rangeEnd && rangeStart !== rangeEnd;
                            const inStrip = hasRange && iso >= rangeStart! && iso <= rangeEnd!;
                            const isToday = isSameDay(day, new Date());
                            const isDisabled = !!max && iso > max;
                            const cap = dayRadius;
                            return (
                                <td key={di} style={{
                                    padding: '0.125rem 0',
                                    background: inStrip ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                                    borderTopLeftRadius: isStart ? cap : 0,
                                    borderBottomLeftRadius: isStart ? cap : 0,
                                    borderTopRightRadius: isEnd ? cap : 0,
                                    borderBottomRightRadius: isEnd ? cap : 0,
                                }}>
                                    <BaseAction type="button" disabled={isDisabled} onClick={() => onSelect(day)}
                                      style={{ width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', borderRadius: dayRadius, fontWeight: 500, transition: 'all 0.15s',
                                        /* Out-of-month days dim to the hairline gray — but inside the
                                         * range strip that gray vanishes into the primary tint, so
                                         * lift those to text-muted to stay legible. */
                                        color: isSelected ? 'var(--text-inverse)' : isDisabled || !isCurrentMonth ? (inStrip ? 'var(--text-muted)' : 'var(--border-main)') : isToday ? 'var(--primary-text)' : 'var(--text-main)',
                                        background: isSelected ? 'var(--primary)' : 'transparent',
                                        boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05)' : undefined,
                                        outline: isToday && !isSelected ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' : undefined }}>
                                        {format(day, 'd')}
                                    </BaseAction>
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
