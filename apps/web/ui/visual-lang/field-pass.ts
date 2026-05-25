/**
 * Visual language — field pre-pass: gate then normalize.
 *
 * Generic version of the molecule's computeFieldPass. Given a sampler that
 * produces (lit, color) per slot, plus a neighbor graph for the gate,
 * returns gated values + a uniform scale that brings the brightest
 * survivor to `magnitude`.
 *
 * Why gate-then-normalize instead of normalize-then-gate (preserved verbatim
 * from the molecule's reasoning):
 *   helix has multiple "intended bright" cells (one per strand per row),
 *   each with a different alignment to the integer grid. A pre-gate global
 *   normalization scales by the single luckiest row, then a fixed threshold
 *   kills the others. Gating first identifies all the intended-bright cells
 *   in absolute terms, then normalizing within that set scales the
 *   brightest of THEM to magnitude — and the others scale proportionally,
 *   all surviving.
 */

import { gateByNeighborMax, type NeighborGraph } from './sharpness-gate.js';

export interface FieldPassResult {
    /** Per-slot raw color. Empty when sampler is undefined. */
    rawColor: Array<[number, number, number]>;
    /** Per-slot post-gate brightness. Empty when sampler is undefined. */
    gated: number[];
    /** Multiplier so the brightest gated slot ends up at `magnitude`.
     *  0 when nothing passed the gate — caller should treat any field
     *  contribution as zero. */
    scale: number;
}

/** Sampler that produces a (lit, color) for slot index `i`, or null if the
 *  slot has no contribution. */
export type FieldSampler = (i: number) => { lit: number; color: [number, number, number] } | null;

export function computeGatedFieldPass(
    sampler: FieldSampler | undefined,
    slotCount: number,
    neighborGraph: NeighborGraph,
    sharpness: number,
    magnitude: number,
): FieldPassResult {
    const rawColor: Array<[number, number, number]> = [];
    const rawLit: number[] = [];
    if (!sampler) return { rawColor, gated: [], scale: 0 };
    for (let i = 0; i < slotCount; i++) {
        const f = sampler(i);
        rawLit.push(f && f.lit > 0 ? f.lit : 0);
        rawColor.push(f ? f.color : [0, 0, 0]);
    }
    const gated = gateByNeighborMax(rawLit, neighborGraph, sharpness);
    let max = 0;
    for (let i = 0; i < gated.length; i++) {
        if (gated[i] > max) max = gated[i];
    }
    const scale = max > 1e-4 ? magnitude / max : 0;
    return { rawColor, gated, scale };
}
