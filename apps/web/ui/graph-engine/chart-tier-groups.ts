/**
 * Tier-group machinery for cartesian X-axis chrome. Each tier row
 * groups adjacent base buckets that share a coarser-calendar identity
 * (e.g. all days in May 2026) and emits one centered label per group.
 * Extracted from `chart-primitives-cartesian.ts` so the layout/chrome
 * file stays focused.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import { weekOfMonth } from '../../architect/fold-atoms-calendar.js';
import type { CartesianLayout } from './chart-primitives-cartesian.js';

export type TierUnit = 'week' | 'month' | 'quarter' | 'year';

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
            const tk = tierKeyAndLabel(iso, tier, chart.__foldUnit);
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
    if (unit === 'day') return ['week', 'month', 'year'];
    if (unit === 'week') return ['month', 'year'];
    if (unit === 'month') return ['quarter', 'year'];
    if (unit === 'quarter') return ['year'];
    return [];
}

const TIER_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** A tier label's "parent period" — the next-coarser unit the label
 *  belongs to. Used by the decimator's anchor detection. Returns `null`
 *  for the year tier. */
export function parentPeriodKey(tierKey: string, tier: TierUnit): string | null {
    if (tier === 'week') return tierKey.slice(0, 7);
    if (tier === 'month') return tierKey.slice(0, 4);
    if (tier === 'quarter') return tierKey.slice(0, 4);
    return null;
}

function tierKeyAndLabel(iso: string, tier: TierUnit, baseUnit: GraphDirective['__foldUnit']): { key: string; label: string } | null {
    if (!iso || iso.length < 10) return null;
    const yyyy = iso.slice(0, 4);
    const mm = iso.slice(5, 7);
    const dd = iso.slice(8, 10);
    /* Owner-date projection: week-base buckets are owned by the month
     *  containing their Thursday (ISO convention). */
    let ownerY = parseInt(yyyy, 10);
    let ownerM = parseInt(mm, 10) - 1;
    if (baseUnit === 'week') {
        const monday = new Date(Date.UTC(ownerY, ownerM, parseInt(dd, 10)));
        const thursday = new Date(monday);
        thursday.setUTCDate(monday.getUTCDate() + 3);
        ownerY = thursday.getUTCFullYear();
        ownerM = thursday.getUTCMonth();
    }
    if (tier === 'year') return { key: String(ownerY), label: String(ownerY) };
    if (!Number.isFinite(ownerM) || ownerM < 0 || ownerM > 11) return null;
    if (tier === 'month') return { key: `${ownerY}-${String(ownerM + 1).padStart(2, '0')}`, label: TIER_MONTHS[ownerM] };
    if (tier === 'quarter') {
        const q = Math.floor(ownerM / 3) + 1;
        return { key: `${ownerY}-Q${q}`, label: `Q${q}` };
    }
    const monthIdx = parseInt(mm, 10) - 1;
    if (!Number.isFinite(monthIdx) || monthIdx < 0 || monthIdx > 11) return null;
    const day = parseInt(dd, 10);
    if (!Number.isFinite(day)) return null;
    const d = new Date(Date.UTC(parseInt(yyyy, 10), monthIdx, day));
    const dow = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - dow);
    const thursday = new Date(monday);
    thursday.setUTCDate(monday.getUTCDate() + 3);
    const ownerMonth = thursday.getUTCMonth();
    const ownerYear = thursday.getUTCFullYear();
    const wOfMonth = weekOfMonth(monday);
    const key = `${ownerYear}-${String(ownerMonth + 1).padStart(2, '0')}-W${wOfMonth}`;
    return { key, label: `W${wOfMonth}` };
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
        const tk = iso ? tierKeyAndLabel(iso, tier, chart.__foldUnit) : null;
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
