/**
 * Coarser-period machinery for the cartesian X-axis. The stacked tier
 * ROWS (month/year strips under the base labels) were removed — they
 * repeated "Jan"/"2026" across every column. The base band now shows
 * only the smallest bucket; the coarser period is chosen from the header
 * period picker (ChartBody), powered by `coarserPeriods` below.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';

export type TierUnit = 'month' | 'year';

/** Coarser X-axis tiers available beneath the base labels, given the
 *  resolved fold unit. Drives which coarser period the header picker
 *  offers (its COARSEST entry). */
export function coarserTiersFor(unit: GraphDirective['__foldUnit']): TierUnit[] {
    if (unit === 'day') return ['month', 'year'];
    if (unit === 'month') return ['year'];
    return [];
}

const TIER_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function tierKeyAndLabel(iso: string, tier: TierUnit): { key: string; label: string } | null {
    if (!iso || iso.length < 10) return null;
    const yyyy = iso.slice(0, 4);
    const mm = iso.slice(5, 7);
    const ownerY = parseInt(yyyy, 10);
    const ownerM = parseInt(mm, 10) - 1;
    if (tier === 'year') return { key: String(ownerY), label: String(ownerY) };
    if (!Number.isFinite(ownerM) || ownerM < 0 || ownerM > 11) return null;
    return { key: `${ownerY}-${String(ownerM + 1).padStart(2, '0')}`, label: TIER_MONTHS[ownerM] };
}

/** One selectable coarser period present in the current view — the data
 *  behind the header period picker that REPLACED the stacked tier rows.
 *  `periodKey` follows the drill grammar (`2026`, `2026-03`) so a pick
 *  narrows via `onWindowChange({ periodKey })`, the same identity a tier-
 *  label click used to carry. */
export interface CoarserPeriod {
    periodKey: string;
    label: string;
}

/** The COARSEST coarser-tier's distinct periods across the visible
 *  buckets, in view order — e.g. days→['2026'] (the year), months→the
 *  years present. Pixel-free (no layout needed): the header picker is a
 *  list, not an axis row. Empty when the fold has no coarser tier (the
 *  base labels are already the coarsest) or the data carries no calendar
 *  metadata. */
export function coarserPeriods(chart: GraphDirective): CoarserPeriod[] {
    const tiers = coarserTiersFor(chart.__foldUnit);
    if (tiers.length === 0) return [];
    const coarsest = tiers[tiers.length - 1];          // 'year' for day/month folds
    const data = chart.data as Array<{ __startISO?: string }>;
    const out: CoarserPeriod[] = [];
    const seen = new Set<string>();
    for (const d of data) {
        const iso = d?.__startISO;
        if (typeof iso !== 'string') continue;
        const tk = tierKeyAndLabel(iso, coarsest);
        if (!tk || seen.has(tk.key)) continue;
        seen.add(tk.key);
        out.push({ periodKey: tk.key, label: tk.label });
    }
    return out;
}
