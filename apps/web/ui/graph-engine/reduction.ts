/**
 * Reductions — the single primitive behind both KPI headlines and the
 * scalar-shaped chart features (average line, trendline). A reduction
 * collapses the visible buckets to ONE number that is, by construction,
 * a function of the plotted series: change the window/fold and the
 * reduction recomputes with the buckets it summarizes, so it can never
 * drift from what's on screen.
 *
 * Facts only. A reduction yields `{ value, slope? }` — never a
 * rising/flat/falling judgement (that needs a threshold, which is a
 * presentation policy owned by `ChartKpiHeader`) and never pixels (the
 * overlay resolvers project the value into the plot).
 *
 * The headline path computes this in `resolveAtomicDirective` over the
 * same `__buckets` it builds — the only clock that stays in sync.
 */

/** A reduced bucket: only the value the reduction reads. */
export interface ReductionDatum { value: number }

/** The governed reduction vocabulary. `slope` is the OLS gradient over
 *  bucket index (the trendline's scalar); the rest are positional /
 *  extremal scalars over the values. */
export type ReductionKind = 'mean' | 'sum' | 'last' | 'first' | 'min' | 'max' | 'count' | 'slope';

/** Pure scalar facts. `slope` is present only for `kind:'slope'` (it is
 *  the value too, but kept named so a direction classifier can read the
 *  gradient without re-inferring intent). */
export interface Reduction {
    kind: ReductionKind;
    value: number;
    slope?: number;
}

/** Reduce visible buckets to one scalar. Pure; empty input yields a
 *  zero-value reduction so callers never branch on length. */
export function reduce(kind: ReductionKind, data: ReadonlyArray<ReductionDatum>): Reduction {
    const n = data.length;
    if (n === 0) return { kind, value: 0 };
    switch (kind) {
        case 'count': return { kind, value: n };
        case 'first': return { kind, value: data[0].value };
        case 'last': return { kind, value: data[n - 1].value };
        case 'sum': return { kind, value: sum(data) };
        case 'mean': return { kind, value: sum(data) / n };
        case 'min': return { kind, value: Math.min(...data.map(d => d.value)) };
        case 'max': return { kind, value: Math.max(...data.map(d => d.value)) };
        case 'slope': {
            const m = olsSlope(data);
            return { kind, value: m, slope: m };
        }
    }
}

function sum(data: ReadonlyArray<ReductionDatum>): number {
    let s = 0;
    for (const d of data) s += d.value;
    return s;
}

/** OLS gradient of value over bucket index (x = 0..n-1). Returns 0 when
 *  fewer than two points or a degenerate x-spread. Index-space (not
 *  pixel) so the slope is scale-stable and reusable by the trendline. */
function olsSlope(data: ReadonlyArray<ReductionDatum>): number {
    const n = data.length;
    if (n < 2) return 0;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
        sx += i; sy += data[i].value; sxx += i * i; sxy += i * data[i].value;
    }
    const denom = n * sxx - sx * sx;
    return denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
}
