import React from 'react';
import { format, addMonths, addYears } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BaseBox, BaseAction, BaseText } from '../primitives/index.js';

/** Zoom tier of the calendar — drives the nav stride (month / year /
 *  12-year page) and which title segment reads as active. */
export type CalendarHeaderMode = 'days' | 'months' | 'years';

export interface DatePickerCalendarHeaderProps {
    viewDate: Date;
    setViewDate: (date: Date) => void;
    mode: CalendarHeaderMode;
    /** Clicking the month / year title segment toggles its grid tier. */
    onModeToggle: (tier: 'months' | 'years') => void;
}

/* Corner comes from the icon-only primitive's concentric-nesting rule
 * (base-action.css) — no per-site radius. */
const navBtn: React.CSSProperties = {
    padding: 'var(--space-1)',
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
};

export const DatePickerCalendarHeader: React.FC<DatePickerCalendarHeaderProps> = ({ viewDate, setViewDate, mode, onModeToggle }) => {
    const nav = (dir: 1 | -1) => setViewDate(
        mode === 'years' ? addYears(viewDate, dir * 12)
            : mode === 'months' ? addYears(viewDate, dir)
                : addMonths(viewDate, dir));
    const seg = (tier: 'months' | 'years', label: string) => (
        <BaseAction type="button" onClick={() => onModeToggle(tier)} style={{ padding: 'var(--space-0-5) var(--space-1)' }}>
            <BaseText variant="body" weight="bold" color="heading"
                style={{ textTransform: 'capitalize', ...(mode === tier && { color: 'var(--primary-text, var(--text-main))' }) }}>
                {label}
            </BaseText>
        </BaseAction>
    );
    return (
        <BaseBox display="flex" align="center" justify="between" mb="4">
            {/* Bleed the first segment's hover-padding so the title text
              * stays flush with the column labels / grid edge above+below. */}
            <BaseBox display="flex" align="center" style={{ marginLeft: 'calc(-1 * var(--space-1))' }}>
                {seg('months', format(viewDate, 'MMMM'))}
                {seg('years', format(viewDate, 'yyyy'))}
            </BaseBox>
            <BaseBox display="flex" align="center" density="tight">
                <BaseAction type="button" onClick={() => nav(-1)} style={navBtn}>
                    <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
                </BaseAction>
                <BaseAction type="button" onClick={() => nav(1)} style={navBtn}>
                    <ChevronRight style={{ width: '1rem', height: '1rem' }} />
                </BaseAction>
            </BaseBox>
        </BaseBox>
    );
};
