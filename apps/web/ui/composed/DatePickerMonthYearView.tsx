import React from 'react';
import { format, getYear, setMonth, setYear } from 'date-fns';
import { BaseBox, BaseAction } from '../primitives/index.js';

/* ── DatePickerMonthYearView ──────────────────────────────
 * The zoomed-out grid behind the header's clickable title segments:
 * 12 months of the view year, or a 12-year page around the view year.
 * Picking a cell hands back a new viewDate — the host decides what
 * happens next (snap back to the day grid). */

export interface DatePickerMonthYearViewProps {
    mode: 'months' | 'years';
    viewDate: Date;
    onPick: (date: Date) => void;
}

export const DatePickerMonthYearView: React.FC<DatePickerMonthYearViewProps> = ({ mode, viewDate, onPick }) => {
    const cells = mode === 'months'
        ? Array.from({ length: 12 }, (_, i) => ({
            key: `m${i}`, label: format(setMonth(viewDate, i), 'MMM'),
            date: setMonth(viewDate, i), active: viewDate.getMonth() === i,
        }))
        : Array.from({ length: 12 }, (_, i) => {
            const y = getYear(viewDate) - 5 + i;
            return { key: `y${y}`, label: String(y), date: setYear(viewDate, y), active: getYear(viewDate) === y };
        });
    /* minHeight ≈ the day grid (weekday header + weeks of 2rem cells) so
     * swapping tiers never resizes the popover; 1fr rows + columns stretch
     * the 12 cells to fill it evenly on both axes. */
    return (
        <BaseBox display="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '1fr', gap: 'var(--space-1)', minHeight: '13.5rem' }}>
            {cells.map(c => (
                /* Each cell reads as a real, VISIBLE button: `outline` gives the
                 * tappable bordered surface (vs the old transparent bg that read
                 * as bare text), and the active month/year fills with `primary`.
                 * Surface comes from the variant — only the active fill + the
                 * grid-fit (centred, full-height) are set here. */
                <BaseAction
                    key={c.key} type="button" size="sm"
                    variant={c.active ? 'primary' : 'outline'}
                    onClick={() => onPick(c.date)}
                    style={{
                        justifyContent: 'center', height: '100%',
                        textTransform: mode === 'months' ? 'capitalize' : undefined,
                    }}
                >
                    {c.label}
                </BaseAction>
            ))}
        </BaseBox>
    );
};
