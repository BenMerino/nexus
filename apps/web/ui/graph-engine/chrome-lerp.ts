/* ── Chrome Lerp ─────────────────────────────────────────────
 * Per-frame interpolation of chrome positions, driven by the same
 * rAF clock that lerps chart-mark geometry. Labels and dividers
 * move on the exact same physical animation as the bars/lines they
 * sit above — no CSS transitions, no separate easing curve.
 *
 * Match policy: labels are matched across frames by their `keys[i]`
 * entry (a stable ISO/tier identifier set by the chrome builder).
 * Survivors interpolate; new labels appear at their target position;
 * dropped labels disappear instantly. The match is a pure-data
 * operation — no DOM, no React.
 * ──────────────────────────────────────────────────────────── */

import type { ChartChrome, ChromeElement } from './chart-chrome.types.js';

/** Pure: produce a chrome whose label positions are the linear
 *  interpolation of `prev` and `target` at fraction `eased`. For
 *  x-axis-band elements, labels are matched by `keys[i]`; matched
 *  pairs lerp their `centerX` and `leadingEdgeXs`; unmatched targets
 *  use their final position; unmatched prevs are dropped (the new
 *  chrome's index space is the source of truth). */
export function lerpChrome(prev: ChartChrome, target: ChartChrome, eased: number): ChartChrome {
    /* Element arrays must align by `kind`+source-order; the chrome
     *  builder emits a stable order per directive shape. If lengths
     *  diverge (rare — a tier appeared/disappeared between directives),
     *  we lerp the common prefix and pass through the target's tail. */
    const out: ChromeElement[] = target.elements.map((el, idx) => {
        const p = prev.elements[idx];
        if (!p || p.kind !== el.kind) return el;
        if (el.kind !== 'x-axis-band' || p.kind !== 'x-axis-band') return el;
        return lerpXAxisBand(p, el, eased);
    });
    return { ...target, elements: out };
}

function lerpXAxisBand(
    prev: Extract<ChromeElement, { kind: 'x-axis-band' }>,
    target: Extract<ChromeElement, { kind: 'x-axis-band' }>,
    eased: number,
): Extract<ChromeElement, { kind: 'x-axis-band' }> {
    const prevByKey = new Map<string, { idx: number }>();
    if (prev.keys) {
        prev.keys.forEach((k, i) => prevByKey.set(k, { idx: i }));
    }
    /* Build per-index x positions for the prev snapshot. xAt is the
     *  authoritative position function — fall back to a uniform step
     *  when absent (rare; the chrome builder always sets xAt for
     *  atomic-flow charts). */
    const prevPlotWidth = Math.max(1, prev.range[1] - prev.range[0]);
    const prevStep = prevPlotWidth / Math.max(1, prev.labels.length);
    const prevAt = prev.xAt ?? ((i: number) => prev.range[0] + i * prevStep + prevStep / 2);
    /* Build the target positions the renderer would normally use, then
     *  override each one with a lerp from its prev-frame match. */
    const targetPlotWidth = Math.max(1, target.range[1] - target.range[0]);
    const targetStep = targetPlotWidth / Math.max(1, target.labels.length);
    const targetAt = target.xAt ?? ((i: number) => target.range[0] + i * targetStep + targetStep / 2);

    const easedPositions: number[] = target.labels.map((_, i) => {
        const tx = targetAt(i);
        const key = target.keys?.[i];
        if (!key) return tx;
        const p = prevByKey.get(key);
        if (!p) return tx; // new label — appear at target
        const px = prevAt(p.idx);
        return px + (tx - px) * eased;
    });

    const lerpEdge = (
        prevArr: number[] | undefined,
        targetArr: number[] | undefined,
    ): number[] | undefined => {
        if (!targetArr) return undefined;
        return targetArr.map((tx, i) => {
            const key = target.keys?.[i];
            if (!key || !prevArr) return tx;
            const p = prevByKey.get(key);
            if (!p) return tx;
            const px = prevArr[p.idx];
            if (typeof px !== 'number') return tx;
            return px + (tx - px) * eased;
        });
    };

    return {
        ...target,
        xAt: (i: number) => easedPositions[i] ?? targetAt(i),
        leadingEdgeXs: lerpEdge(prev.leadingEdgeXs, target.leadingEdgeXs),
        trailingEdgeXs: lerpEdge(prev.trailingEdgeXs, target.trailingEdgeXs),
    };
}
