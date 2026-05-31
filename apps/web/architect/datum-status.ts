/* ── Datum Status (semantic) ─────────────────────────────────
 * "What the data IS" — set by the Composer/Governor (or a human for
 * ad-hoc styling), carried on each `Atom`, folded into buckets. The
 * graph engine owns the status→style mapping (`ui/graph-engine/
 * datum-status-style.ts`); this file is pure data, no pixels.
 *
 * Lives in `architect/` (the data foundation) so the fold
 * (`bucketAggregates`, `foldByCalendar`) can aggregate status without
 * importing anything from the UI layer.
 * ──────────────────────────────────────────────────────────── */

/** Semantic status of a datum. Absent ⇒ 'observed'.
 *   observed  — real/complete/confirmed → solid, filled marker
 *   projected — forecast / future bucket → dashed, no marker
 *   partial   — current period still filling → dashed, hollow marker
 *   estimated — modeled/inferred, not confirmed → solid, hollow marker */
export type DatumStatus = 'observed' | 'projected' | 'partial' | 'estimated';

/* Severity ladder — higher = less-confident. Folding takes the MAX so a
 * single projected atom in a folded bucket makes the whole bucket
 * projected. Associative + order-independent, so fold order never
 * matters. */
const STATUS_SEVERITY: Record<DatumStatus, number> = {
    observed: 0, estimated: 1, partial: 2, projected: 3,
};

/** Merge two statuses for folding: the less-confident (higher-severity)
 *  one wins. */
export function mergeStatus(a: DatumStatus, b: DatumStatus): DatumStatus {
    return STATUS_SEVERITY[b] > STATUS_SEVERITY[a] ? b : a;
}

/** Fold `status` + `defined` across a half-open atom range `[start,end)`:
 *  any projected ⇒ projected (via mergeStatus); any defined ⇒ defined.
 *  Shared by `foldByCalendar` (synthesize) and `bucketAggregates`. */
export function foldStatusDefined(
    atoms: ReadonlyArray<{ status?: DatumStatus; defined?: boolean }>,
    start: number,
    end: number,
): { status: DatumStatus; defined: boolean } {
    let status: DatumStatus = atoms[start]?.status ?? 'observed';
    let defined = atoms[start]?.defined !== false;
    for (let i = start + 1; i < end; i++) {
        status = mergeStatus(status, atoms[i].status ?? 'observed');
        defined = defined || atoms[i].defined !== false;
    }
    return { status, defined };
}
