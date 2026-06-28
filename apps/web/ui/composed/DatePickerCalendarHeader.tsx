import React from 'react';
import { format, addMonths, addYears } from 'date-fns';
import { ChevronLeft, ChevronRight } from '../icons/index.js';
import { BaseBox, BaseAction, BaseText, BaseIcon } from '../primitives/index.js';

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
/* Header controls live at the sm tier — the md default (40px tall) over-padded
 * them vertically: the chevrons read tall-and-narrow and the title pills had a
 * big top/bottom gap. Colour/bg only; size + padding come from the cascade. */
const navBtn: React.CSSProperties = {
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
};

export const DatePickerCalendarHeader: React.FC<DatePickerCalendarHeaderProps> = ({ viewDate, setViewDate, mode, onModeToggle }) => {
    const nav = (dir: 1 | -1) => setViewDate(
        mode === 'years' ? addYears(viewDate, dir * 12)
            : mode === 'months' ? addYears(viewDate, dir)
                : addMonths(viewDate, dir));
    /* Just a button, like the < > nav controls. Plain sm ghost BaseAction —
     * the cascade owns its box (height = --_ctl-h, inset = --_ctl-px, content
     * centred) exactly as it does for the nav buttons. No bleed, no override:
     * the title pills and nav pills are the same primitive, so they read as a
     * set by construction. */
    const seg = (tier: 'months' | 'years', label: string) => (
        <BaseAction type="button" size="sm" variant="ghost" onClick={() => onModeToggle(tier)}>
            <BaseText variant="body" weight="bold" color="heading"
                style={{ textTransform: 'capitalize', ...(mode === tier && { color: 'var(--primary-text, var(--text-main))' }) }}>
                {label}
            </BaseText>
        </BaseAction>
    );
    return (
        <BaseBox display="flex" align="center" justify="between" mb="4">
            <BaseBox display="flex" align="center">
                {seg('months', format(viewDate, 'MMMM'))}
                {seg('years', format(viewDate, 'yyyy'))}
            </BaseBox>
            <BaseBox display="flex" align="center" density="tight">
                <BaseAction type="button" size="sm" iconOnly onClick={() => nav(-1)} style={navBtn}>
                    <BaseIcon icon={ChevronLeft} />
                </BaseAction>
                <BaseAction type="button" size="sm" iconOnly onClick={() => nav(1)} style={navBtn}>
                    <BaseIcon icon={ChevronRight} />
                </BaseAction>
            </BaseBox>
        </BaseBox>
    );
};
