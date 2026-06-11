/* ── WindowPickerMolecule ────────────────────────────────────
 * The chart's window control, rendered alongside the drill breadcrumb.
 * Two parts in one row:
 *   • named presets (Week · Month · Quarter · Year · All) — a trailing
 *     window to today; replaces the old "1w"-style labels.
 *   • ONE expand glyph → opens the full-month day grid for a custom
 *     start+end range. Collapsed by default; a single toggle, no nested
 *     second expand. Picking a range sets windowDays = span, asOf = end.
 *
 * Both paths emit the same `onWindowChange` the ChartRangeSlider used,
 * so the controller's atomic window fast-path is unchanged.
 * ──────────────────────────────────────────────────────────── */

import React, { useState } from 'react';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { SegmentedPill } from '../composed/SegmentedPill.js';
import { WindowCalendar } from './WindowCalendar.js';
import { WINDOW_PRESETS, CUSTOM_ID, activePresetId, spanDays, rangeLabel } from './window-picker-logic.js';

export interface WindowPickerMoleculeProps {
    windowDays: number | null;
    asOf: string | null;
    /** Timeline bounds for the calendar (earliest record → today). */
    minISO: string;
    maxISO: string;
    onWindowChange: (window: { windowDays: number | null; asOf: string | null }) => void;
    disabled?: boolean;
}

export function WindowPickerMolecule({ windowDays, asOf, minISO, maxISO, onWindowChange, disabled }: WindowPickerMoleculeProps) {
    const [open, setOpen] = useState(false);
    const active = activePresetId(windowDays, asOf);
    const isCustom = active === CUSTOM_ID;

    /* The custom range, when active: derived from windowDays + asOf so the
     *  calendar highlights the live selection and the chip summarizes it. */
    const customRange: [string, string] | null = isCustom && asOf
        ? [isoMinus(asOf, (windowDays ?? 1) - 1), asOf]
        : null;

    const pickPreset = (id: string) => {
        if (id === CUSTOM_ID) { setOpen(o => !o); return; }
        const preset = WINDOW_PRESETS.find(p => p.id === id);
        if (!preset) return;
        setOpen(false);
        onWindowChange({ windowDays: preset.days, asOf: null });
    };

    const pickRange = (start: string, end: string) => {
        setOpen(false);
        onWindowChange({ windowDays: spanDays(start, end), asOf: end });
    };

    /* The "Custom" segment doubles as the expand glyph: its label is the
     *  range summary when one is set, else a calendar affordance. Clicking
     *  it toggles the month grid — the single expand control. */
    const customLabel = customRange ? rangeLabel(customRange[0], customRange[1]) : '◷ Custom';
    const options = [
        ...WINDOW_PRESETS.map(p => ({ value: p.id, label: p.label })),
        { value: CUSTOM_ID, label: customLabel },
    ];

    return (
        <BaseBox style={{ position: 'relative' }}>
            <SegmentedPill
                options={options}
                value={active}
                onChange={pickPreset}
                disabled={disabled}
            />
            {open && (
                <BaseBox style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20 }}>
                    <WindowCalendar minISO={minISO} maxISO={maxISO} range={customRange} onRange={pickRange} />
                    <BaseText variant="detail" style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', paddingLeft: '2px' }}>
                        Pick a start and end day
                    </BaseText>
                </BaseBox>
            )}
        </BaseBox>
    );
}

/** ISO minus N days. */
function isoMinus(iso: string, days: number): string {
    const t = Date.parse(`${iso}T00:00:00Z`) - days * 86_400_000;
    return new Date(t).toISOString().split('T')[0];
}
