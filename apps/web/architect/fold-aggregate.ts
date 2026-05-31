/* ── Fold Aggregation Kernel ─────────────────────────────────
 * Combine N atoms in a fractional range into ONE folded atom, per the
 * chosen `Aggregator`. The per-atom edge weight makes folding continuous
 * (a bucket boundary can fall mid-atom), which is what gives the chart
 * its smooth drag. Extracted from `fold-atoms.ts` so that file holds the
 * atom types + calendar windowing, and this holds the aggregation math.
 * ──────────────────────────────────────────────────────────── */

import type { Aggregator, Atom, FoldedAtom } from './fold-atoms.js';
import { foldStatusDefined } from './datum-status.js';

/** Combine atoms in fractional range [from, to) into one folded atom. */
export function combineRange(atoms: Atom[], from: number, to: number, aggregator: Aggregator, seriesKeys: string[]): FoldedAtom {
    const startInt = Math.floor(from);
    const endInt = Math.min(atoms.length, Math.ceil(to));
    // Per-atom weight in [0..1] — partial at the edges, full inside.
    const aw = (i: number): number => {
        const left = Math.max(from, i);
        const right = Math.min(to, i + 1);
        return Math.max(0, right - left);
    };

    if (aggregator === 'first') {
        const a = atoms[startInt];
        return { ...a, count: endInt - startInt };
    }
    if (aggregator === 'last') {
        const a = atoms[endInt - 1];
        return { ...a, count: endInt - startInt };
    }
    if (aggregator === 'min' || aggregator === 'max') {
        // Min/max ignore fractional weights — the extremum is the extremum.
        let extreme = atoms[startInt].value;
        for (let i = startInt + 1; i < endInt; i++) {
            const v = atoms[i].value;
            if (aggregator === 'min' ? v < extreme : v > extreme) extreme = v;
        }
        return synthesize(atoms, startInt, endInt, extreme);
    }
    if (aggregator === 'wavg') {
        let num = 0; let den = 0;
        const seriesNum: Record<string, number> = {};
        for (const k of seriesKeys) seriesNum[k] = 0;
        for (let i = startInt; i < endInt; i++) {
            const w = aw(i);
            const a = atoms[i];
            num += (a.value || 0) * (a.weight ?? 1) * w;
            den += (a.weight ?? 1) * w;
            for (const k of seriesKeys) {
                const sv = a[k];
                if (typeof sv === 'number') seriesNum[k] += sv * (a.weight ?? 1) * w;
            }
        }
        const folded = synthesize(atoms, startInt, endInt, den === 0 ? 0 : num / den);
        for (const k of seriesKeys) folded[k] = den === 0 ? 0 : seriesNum[k] / den;
        return folded;
    }
    // sum (default)
    let sum = 0;
    const seriesSum: Record<string, number> = {};
    for (const k of seriesKeys) seriesSum[k] = 0;
    for (let i = startInt; i < endInt; i++) {
        const w = aw(i);
        const a = atoms[i];
        sum += (a.value || 0) * w;
        for (const k of seriesKeys) {
            const sv = a[k];
            if (typeof sv === 'number') seriesSum[k] += sv * w;
        }
    }
    const folded = synthesize(atoms, startInt, endInt, sum);
    for (const k of seriesKeys) folded[k] = seriesSum[k];
    return folded;
}

/** Build the folded atom's metadata: midpoint key, boundary label, count.
 * Series values are filled by the caller. Folds semantic `status` (any
 * projected ⇒ projected) and `defined` (any defined ⇒ defined) across the
 * range so families reading folded buckets see the aggregated meaning. */
function synthesize(atoms: Atom[], startInt: number, endInt: number, value: number): FoldedAtom {
    const first = atoms[startInt];
    const last = atoms[endInt - 1];
    const key = (first.key + last.key) / 2;
    const label = startInt === endInt - 1 ? first.label : `${first.label}–${last.label}`;
    const { status, defined } = foldStatusDefined(atoms, startInt, endInt);
    return { key, label, value, count: endInt - startInt, status, defined };
}
