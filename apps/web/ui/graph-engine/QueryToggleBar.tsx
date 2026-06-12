import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { SegmentedControl } from '../composed/SegmentedControl.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';

/* ── QueryToggleBar ──────────────────────────────────────────
 * Segmented pills for query toggles whose UX is "pick one of these
 * named categories" — e.g. `scope: today / week / month`. Each toggle
 * renders as a SegmentedControl pill — the SAME molecule + variant as
 * the calendar's D/W/M/Y switcher, so chart chrome and calendar chrome
 * speak one visual language.
 *
 * Window-width toggles (`windowDays`) are NOT rendered here. They
 * have a real continuous axis (the timeline), so `<GraphRender>`
 * extracts them and renders a `<ChartRangeSlider>` below the chart.
 * ──────────────────────────────────────────────────────────── */

export function QueryToggleBar({
    toggles,
    isLoading,
    error,
    onChange,
}: {
    toggles: ToggleSpec[];
    isLoading: boolean;
    error?: string | null;
    onChange: (toggleId: string, value: string) => void;
}) {
    if (!toggles || toggles.length === 0) return null;
    return (
        <BaseBox display="flex" direction="row" density="tight" align="center" justify="end" style={{ flexWrap: 'wrap', opacity: isLoading ? 0.55 : 1, transition: 'opacity 180ms ease' }}>
            {error && (
                <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, color: 'var(--status-error, #ef4444)', textTransform: 'uppercase', letterSpacing: '0.04em' }} title={error}>
                    refresh failed
                </BaseText>
            )}
            {toggles.map(t => (
                /* No layoutId: the per-instance default keeps indicators
                 *  from flying between pills across charts on one page.
                 *  `isLoading` is a visual hint only — clicks still go
                 *  through. The controller's streamKey dedupes in-flight
                 *  requests; the latest value wins. */
                <SegmentedControl
                    key={t.id}
                    variant="pill"
                    segments={t.options.map(o => ({ value: String(o.value), label: o.label }))}
                    value={String(t.current)}
                    onChange={(next) => onChange(t.id, next)}
                />
            ))}
        </BaseBox>
    );
}
