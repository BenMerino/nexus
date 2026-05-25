import React from 'react';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';
import { SegmentedPill } from '../composed/SegmentedPill.js';
import type { ToggleSpec } from '../../architect/replayable-directive.js';

/* ── QueryToggleBar ──────────────────────────────────────────
 * Segmented pills for query toggles whose UX is "pick one of these
 * named categories" — e.g. `scope: today / week / month`. Each toggle
 * renders as a SegmentedPill: a single rounded shell with a sliding
 * indicator that translates to the active segment.
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
                <SegmentedPill
                    key={t.id}
                    options={t.options.map(o => ({ value: String(o.value), label: o.label }))}
                    value={String(t.current)}
                    /* `isLoading` is a visual hint only — clicks still go
                     *  through. The controller's streamKey dedupes
                     *  in-flight requests; the latest value wins. */
                    disabled={false}
                    onChange={(next) => onChange(t.id, next)}
                />
            ))}
        </BaseBox>
    );
}
