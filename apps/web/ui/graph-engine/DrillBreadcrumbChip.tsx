/**
 * Drill-back chip rendered inside a chart's title row when the chart
 * has been drilled into a sub-window. Sits next to the title as a peer
 * of the toggle pills + LiveBadge — adding it does NOT change the
 * chart's vertical footprint (no new row, no expanded card).
 *
 * Lifted from `OverviewPage.tsx` where it was a sibling element above
 * GraphRender; that placement pushed the entire chart segment down
 * whenever you drilled. The chart is the right owner of drill chrome.
 */

import React from 'react';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';

export interface DrillBreadcrumbChipProps {
    crumbs: { label: string }[];
    onUp: () => void;
}

export function DrillBreadcrumbChip({ crumbs, onUp }: DrillBreadcrumbChipProps) {
    if (crumbs.length === 0) return null;
    const trail = crumbs.map(c => c.label).join(' › ');
    return (
        <BaseBox display="flex" direction="row" align="center" density="tight" style={{ flexWrap: 'nowrap' }}>
            <BaseAction onClick={onUp} style={{
                padding: 'var(--space-0-5, 0.125rem) var(--space-2, 0.5rem)',
                borderRadius: 'var(--radius-full, 999px)',
                border: '1px solid var(--border-ghost, var(--border-main))',
                background: 'transparent',
                cursor: 'pointer',
            }}>
                <BaseText variant="detail" style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ← Back
                </BaseText>
            </BaseAction>
            <BaseText variant="detail" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {trail}
            </BaseText>
        </BaseBox>
    );
}
