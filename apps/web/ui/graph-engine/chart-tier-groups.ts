/**
 * Tier-group machinery for cartesian X-axis chrome. Each tier row
 * groups adjacent base buckets that share a coarser-calendar identity
 * (e.g. all days in May 2026) and emits one centered label per group.
 * Extracted from `chart-primitives-cartesian.ts` so the layout/chrome
 * file stays focused.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';

export type TierUnit = 'month' | 'year';

/** A horizontal run of adjacent base buckets that share the same
 *  coarser-tier identity. `centerX` is the pixel-x where the label
 *  renders; `startX` is the run's left boundary in pixels — used to
 *  render a tick divider between adjacent groups. */
export interface TierGroup {
    label: string;
    key: string;
    centerX: number;
    startX: number;
    endX: number;
}

/** Count the tier rows that will actually render groups for the chart's
 *  visible data. A tier in `coarserTiersFor(unit)` is "active" only when
 *  the visible iso range produces ≥1 unique key at that unit — e.g. a
 *  single-month window at day fold has no year transitions, so the
 *  'year' tier emits zero groups and shouldn't reserve a label row.
 *
 *  Foundation use: `buildCartesianLayout` calls this BEFORE allocating
 *  `margin.bottom` so the reserved strip matches the actual ink. Pre-
 *  layout (no pixel math needed) — only reads `__startISO` from each
 *  visible bucket plus the resolved fold unit. */
export function activeTierCount(chart: GraphDirective): number {
    const data = chart.data as Array<{ __startISO?: string }>;
    if (!data || data.length === 0) return 0;
    const tiers = coarserTiersFor(chart.__foldUnit);
    let active = 0;
    for (const tier of tiers) {
        const seen = new Set<string>();
        for (const d of data) {
            const iso = d?.__startISO;
            if (typeof iso !== 'string') continue;
            const tk = tierKeyAndLabel(iso, tier);
            if (tk) seen.add(tk.key);
            if (seen.size >= 1) break;
        }
        if (seen.size >= 1) active++;
    }
    return active;
}

/** Coarser X-axis tiers to stack beneath the base labels, given the
 *  resolved fold unit. */
export function coarserTiersFor(unit: GraphDirective['__foldUnit']): TierUnit[] {
    // The FoldUnit ladder dropped week + quarter (hour<day<month<year<decade<
    // century), so the tier rows above the bars must not group by them either:
    // a day fold tiers up by MONTH (not week), a month fold by YEAR (not
    // quarter). Leaving week/quarter here re-introduced W1/Q1 labels the ladder
    // no longer has. The week/quarter base-unit branches are unreachable now.
    if (unit === 'day') return ['month', 'year'];
    if (unit === 'month') return ['year'];
    return [];
}

const TIER_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** A tier label's "parent period" — the next-coarser unit the label
 *  belongs to. Used by the decimator's anchor detection. Returns `null`
 *  for the year tier. */
export function parentPeriodKey(tierKey: string, tier: TierUnit): string | null {
    if (tier === 'month') return tierKey.slice(0, 4);
    return null;
}

function tierKeyAndLabel(iso: string, tier: TierUnit): { key: string; label: string } | null {
    if (!iso || iso.length < 10) return null;
    const yyyy = iso.slice(0, 4);
    const mm = iso.slice(5, 7);
    const ownerY = parseInt(yyyy, 10);
    const ownerM = parseInt(mm, 10) - 1;
    if (tier === 'year') return { key: String(ownerY), label: String(ownerY) };
    if (!Number.isFinite(ownerM) || ownerM < 0 || ownerM > 11) return null;
    // Only month + year tiers remain (week + quarter dropped from the ladder).
    return { key: `${ownerY}-${String(ownerM + 1).padStart(2, '0')}`, label: TIER_MONTHS[ownerM] };
}

/** Walk visible data buckets, group adjacent ones sharing the same
 *  tier key, and emit one centered label per group. */
export function groupByTier(chart: GraphDirective, layout: CartesianLayout, tier: TierUnit): TierGroup[] {
    const data = chart.data as any[];
    if (data.length === 0) return [];
    const plotW = layout.xR[1] - layout.xR[0];
    const leftEdgeOf = (i: number): number => {
        const d = data[i];
        if (typeof d?.__xStart === 'number') {
            return layout.xR[0] + Math.max(0, Math.min(1, d.__xStart)) * plotW;
        }
        const pos = layout.positionAt(i);
        return pos.x;
    };
    const rightEdgeOf = (i: number): number => {
        const d = data[i];
        if (typeof d?.__xEnd === 'number') {
            return layout.xR[0] + Math.max(0, Math.min(1, d.__xEnd)) * plotW;
        }
        const pos = layout.positionAt(i);
        return pos.x + pos.width;
    };
    const groups: TierGroup[] = [];
    let runStart = -1;
    let runKey: string | null = null;
    let runLabel = '';
    const flush = (endExclusive: number) => {
        if (runStart < 0 || runKey === null) return;
        const left = leftEdgeOf(runStart);
        const right = rightEdgeOf(endExclusive - 1);
        let cx = (left + right) / 2;
        cx = Math.max(layout.xR[0], Math.min(layout.xR[1], cx));
        const startX = Math.max(layout.xR[0], Math.min(layout.xR[1], left));
        const endX = Math.max(layout.xR[0], Math.min(layout.xR[1], right));
        groups.push({ label: runLabel, key: runKey, centerX: cx, startX, endX });
    };
    for (let i = 0; i < data.length; i++) {
        const iso = data[i]?.__startISO as string | undefined;
        const tk = iso ? tierKeyAndLabel(iso, tier) : null;
        if (!tk) {
            flush(i);
            runStart = -1;
            runKey = null;
            continue;
        }
        if (tk.key !== runKey) {
            flush(i);
            runStart = i;
            runKey = tk.key;
            runLabel = tk.label;
        }
    }
    flush(data.length);
    return groups;
}
