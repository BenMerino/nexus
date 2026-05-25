/* ── Atom Placement ─────────────────────────────────────────
 * The single mathematical primitive that maps atoms to render-
 * space coordinates. Every chart family reads its input from
 * this function — bars, areas, lines, heatmaps all draw the
 * same atoms, differing only in how they interpret the
 * placement (stack y vs. point at y, etc.).
 *
 * Foundation invariant: atoms are immutable, primary, conserved
 * across every projection. The fold unit changes how atoms are
 * distributed in x-space; it never changes their y-values, it
 * never destroys them, it never creates new ones. Two projections
 * (week-fold and day-fold) of the same atom stream contain the
 * SAME atoms — they just sit at different x-positions.
 *
 * Continuity invariant: `placeAtoms(atoms, foldUnit=week)` and
 * `placeAtoms(atoms, foldUnit=day)` are endpoints of a continuous
 * interpolation. The animation engine tweens between them by
 * lerping each atom's (xStart, xEnd, yBase) toward its target
 * configuration — same atoms, sliding in x-space.
 *
 * Pure. No React, no DOM, no side effects.
 * ──────────────────────────────────────────────────────────── */

import { alignToUnitStart, stepByUnit } from './fold-atoms-calendar.js';
import { HOURS_PER_DAY, type Atom, type FoldUnit } from './fold-atoms.js';

/** Per-atom placement in normalized window coordinates. `xStart`/`xEnd`
 *  ∈ [0, 1] across the visible window (or outside when the atom's
 *  bucket extends past the window edge). `yBase` is the atom's
 *  stacking offset — for atoms sharing the same x-slot (coarse fold),
 *  later atoms stack atop earlier ones; for fine-resolution folds
 *  where each atom owns its slot, yBase is 0.
 *
 *  `bucketKey` identifies which fold envelope the atom belongs to —
 *  used by chrome to group atoms under axis labels. Same projection
 *  ⇒ same bucketKey ⇒ atoms render under the same label. */
export interface AtomPlacement {
    xStart: number;
    xEnd: number;
    yBase: number;
    bucketKey: string;
}

export interface PlaceAtomsOptions {
    foldUnit: Exclude<FoldUnit, 'auto'>;
    /** Atom-key (hour-resolution) coordinates of the visible window's
     *  left and right edges. Real-valued — fractional drag positions
     *  produce continuous geometry. */
    windowStartKey: number;
    windowEndKey: number;
    /** Optional: ISO date of the atom-key anchor (first atom's iso).
     *  Used to map atom-keys back to dates for bucket-boundary math.
     *  When absent, atoms are treated as ordinal (no calendar fold). */
    anchorISO?: string;
}

const HOUR_MS = 3_600_000;

/** Project an atom stream onto window-normalized geometry. Each atom
 *  gets `(xStart, xEnd, yBase, bucketKey)`; the renderer reads these
 *  and draws one primitive per atom.
 *
 *  Stacking: atoms that share a `bucketKey` (i.e. fall in the same
 *  fold envelope) stack y-wise in atom-key order. The first atom in
 *  a bucket has `yBase=0`; each subsequent atom's yBase is the sum
 *  of earlier atoms' values in the same bucket. Atoms in different
 *  buckets are independent — yBase resets per bucket. */
export function placeAtoms(atoms: ReadonlyArray<Atom>, opts: PlaceAtomsOptions): AtomPlacement[] {
    if (atoms.length === 0) return [];
    const { foldUnit, windowStartKey, windowEndKey, anchorISO } = opts;
    /* Window spans `windowStartKey` through `windowEndKey` inclusive in
     *  atom-key (hour) space. An atom at key K occupies the hour-slot
     *  `[K, K+1)`, so the visible span is `windowEndKey + 1 - windowStartKey`
     *  hour-slots total. xStart=0 maps to windowStartKey; xEnd=1 maps
     *  to windowEndKey + 1. */
    const winSpan = (windowEndKey + 1 - windowStartKey) || 1;

    /* No ISO anchor → ordinal placement. Each atom gets its own slot;
     *  no calendar bucketing. Used by non-time-series atoms (rare). */
    if (!anchorISO) {
        return atoms.map((a, i) => {
            const xStart = (a.key - windowStartKey) / winSpan;
            const xEnd = (a.key + 1 - windowStartKey) / winSpan;
            return { xStart, xEnd, yBase: 0, bucketKey: `ord-${i}` };
        });
    }

    /* Calendar fold: walk bucket boundaries; for each atom find its
     *  containing bucket; emit `(xStart, xEnd)` as the bucket envelope
     *  in window-normalized space. Atoms in the same bucket share
     *  envelope coordinates AND stack y-wise. */
    const anchorMs = Date.parse(`${anchorISO}T00:00:00Z`);
    const anchorD = new Date(anchorMs);
    const out: AtomPlacement[] = new Array(atoms.length);

    /* Build bucket boundaries that cover the atom stream. A bucket is
     *  identified by its `startKey` (atom-key at its start). For each
     *  atom we find its containing bucket and compute the bucket's
     *  envelope once. */
    const bucketCache = new Map<number, { startKey: number; endKey: number; key: string }>();
    const bucketFor = (atomKey: number): { startKey: number; endKey: number; key: string } => {
        /* Convert atomKey (hours from anchor) to a Date, snap to fold-unit
         *  start, compute bucket envelope. */
        const atomMs = anchorMs + atomKey * HOUR_MS;
        const atomD = new Date(atomMs);
        const bucketStartD = alignToUnitStart(atomD, foldUnit);
        const bucketStartKey = Math.round((bucketStartD.getTime() - anchorMs) / HOUR_MS);
        const cached = bucketCache.get(bucketStartKey);
        if (cached) return cached;
        const bucketEndD = stepByUnit(new Date(bucketStartD), foldUnit);
        const bucketEndKey = Math.round((bucketEndD.getTime() - anchorMs) / HOUR_MS) - 1;
        const isoStart = bucketStartD.toISOString().split('T')[0];
        const bucket = {
            startKey: bucketStartKey,
            endKey: bucketEndKey,
            key: `${foldUnit}-${isoStart}`,
        };
        bucketCache.set(bucketStartKey, bucket);
        return bucket;
    };

    /* First pass: assign each atom its bucket. */
    const atomBuckets: Array<{ startKey: number; endKey: number; key: string }> = atoms.map(a => bucketFor(a.key));

    /* Second pass: compute per-bucket cumulative y so atoms sharing a
     *  bucket stack chronologically. Atoms within a bucket are summed
     *  in `key` order — earliest at the bottom (yBase=0), latest on
     *  top. */
    const cumYBy = new Map<string, number>();

    /* Atoms must be processed in key-ascending order for stacking to
     *  be chronological. Build an index array sorted by key, populate
     *  output in original index space. */
    const order = atoms.map((_, i) => i).sort((a, b) => atoms[a].key - atoms[b].key);
    for (const i of order) {
        const a = atoms[i];
        const b = atomBuckets[i];
        const yBase = cumYBy.get(b.key) ?? 0;
        cumYBy.set(b.key, yBase + a.value);
        const xStart = (b.startKey - windowStartKey) / winSpan;
        const xEnd = (b.endKey + 1 - windowStartKey) / winSpan;
        out[i] = { xStart, xEnd, yBase, bucketKey: b.key };
    }
    return out;
}

/** Inverse helper: total y at a given normalized x position. The sum
 *  of `atom.value` for every atom whose `[xStart, xEnd]` contains x.
 *  Used by line/area families to compute the "top of stack" curve. */
export function massAtX(atoms: ReadonlyArray<Atom>, placements: ReadonlyArray<AtomPlacement>, x: number): number {
    let mass = 0;
    for (let i = 0; i < atoms.length; i++) {
        const p = placements[i];
        if (x >= p.xStart && x < p.xEnd) mass += atoms[i].value;
    }
    return mass;
}

/** Total mass across all atoms. Used for y-domain calculations:
 *  at coarse fold the per-bucket max equals the bucket's stack-top. */
export function totalMass(atoms: ReadonlyArray<Atom>): number {
    let s = 0;
    for (const a of atoms) s += a.value;
    return s;
}

/** Per-bucket stack-top, keyed by bucketKey. Used by y-domain
 *  calculation to find the visible maximum: at coarse fold the tallest
 *  visible value is the largest per-bucket sum, not the largest atom.
 *
 *  `seriesKeys` is the chart's `series` array. When non-empty, each
 *  atom contributes Σ_series(atom[seriesKey]) — the true stack height
 *  for stacked-bar / stacked-area. When empty (or omitted), atoms
 *  contribute `atom.value` — the legacy single-series behaviour.
 *
 *  Why this matters: a stacked-area with series ['Revenue','Collected']
 *  builds its visible y from Revenue+Collected per bucket. If yMax is
 *  derived from `atom.value` alone (which by convention equals just
 *  one of the series, usually the first), the chart's y-axis is too
 *  short and the stack overflows. The overflow gets worse as the fold
 *  coarsens because Σ over more atoms diverges further from the
 *  underestimate. */
export function bucketTops(
    atoms: ReadonlyArray<Atom>,
    placements: ReadonlyArray<AtomPlacement>,
    seriesKeys: ReadonlyArray<string> = [],
): Map<string, number> {
    const tops = new Map<string, number>();
    const useSeries = seriesKeys.length > 0;
    for (let i = 0; i < atoms.length; i++) {
        const p = placements[i];
        const a = atoms[i];
        let contribution = 0;
        if (useSeries) {
            for (const k of seriesKeys) {
                const v = a[k];
                if (typeof v === 'number') contribution += v;
            }
        } else {
            contribution = a.value;
        }
        tops.set(p.bucketKey, (tops.get(p.bucketKey) ?? 0) + contribution);
    }
    return tops;
}

/** Aggregated view of atoms per bucket — used by curve families
 *  (line, area, stacked-area) which connect one point per bucket
 *  rather than one primitive per atom. The point's y is the stack-
 *  top (Σatom.value in this bucket), the x is the envelope center.
 *  Series totals are also accumulated for multi-line / stacked-area
 *  rendering.
 *
 *  Buckets are emitted in atom-key-ascending order — the same order
 *  the renderer needs for polyline drawing. */
export interface BucketAggregate {
    bucketKey: string;
    xCenter: number;
    xStart: number;
    xEnd: number;
    /** Total stack-top — Σatom.value across atoms in this bucket. */
    value: number;
    /** Per-series totals — `seriesValues[s]` = Σatom[s] across the
     *  bucket. Empty when no series array supplied. */
    seriesValues: Record<string, number>;
    /** Atom-key range — `startKey` is the earliest atom's key,
     *  `endKey` is the latest. Used by chrome / drill-down. */
    startKey: number;
    endKey: number;
    /** Bucket's start ISO date (from the first contributing atom).
     *  Empty when atoms lack iso. */
    startISO: string;
}

export function bucketAggregates(
    atoms: ReadonlyArray<Atom>,
    placements: ReadonlyArray<AtomPlacement>,
    seriesKeys: ReadonlyArray<string> = [],
): BucketAggregate[] {
    /* Group atoms by bucketKey in atom-key order. Within each bucket,
     *  track the cumulative value plus per-series sums. */
    const byKey = new Map<string, BucketAggregate>();
    const order: string[] = [];
    /* Sort atoms by key so buckets emit in chronological order. */
    const sortedIdx = atoms.map((_, i) => i).sort((a, b) => atoms[a].key - atoms[b].key);
    for (const i of sortedIdx) {
        const a = atoms[i];
        const p = placements[i];
        let agg = byKey.get(p.bucketKey);
        if (!agg) {
            agg = {
                bucketKey: p.bucketKey,
                xCenter: (p.xStart + p.xEnd) / 2,
                xStart: p.xStart,
                xEnd: p.xEnd,
                value: 0,
                seriesValues: {},
                startKey: a.key,
                endKey: a.key,
                startISO: a.iso ?? '',
            };
            for (const s of seriesKeys) agg.seriesValues[s] = 0;
            byKey.set(p.bucketKey, agg);
            order.push(p.bucketKey);
        }
        agg.value += a.value;
        for (const s of seriesKeys) {
            const v = a[s];
            if (typeof v === 'number') agg.seriesValues[s] += v;
        }
        if (a.key > agg.endKey) agg.endKey = a.key;
    }
    return order.map(k => byKey.get(k)!);
}

void HOURS_PER_DAY;
