/**
 * Fold-transition pairing primitives. `pairBarsForFold` serves the
 * simple-bar family; `pairSegmentsForFold` is the stacked variant
 * (per-series pools). Both pair target marks with prev marks by
 * canonical bucket identity / calendar containment to drive the
 * persistent / split / merge / enter / exit classification in the
 * families' `lerp`. Extracted so the family files stay under the
 * file-length ceiling and the matching logic is testable in isolation.
 */

import type { BarItem } from './animated-cartesian.js';

/** Pair target bars with prev bars by calendar containment. Returns:
 *    - `matched[i]`: prev bar matched to target[i], or `undefined`
 *       when target[i] has no prev counterpart (entering bar).
 *    - `usedPrev`: indices of prev bars that found a target match.
 *       Prev bars NOT in this set are exiting (caller animates them
 *       descending via alphaExit until they're dropped).
 *
 *  Containment is bidirectional so the function works for both fold
 *  directions: a daily target inside a weekly prev (split), or a
 *  weekly target containing a daily prev (merge). When ISO metadata
 *  is absent, falls back to nearest-x spatial matching. */
export function pairBarsForFold(prev: BarItem[], target: BarItem[]): { matched: Array<BarItem | undefined>; usedPrev: Set<number> } {
    const matched: Array<BarItem | undefined> = new Array(target.length);
    const usedPrev = new Set<number>();
    for (let i = 0; i < target.length; i++) {
        const t = target[i];
        let matchIdx = -1;
        let isSplit = false;
        if (t.iso) {
            for (let j = 0; j < prev.length; j++) {
                const p = prev[j];
                if (!p.iso) continue;
                /* Same-iso (no fold change, e.g. slider drag): persistent.
                 *  One-to-one, mark `usedPrev` so this prev isn't reused. */
                if (p.iso === t.iso) {
                    if (usedPrev.has(j)) continue;
                    matchIdx = j; break;
                }
                /* Coarse → fine SPLIT: target.iso falls inside prev's
                 *  [iso, isoEnd). The parent prev becomes the source
                 *  geometry for ALL its target children — multiple
                 *  target bars can claim the same parent. Don't mark
                 *  `usedPrev` so siblings find the same parent. */
                if (p.isoEnd && t.iso >= p.iso && t.iso < p.isoEnd) {
                    matchIdx = j; isSplit = true; break;
                }
                /* Fine → coarse MERGE: prev.iso inside target's range.
                 *  One-to-one (the first prev child claims the parent
                 *  target — others fall through to exiting). */
                if (t.isoEnd && p.iso >= t.iso && p.iso < t.isoEnd) {
                    if (usedPrev.has(j)) continue;
                    matchIdx = j; break;
                }
            }
        }
        if (matchIdx < 0) {
            /* No calendar match — fall back to nearest-x for the
             *  legacy non-atomic case, but ONLY when neither bar has
             *  iso (true non-atomic chart). When the target has an iso
             *  but no prev iso matches, the target is a true entering
             *  bar — leave matched[i] undefined. */
            if (!t.iso) {
                const tcx = t.x + t.w / 2;
                let bestDx = Infinity;
                for (let j = 0; j < prev.length; j++) {
                    if (usedPrev.has(j)) continue;
                    const p = prev[j];
                    const pcx = p.x + p.w / 2;
                    const dx = Math.abs(pcx - tcx);
                    if (dx < bestDx) { bestDx = dx; matchIdx = j; }
                }
            }
        }
        if (matchIdx >= 0) {
            matched[i] = prev[matchIdx];
            /* SPLIT (coarse→fine, parent into many children): don't
             *  mark used so siblings reuse the parent's geometry as
             *  their starting position. NON-split (persistent, merge,
             *  spatial fallback): one-to-one match, mark used. */
            if (!isSplit) usedPrev.add(matchIdx);
        }
    }
    return { matched, usedPrev };
}

/** Minimal identity a stacked segment needs for fold pairing. */
export interface FoldPairable {
    seriesId: string;
    iso: string;
    isoEnd: string;
    bucketKey: string;
}

/** Stacked-bar variant of `pairBarsForFold` — pairs by series identity
 *  AND bucket identity (bucketKey first, iso containment as the
 *  fold-change fallback) so each series-stripe stages independently.
 *  Returns matched-prev refs plus the set of prev indices that found a
 *  match; unmatched prev = exiting. */
export function pairSegmentsForFold<T extends FoldPairable>(
    prev: T[], target: T[],
): { matched: Array<T | undefined>; usedPrev: Set<number> } {
    const matched: Array<T | undefined> = new Array(target.length);
    const usedPrev = new Set<number>();
    /* Index prev by series for O(target * prevInSeries) instead of
     *  O(n²) full scans. Stacked charts can run wide. Indices refer
     *  back to the original `prev` array via `idx`. */
    const prevBySeries = new Map<string, Array<{ seg: T; idx: number }>>();
    for (let j = 0; j < prev.length; j++) {
        const p = prev[j];
        const arr = prevBySeries.get(p.seriesId);
        if (arr) arr.push({ seg: p, idx: j });
        else prevBySeries.set(p.seriesId, [{ seg: p, idx: j }]);
    }
    for (let i = 0; i < target.length; i++) {
        const t = target[i];
        const pool = prevBySeries.get(t.seriesId) ?? [];
        let matchIdx = -1;
        /* Canonical bucket identity first — same fold ⇒ same bucketKey,
         *  exact and cheap (mirrors `pairBarsForFold`). The iso
         *  containment tests below handle fold CHANGES (day→month split/
         *  merge), where keys differ but ranges nest. */
        if (t.bucketKey) {
            for (const { seg: p, idx: j } of pool) {
                if (!usedPrev.has(j) && p.bucketKey === t.bucketKey) { matchIdx = j; break; }
            }
        }
        if (matchIdx < 0 && t.iso) {
            for (const { seg: p, idx: j } of pool) {
                if (usedPrev.has(j) || !p.iso) continue;
                if (p.isoEnd && t.iso >= p.iso && t.iso < p.isoEnd) { matchIdx = j; break; }
                if (t.isoEnd && p.iso >= t.iso && p.iso < t.isoEnd) { matchIdx = j; break; }
                if (p.iso === t.iso) { matchIdx = j; break; }
            }
        }
        if (matchIdx >= 0) {
            matched[i] = prev[matchIdx];
            usedPrev.add(matchIdx);
        }
    }
    return { matched, usedPrev };
}
