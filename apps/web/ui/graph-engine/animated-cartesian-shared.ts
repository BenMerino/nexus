/**
 * Shared visual constants and per-bar timing helpers used by both the
 * simple-bar (`animated-cartesian.ts`) and stacked-bar
 * (`animated-cartesian-stacked.ts`) families. Extracted so each family
 * file stays focused on its own sample/lerp/primitives and the visual
 * vocabulary (corner radius, per-bar staggering) is defined in exactly
 * one place.
 */

import { easeOutCubic } from '../primitives/tween.js';

/** Corner radius for bar tops. Bars grow up from the axis baseline so
 *  the bottom edge sits on the axis and stays flat. Stacked bars round
 *  the *visible* top edge — the topmost active segment carries the full
 *  radius; segments below ramp their radius in only during the final
 *  `BAR_RADIUS_REVEAL_PX` of the covering segment's fade-out, so the
 *  rounded corner appears only after the segment above is visually
 *  gone (sub-pixel) instead of growing in alongside it. */
/* Re-exported from `engine-visual-defaults` — the per-app visual seam.
 *  Kept exported here so existing geometry-layer imports are unchanged;
 *  the actual value lives in the one file the engine sync excludes. */
export { BAR_TOP_RADIUS_PX, BAR_RADIUS_REVEAL_PX } from './engine-visual-defaults.js';

/** How much of the total animation duration each entering/exiting bar
 *  occupies. `GROW_SPAN = 0.6` means each bar's appearance/disappearance
 *  spans 60% of the total animation. The remaining 40% is distributed
 *  as start-offsets across the bars (chronological rank → offset), so
 *  bars cascade left-to-right within the same total 280ms window. */
export const PER_BAR_GROW_SPAN = 0.6;
export const PER_BAR_START_SPREAD = 1 - PER_BAR_GROW_SPAN;

/** Per-bar eased alpha for an independent mathematical event. Each
 *  entering or exiting bar has its own clock offset proportional to
 *  its chronological rank; same `tRaw` produces a cascade across N
 *  bars rather than synchronized motion. With N=1 the bar uses the
 *  full duration; with N>1 they stagger. Pure. */
export function perBarAlpha(tRaw: number, rank: number, total: number): number {
    if (total <= 1) return easeOutCubic(tRaw);
    const offset = (rank / (total - 1)) * PER_BAR_START_SPREAD;
    const local = (tRaw - offset) / PER_BAR_GROW_SPAN;
    return easeOutCubic(Math.max(0, Math.min(1, local)));
}
