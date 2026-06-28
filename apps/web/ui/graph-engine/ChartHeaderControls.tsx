import React from 'react';
import { UnavailableHint } from '../composed/UnavailableHint.js';
import { FilterTrigger } from '../composed/FilterTrigger.js';
import { PopoverTrigger } from '../composed/PopoverTrigger.js';
import { SingleSelectPanel } from '../composed/SingleSelectPanel.js';
import { MultiSelectPanel } from '../composed/MultiSelectPanel.js';
import { DateRangeCalendarView } from '../composed/DateRangeCalendarView.js';
import { BaseBox } from '../primitives/BaseBox.js';
import { CalendarDays } from '../icons/index.js';
import { periodKeyLabel } from './chart-range-window.js';
import type { CoarserPeriod } from './chart-tier-groups.js';
import type { GraphFeature, GraphFeatureKind } from '../../architect/graph-features.types.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';
import type { GraphQuery } from '../../architect/graph-composer.types.js';

/* ── ChartHeaderControls ─────────────────────────────────
 * The two header affordances that used to be pill ROWS, collapsed into
 * popover lists so the chart header stays compact:
 *   - WindowRangeControl: the time-window picker (1w/1mo/1q/…/All), a
 *     SINGLE-select list (was a SegmentedControl pill strip).
 *   - FeatureToggleControl: the trend/mean/smooth overlays, a MULTI-
 *     select checklist (was a pill row).
 * Both reuse the shared FilterTrigger + Single/MultiSelectPanel family,
 * so they speak the same chrome language as every other filter chip.
 * ─────────────────────────────────────────────────────────── */

const FEATURE_LABEL: Record<GraphFeatureKind, string> = {
    trendline: 'Trend',
    movingAverage: 'Smooth',
    threshold: 'Target',
    minMaxMarkers: 'Peaks',
    averageLine: 'Mean',
};

/** Single-select popover for the window-width toggle. The active option's
 *  label rides the trigger; picking one fires `onChange(toggleId, value)`
 *  (same contract the old SegmentedControl drove) and closes.
 *
 *  `emptyValues` are option values whose window resolves to NO data in the
 *  loaded range (computed by ChartBody, which owns the atoms). Those rows
 *  render disabled + "No data" — present but greyed, so the user sees the
 *  range exists yet overshoots the history rather than guessing why a click
 *  did nothing. The currently-selected value is NEVER disabled even if it
 *  overshoots: a forced view must stay visible + switchable. */
/** The "Custom…" footer row beneath the preset ranges — opens a NESTED popover
 *  with the click-click RANGE calendar (DateRangeCalendarView), so a custom
 *  window is a real start+end. Reuses PopoverTrigger (chip skin) + the range
 *  view we built — no new picker. Each completed pick commits live via
 *  `onPickRange(start, end)`; the panel stays open so both ends can be dialed
 *  (the nested-popover registry keeps the parent open while you do). Seeded
 *  from the current window so navigation starts where the chart already is. */
function CustomDateRow({ start, end, max, onPickRange }: {
    start?: string;
    end?: string;
    max?: string;
    onPickRange: (start: string, end: string) => void;
}) {
    const today = new Date().toISOString().split('T')[0];
    const value = { preset: 'custom', start: start ?? end ?? max ?? today, end: end ?? max ?? today };
    return (
        <BaseBox pad="tight" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <PopoverTrigger skin="action" variant="ghost" size="sm" align="right"
                icon={<CalendarDays style={{ width: 14, height: 14 }} />} label="Custom…"
                panel={() => (
                    <BaseBox style={{ width: '248px' }}>
                        <DateRangeCalendarView value={value} max={max} onCommit={onPickRange} />
                    </BaseBox>
                )}
            />
        </BaseBox>
    );
}

export function WindowRangeControl({
    toggle, onChange, emptyValues, onCustomRange, customStart, customEnd, maxDate, customLabel,
}: {
    toggle: ToggleSpec<GraphQuery>;
    onChange: (toggleId: string, value: string) => void;
    /** Option values that exceed the available data span — rendered disabled
     *  + "Beyond data". */
    emptyValues?: ReadonlySet<string>;
    /** When provided, a "Custom…" footer row opens the RANGE calendar; a picked
     *  start+end is handed back here (the host maps it to a window). Omit to
     *  hide the Custom row. */
    onCustomRange?: (start: string, end: string) => void;
    /** Seed for the custom range calendar's initial start/end + view month. */
    customStart?: string;
    customEnd?: string;
    /** Latest selectable day (future days disabled). */
    maxDate?: string;
    /** Trigger label when the active window is NOT one of the presets (a custom
     *  range). e.g. "May 2026" / "Mar 1 – Mar 31". Falls back to the raw value. */
    customLabel?: string;
}) {
    const current = String(toggle.current);
    const preset = toggle.options.find(o => String(o.value) === current);
    const activeLabel = preset?.label ?? customLabel ?? current;
    return (
        <FilterTrigger label={activeLabel} align="right">
            {(close) => (
                <SingleSelectPanel
                    options={toggle.options.map(o => {
                        const value = String(o.value);
                        const overshoots = !!emptyValues?.has(value) && value !== current;
                        return {
                            value, label: o.label,
                            disabled: overshoots,
                            rightAccessory: overshoots
                                ? <UnavailableHint reason="Beyond data" />
                                : undefined,
                        };
                    })}
                    value={current}
                    onChange={(v) => { onChange(toggle.id, v); close(); }}
                    footer={onCustomRange
                        ? <CustomDateRow start={customStart} end={customEnd} max={maxDate} onPickRange={onCustomRange} />
                        : undefined}
                />
            )}
        </FilterTrigger>
    );
}

/** Single-select popover for the granularity (foldUnit / bucket-size)
 *  toggle — Auto / Day / Week / Month / Year. Same shape as the window
 *  range control; kept distinct so the bucket-size picker reads as its
 *  own affordance. The active option's label rides the trigger; the
 *  options are already gated to readable units by the caller. */
export function GranularityControl({
    toggle, onChange,
}: {
    toggle: ToggleSpec<GraphQuery>;
    onChange: (toggleId: string, value: string) => void;
}) {
    const current = String(toggle.current);
    const activeLabel = toggle.options.find(o => String(o.value) === current)?.label ?? current;
    return (
        <FilterTrigger label={activeLabel} align="right">
            {(close) => (
                <SingleSelectPanel
                    options={toggle.options.map(o => ({ value: String(o.value), label: o.label }))}
                    value={current}
                    onChange={(v) => { onChange(toggle.id, v); close(); }}
                />
            )}
        </FilterTrigger>
    );
}

/** Header period picker — REPLACES the stacked month/year tier rows that
 *  used to sit under the x-axis. Lists the coarser periods present in the
 *  current view (e.g. the year(s) behind a day-fold window); picking one
 *  narrows the window to that period via `onWindowChange({ periodKey })`,
 *  the same drill the old tier-label click fired. Hidden when the fold has
 *  no coarser tier (≤1 distinct period — nothing to navigate). */
export function PeriodPickerControl({
    periods, currentPeriodKey, onNarrow,
}: {
    periods: ReadonlyArray<CoarserPeriod>;
    currentPeriodKey?: string;
    onNarrow: (periodKey: string) => void;
}) {
    if (periods.length <= 1) return null;
    const active = currentPeriodKey && periods.some(p => p.periodKey === currentPeriodKey)
        ? currentPeriodKey
        : '';
    const triggerLabel = (active && periodKeyLabel(active)) || periods[0].label;
    return (
        <FilterTrigger label={triggerLabel} align="right">
            {(close) => (
                <SingleSelectPanel
                    options={periods.map(p => ({ value: p.periodKey, label: periodKeyLabel(p.periodKey) ?? p.label }))}
                    value={active}
                    onChange={(v) => { onNarrow(v); close(); }}
                />
            )}
        </FilterTrigger>
    );
}

/** Multi-select popover for chart feature overlays. Dedupes by kind (a
 *  catalog may declare two thresholds; they toggle as one "Target").
 *  Trigger carries the active appearance when any feature is on. */
export function FeatureToggleControl({
    features, activeKinds, onChange,
}: {
    features: ReadonlyArray<GraphFeature>;
    activeKinds: Set<GraphFeatureKind>;
    onChange: (next: Set<GraphFeatureKind>) => void;
}) {
    const seen = new Set<GraphFeatureKind>();
    const options = features
        .filter(f => (seen.has(f.kind) ? false : (seen.add(f.kind), true)))
        .map(f => ({ value: f.kind, label: FEATURE_LABEL[f.kind] }));
    if (options.length === 0) return null;

    const selected = options.map(o => o.value).filter(k => activeKinds.has(k));
    return (
        <FilterTrigger label="Overlays" align="right" badge={selected.length}>
            {() => (
                <MultiSelectPanel
                    options={options}
                    selected={selected}
                    onChange={(next) => onChange(new Set(next as GraphFeatureKind[]))}
                />
            )}
        </FilterTrigger>
    );
}
