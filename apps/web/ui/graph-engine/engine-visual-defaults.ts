/**
 * Per-app VISUAL constants — the few cosmetic values that legitimately
 * differ between hosts (Zincro vs nexus) and therefore must NOT be
 * overwritten by the engine sync. This is the engine sync's ONLY per-app
 * file exclusion (scripts/sync-engine.sh skips it).
 *
 * NEXUS values: SQUARE corners (0/0). Zincro uses rounded (6/3). Every
 * other engine file stays byte-shareable and syncs freely; this file alone
 * carries nexus's cosmetic identity for the pure geometry/chrome layers.
 *
 * Genuinely shared visual identity (glow, iridescence, saturation) lives in
 * `ChartTuning` and is injected at runtime — not here.
 */

/** Bar/column top corner radius (px). nexus: square (0). Zincro: 6. */
export const BAR_TOP_RADIUS_PX = 0;

/** Px of a covering segment's fade-out during which a lower stacked
 *  segment ramps its top radius in. Kept at 1 (matches Zincro). */
export const BAR_RADIUS_REVEAL_PX = 1;

/** Chrome hover-band corner radius (px). nexus: square (0). Zincro: 3. */
export const CHROME_CORNER_RADIUS_PX = 0;
