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
    /** Ancestor levels — each clickable to jump back to that view. */
    crumbs: { label: string }[];
    /** The current (deepest) level's label — rendered as a non-clickable tail. */
    current: string;
    /** Jump to crumb `index` (restore that level's view). */
    onJump: (index: number) => void;
}

const CRUMB: React.CSSProperties = { fontSize: '10px', color: 'var(--accent)', cursor: 'pointer' };
const SEP: React.CSSProperties = { fontSize: '10px', color: 'var(--text-subtle, var(--text-muted))', margin: '0 var(--space-1, 0.25rem)' };
const CUR: React.CSSProperties = { fontSize: '10px', color: 'var(--text-main)', fontWeight: 600 };

/* The breadcrumb IS the time-navigation (the fold-level toggle was removed):
 * the path `All › 2010s › 2015 › Mar 2015` shows where you are, each ancestor
 * is clickable to jump back to that level, and clicking a bar drills deeper. */
export function DrillBreadcrumbChip({ crumbs, current, onJump }: DrillBreadcrumbChipProps) {
    if (crumbs.length === 0) return null;
    return (
        <BaseBox display="flex" direction="row" align="center" density="tight" style={{ flexWrap: 'wrap' }}>
            {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                    <BaseAction onClick={() => onJump(i)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                        <BaseText variant="detail" style={CRUMB}>{c.label}</BaseText>
                    </BaseAction>
                    <BaseText variant="detail" style={SEP}>›</BaseText>
                </React.Fragment>
            ))}
            <BaseText variant="detail" style={CUR}>{current}</BaseText>
        </BaseBox>
    );
}
