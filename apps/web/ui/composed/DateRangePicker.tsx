import React, { useMemo } from 'react';
import { Calendar } from '../icons/index.js';
import { format, startOfMonth, startOfYear, subDays, subMonths, subYears } from 'date-fns';
import { BaseAction, BaseBox, BaseText, BaseIcon } from '../primitives/index.js';
import { FilterTrigger } from './FilterTrigger.js';
import { DateRangeCalendarSection } from './DateRangeCalendarSection.js';

/* ── DateRangePicker ─────────────────────────────────────
 * Header-cluster pattern: a [Calendar Label v] chip that pops
 * a panel of presets + a custom-range escape hatch (two single
 * <DatePicker>s). Fully controlled — caller owns the value.
 *
 *   <DateRangePicker
 *     value={range}
 *     onChange={setRange}
 *     presets={[...DEFAULT_TIME_PRESETS, ...mySeasonalPresets]}
 *   />
 *
 * Presets are data — each carries a `resolve(now)` that returns
 * `{ start, end }` ISO dates. Adding a preset = one row, no
 * switch statement. Consumers can compose the default set with
 * domain-specific presets (e.g., seasonal segments in Statistics).
 *
 * The picker emits `{ preset, start, end }` so query code can read
 * `start`/`end` directly without re-resolving "what does '30d'
 * mean today?". `preset` is just an identifier for highlighting +
 * round-tripping through URL state. */

export interface DateRangeValue {
    /** Active preset key, or 'custom' when start/end were set manually. */
    preset: string;
    /** ISO yyyy-mm-dd inclusive lower bound. */
    start: string;
    /** ISO yyyy-mm-dd inclusive upper bound. */
    end: string;
}

export interface DateRangePreset {
    key: string;
    label: string;
    resolve: (now: Date) => { start: string; end: string };
}

export interface DateRangePickerProps {
    value: DateRangeValue;
    onChange: (next: DateRangeValue) => void;
    /** Preset list shown in the panel. Defaults to DEFAULT_TIME_PRESETS.
     *  Domain-specific consumers may append (e.g. seasonal segments). */
    presets?: ReadonlyArray<DateRangePreset>;
    /** Panel alignment under the trigger. Default 'right'. */
    align?: 'left' | 'right';
    /** Trigger label override. Default derived from active preset / dates. */
    triggerLabel?: string;
}

const iso = (d: Date): string => format(d, 'yyyy-MM-dd');

export const DEFAULT_TIME_PRESETS: DateRangePreset[] = [
    { key: 'all',  label: 'All time', resolve: (now) => ({ start: '1970-01-01', end: iso(now) }) },
    { key: '1d',   label: 'Today',    resolve: (now) => ({ start: iso(now), end: iso(now) }) },
    { key: '7d',   label: 'Last 7 days',  resolve: (now) => ({ start: iso(subDays(now, 6)),  end: iso(now) }) },
    { key: '30d',  label: 'Last 30 days', resolve: (now) => ({ start: iso(subDays(now, 29)), end: iso(now) }) },
    { key: '90d',  label: 'Last 90 days', resolve: (now) => ({ start: iso(subDays(now, 89)), end: iso(now) }) },
    { key: '6m',   label: 'Last 6 months', resolve: (now) => ({ start: iso(subMonths(now, 6)), end: iso(now) }) },
    { key: '1y',   label: 'Last year',    resolve: (now) => ({ start: iso(subYears(now, 1)),  end: iso(now) }) },
    { key: 'mtd',  label: 'Month to date', resolve: (now) => ({ start: iso(startOfMonth(now)), end: iso(now) }) },
    { key: 'ytd',  label: 'Year to date',  resolve: (now) => ({ start: iso(startOfYear(now)),  end: iso(now) }) },
];

/** Resolve a preset by key against the current clock. Returns null
 *  when the key isn't in the supplied preset list (e.g. 'custom'). */
export function resolvePreset(presets: ReadonlyArray<DateRangePreset>, key: string, now: Date = new Date()): DateRangeValue | null {
    const p = presets.find(x => x.key === key);
    if (!p) return null;
    const { start, end } = p.resolve(now);
    return { preset: key, start, end };
}

export function DateRangePicker({
    value, onChange, presets = DEFAULT_TIME_PRESETS, align = 'right', triggerLabel,
}: DateRangePickerProps) {
    const activeLabel = useMemo(() => {
        if (triggerLabel) return triggerLabel;
        const p = presets.find(x => x.key === value.preset);
        if (p) return p.label;
        return `${value.start} → ${value.end}`;
    }, [presets, value, triggerLabel]);

    const handlePreset = (key: string, close: () => void) => {
        const next = resolvePreset(presets, key);
        if (!next) return;
        onChange(next);
        close();
    };

    return (
        <FilterTrigger
            icon={<BaseIcon icon={Calendar} />}
            label={activeLabel}
            align={align}
        >
            {(close) => (
                <BaseBox
                    bg="var(--bg-card)"
                    border="var(--border-main)"
                    radius="card"
                    shadow="lg"
                    style={{ minWidth: '16rem' }}
                >
                    {/* Presets lay out as a horizontal wrap of pills — the
                      * active one carries a primary-tinted ring instead of a
                      * trailing check glyph. */}
                    <BaseBox display="flex" direction="row" pad="tight" style={{ flexWrap: 'wrap', gap: 'var(--space-1, 0.25rem)' }}>
                        {presets.map(p => {
                            const active = value.preset === p.key;
                            return (
                                <BaseAction
                                    key={p.key}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePreset(p.key, close)}
                                    style={{
                                        borderRadius: 'var(--radius-pill)',
                                        border: active
                                            ? '1px solid color-mix(in srgb, var(--primary) 45%, transparent)'
                                            : '1px solid var(--border-ghost, var(--border-main))',
                                        background: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                                    }}
                                >
                                    <BaseText variant="detail" weight={active ? 'semibold' : undefined} style={{ whiteSpace: 'nowrap' }}>{p.label}</BaseText>
                                </BaseAction>
                            );
                        })}
                    </BaseBox>
                    <BaseBox pad="tight" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        {/* ONE collapsed disclosure → two inline month grids
                          * (start | end). Each pick commits live; the panel
                          * stays open so both ends can be adjusted — clicking
                          * outside closes it. */}
                        <DateRangeCalendarSection
                            value={value}
                            onCommit={(start, end) => onChange({ preset: 'custom', start, end })}
                        />
                    </BaseBox>
                </BaseBox>
            )}
        </FilterTrigger>
    );
}
