import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isSameWeek } from 'date-fns';
import { BaseAction } from '../primitives/index.js';

/* ── CalendarDayView ──────────────────────────────────────
 * THE one month day-grid. A 7-column table of square, accessible day buttons
 * for ONE month — every calendar surface composes it instead of hand-rolling
 * the date math + cell styling (it replaced three near-identical copies in
 * DatePickerCalendarView, MonthView and YearView's inner loop).
 *
 * It owns ONLY the grid: the date interval, weekday header, selected/today/
 * out-of-month/disabled cell states, optional range-strip + week highlight, and
 * the square-cell geometry (table-layout:fixed so edge buttons reach the grid
 * edge — see the DatePicker header-alignment fix). All chrome — popover, < >
 * nav, month/year title, Today/Close footer, year-page container — stays with
 * the host. */

export interface CalendarDayViewProps {
    /** The month to render (any day within it). */
    monthDate: Date;
    /** Currently-selected day; renders as the solid primary cell. */
    selected?: Date | null;
    onSelect: (date: Date) => void;
    /** Tint the whole week containing `selected` (QuickCalendar weekly view). */
    showWeekHighlight?: boolean;
    /** Inclusive ISO range highlight — endpoints render selected, days between
     *  get a continuous primary-tint strip with rounded caps. */
    rangeStart?: string;
    rangeEnd?: string;
    /** Inclusive ISO upper bound — later days render dimmed + unpickable. */
    max?: string;
    /** Per-day disable predicate (ISO yyyy-MM-dd). Combines with `max`. */
    isDisabled?: (iso: string) => boolean;
    /** Compact variant — tighter font for the 12 mini-grids of a year view. */
    compact?: boolean;
    /** Hide the weekday-letter header row (year-view mini-grids share one). */
    hideWeekdays?: boolean;
}

/* A day cell reads the CONCENTRIC corner the surface publishes (--_nest-corner),
 * like every other control nested in a composed — curving PARALLEL to the panel,
 * not a flat control radius. Falls back to --radius-control standalone. (Was
 * forced flat because the old --space-2 popover padding collapsed the concentric
 * corner to ~0; the panels now inset --row-inset, so it resolves to a real value.)
 * This is also the BAND cap radius (the week strip's rounded ends, set on cell). */
const dayRadius = 'var(--_nest-corner, var(--radius-control))';

/* The selected pill nests INSIDE the band the same way SegmentedControl's
 * indicator nests in its track: inset by --row-inset (THE one origin inset token),
 * so its corner = the day's concentric corner − that inset, running PARALLEL to
 * the band cap one level deeper. */
const pillRadius = 'max(0px, calc(var(--_nest-corner, var(--radius-control)) - var(--row-inset)))';

/* Concave corner fill: paints the band tint into the inner angle of an
 * out-of-band cell so a multi-row range stairstep turns with a SMOOTH reverse
 * curve instead of a hard right angle. A `dayRadius`-square box anchored at the
 * notch corner, band-coloured, with a radial mask that cuts a quarter-disc out
 * of the INNER point — leaving band colour in the outer L and the curve facing
 * into the cell. The cutout centre is the inner point of each corner. */
const NOTCH_POS: Record<'tl' | 'tr' | 'bl' | 'br', { side: React.CSSProperties; at: string }> = {
    tl: { side: { top: 0, left: 0 },     at: '100% 100%' },
    tr: { side: { top: 0, right: 0 },    at: '0% 100%' },
    bl: { side: { bottom: 0, left: 0 },  at: '100% 0%' },
    br: { side: { bottom: 0, right: 0 }, at: '0% 0%' },
};

function NotchFill({ corner, radius }: { corner: 'tl' | 'tr' | 'bl' | 'br'; radius: string }) {
    const { side, at } = NOTCH_POS[corner];
    const mask = `radial-gradient(circle ${radius} at ${at}, transparent 0, transparent ${radius}, black calc(${radius} + 0.5px))`;
    return (
        <div aria-hidden style={{
            position: 'absolute', width: radius, height: radius, ...side,
            background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
            WebkitMask: mask, mask,
            pointerEvents: 'none', zIndex: 0,
        }} />
    );
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
    monthDate, selected, onSelect, showWeekHighlight, rangeStart, rangeEnd, max, isDisabled: isDisabledFn, compact, hideWeekdays,
}) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    /* Range-strip membership for ANY grid cell — by (week, day) index, so a cell
     * can test the neighbour ABOVE/BELOW it (same column, adjacent row) and not
     * just left/right. This is what lets a multi-row band FUSE: a corner only
     * rounds where the band has no neighbour on BOTH edges meeting there; where a
     * segment continues into the next row, that vertical edge stays square so the
     * rows read as one shape instead of stacked pills. Out-of-grid → false. */
    const hasRangeBand = !!rangeStart && !!rangeEnd && rangeStart !== rangeEnd;
    const inStripAt = (wi: number, di: number): boolean => {
        const d = weeks[wi]?.[di];
        if (!d || !hasRangeBand) return false;
        const k = format(d, 'yyyy-MM-dd');
        return k >= rangeStart! && k <= rangeEnd!;
    };

    /* Day cells read the NEST-LABEL role — the ONE font every selectable value
     * inside a popover shares (list rows, wheel numbers). Compact (year mini-grids)
     * stays smaller. (Was a hand-stamped 0.75rem.) */
    const font = compact ? '0.625rem' : 'var(--nest-label-font)';
    /* Weekday header reads the LABEL role (--text-label/--weight-label) — the SAME
     * column-header font as the time picker's HR/MIN (was hardcoded 500 / 0.75rem). */
    const thStyle: React.CSSProperties = { paddingBottom: compact ? '0.25rem' : '0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'var(--weight-label)' as React.CSSProperties['fontWeight'], fontSize: compact ? '0.5rem' : 'var(--text-label)' };

    return (
        /* table-layout:fixed → 7 equal columns; the day button fills its column
         * so the EDGE buttons reach the table edge, aligning with whatever chrome
         * the host stacks above (the DatePicker header < > buttons). */
        <table style={{ width: '100%', tableLayout: 'fixed', fontSize: font }}>
            {!hideWeekdays && (
                <thead>
                    <tr>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <th key={i} style={thStyle}>{d}</th>)}</tr>
                </thead>
            )}
            <tbody>
                {weeks.map((week, wi) => {
                    /* Week-highlight membership for the whole row, computed up front
                     * so a day knows whether its neighbours are in-week — the tint is
                     * ONE continuous strip on the cells (like the range strip), not 7
                     * touching pills, with rounded caps only where the run breaks. */
                    const weekIn = week.map((day) => !!showWeekHighlight && !!selected
                        && isSameMonth(day, monthStart)
                        && isSameWeek(day, selected, { weekStartsOn: 1 }));
                    return (
                    <tr key={wi}>
                        {week.map((day, di) => {
                            const iso = format(day, 'yyyy-MM-dd');
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const isStart = !!rangeStart && iso === rangeStart;
                            const isEnd = !!rangeEnd && iso === rangeEnd;
                            const isSelected = isStart || isEnd || (!!selected && isSameDay(day, selected));
                            /* Range tint lives on the CELL → one continuous strip across the
                             * week, rounded caps only at the true endpoints. */
                            const hasRange = !!rangeStart && !!rangeEnd && rangeStart !== rangeEnd;
                            const inStrip = hasRange && iso >= rangeStart! && iso <= rangeEnd!;
                            const inWeek = weekIn[di];
                            /* Strip caps: round the outer edge wherever the in-week run
                             * starts/ends (row edge OR a month-truncated neighbour). */
                            const weekCapL = inWeek && !weekIn[di - 1];
                            const weekCapR = inWeek && !weekIn[di + 1];
                            /* Band neighbours (range strip) on all four sides — drives
                             * corner FUSION across rows: a band corner only rounds when
                             * the band ends on BOTH edges meeting at it; an edge shared
                             * with an adjacent band cell stays square so the rows fuse. */
                            const bL = inStrip && inStripAt(wi, di - 1);   // left neighbour in band
                            const bR = inStrip && inStripAt(wi, di + 1);   // right
                            const bU = inStrip && inStripAt(wi - 1, di);   // above
                            const bD = inStrip && inStripAt(wi + 1, di);   // below
                            /* CONCAVE notches: an OUT-of-band cell sitting in the band's inner
                             * angle (band on two orthogonal sides) hosts a reverse-curve corner,
                             * so the stairstep turns smoothly instead of a hard right angle. Each
                             * flag = that corner of THIS (empty) cell faces the band's inner angle
                             * (e.g. day 7's bottom-right when 8 is right + 14 is below). The
                             * overlay below carves a quarter-circle of band colour into it. */
                            const notchTL = hasRangeBand && !inStrip && inStripAt(wi, di - 1) && inStripAt(wi - 1, di);
                            const notchTR = hasRangeBand && !inStrip && inStripAt(wi, di + 1) && inStripAt(wi - 1, di);
                            const notchBL = hasRangeBand && !inStrip && inStripAt(wi, di - 1) && inStripAt(wi + 1, di);
                            const notchBR = hasRangeBand && !inStrip && inStripAt(wi, di + 1) && inStripAt(wi + 1, di);
                            const hasNotch = notchTL || notchTR || notchBL || notchBR;
                            const isToday = isSameDay(day, new Date());
                            const isDisabled = (!!max && iso > max) || (isDisabledFn?.(iso) ?? false);
                            /* The week tint is an UNBROKEN track (SegmentedControl mechanic):
                             * the selected day's cell stays tinted too, and the solid pill
                             * rides ON TOP of the band — it never carves a hole in it. Without
                             * this the selected cell went transparent and the pill (aspect-1,
                             * narrower than the cell) left a gap on each side, breaking the bar. */
                            const cellWeekTint = inWeek;
                            /* The selected pill nests inside a band → inset on all 4 sides so the
                             * track frames it uniformly (vs flush L/R, floating T/B). */
                            const bandInsetPill = isSelected && (inWeek || inStrip);
                            return (
                                <td key={di} style={{
                                    /* No padding: the cell IS the square column; the band tint fills it
                                     * edge-to-edge so the strip is continuous, and the pill's uniform
                                     * margin (below) is the ONLY inset — equal on every side. */
                                    padding: 0,
                                    position: hasNotch ? 'relative' : undefined,
                                    background: inStrip || cellWeekTint ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                                    /* Corner rounds only when the band ENDS on BOTH edges meeting
                                     * there — so a multi-row band fuses (a corner shared with the
                                     * row above/below or the cell beside stays square) instead of
                                     * stacking separate pills. Week-highlight keeps its own L/R caps. */
                                    borderTopLeftRadius:     (inStrip && !bL && !bU) || weekCapL ? dayRadius : 0,
                                    borderBottomLeftRadius:  (inStrip && !bL && !bD) || weekCapL ? dayRadius : 0,
                                    borderTopRightRadius:    (inStrip && !bR && !bU) || weekCapR ? dayRadius : 0,
                                    borderBottomRightRadius: (inStrip && !bR && !bD) || weekCapR ? dayRadius : 0,
                                }}>
                                    {hasNotch && <NotchFill corner={notchTL ? 'tl' : notchTR ? 'tr' : notchBL ? 'bl' : 'br'} radius={dayRadius} />}
                                    <BaseAction type="button" disabled={isDisabled || !isCurrentMonth} onClick={() => onSelect(day)}
                                      /* A day is a SQUARE: aspectRatio:1 off the fixed column width (no
                                       * inherited control padding to overflow it — padding:0 + border-box).
                                       * Equal margin on ALL FOUR sides when it nests in a band, so the glyph
                                       * keeps a squared frame — no rectangles. */
                                      style={{ boxSizing: 'border-box', padding: 0, height: 'auto', aspectRatio: '1', width: bandInsetPill ? `calc(100% - 2 * var(--row-inset))` : '100%',
                                        margin: bandInsetPill ? 'var(--row-inset)' : 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        /* In a band (week strip / range) the pill nests with the parallel
                                         * inset corner; standalone it reads the full control corner. */
                                        borderRadius: inWeek || inStrip ? pillRadius : dayRadius,
                                        /* NEST-LABEL font+weight for ALL days — the ONE tier-2 value role
                                         * (list rows, wheel numbers). Set explicitly: the BaseAction's own
                                         * .base-action --_ctl-font (12px) would otherwise override the
                                         * table's inherited 14px. Selection shown by fill, not a weight jump. */
                                        fontSize: 'var(--nest-label-font)',
                                        fontWeight: 'var(--nest-label-weight)' as React.CSSProperties['fontWeight'], transition: 'all 0.15s',
                                        /* Adjacent-month days fill the first/last week — shown (not blanked)
                                         * in --text-muted, the subtle TEXT role, so they read as
                                         * present-but-secondary. (--border-main was a border colour misused
                                         * as text + an empty label that left ragged grid edges.) A disabled
                                         * in-month day dims the same; the range strip lifts it to muted. */
                                        color: isSelected ? 'var(--text-inverse)' : !isCurrentMonth || isDisabled ? 'var(--text-muted)' : isToday || inWeek ? 'var(--primary-text)' : 'var(--text-main)',
                                        /* Button itself is transparent for week days — the tint is the
                                         * cell strip beneath it; only the selected day paints a fill. */
                                        background: isSelected ? 'var(--primary)' : 'transparent',
                                        boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05)' : undefined,
                                        /* Today's outline is suppressed inside the band: the strip is ONE
                                         * figure, and a second outlined box competing on it breaks that. The
                                         * band already marks the week — today reads from it, not its own box. */
                                        outline: isToday && !isSelected && !inWeek && !inStrip ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' : undefined }}>
                                        {format(day, 'd')}
                                    </BaseAction>
                                </td>
                            );
                        })}
                    </tr>
                    );
                })}
            </tbody>
        </table>
    );
};
