/**
 * Bar family's `lerp` body — staged enter/exit/persist with per-bar
 * wall-time clocks, split-into-N and merge-back-to-1 mechanics.
 * Extracted from `animated-cartesian.ts` so the family file stays
 * under the file-length ceiling and the multi-stage matching logic
 * lives in one focused module.
 */

import type { BarItem, BarState } from './animated-cartesian.js';
import type { AnimationPhase } from './animated-family.js';
import { lerpNumber, ANIMATION_DURATION_MS } from './animated-family.js';
import {
    PER_BAR_START_SPREAD,
    PER_BAR_GROW_SPAN,
} from './animated-cartesian-shared.js';
import { easeOutCubic } from '../primitives/tween.js';
import { pairBarsForFold } from './animated-cartesian-pairing.js';

export function barLerp(
    prev: BarState,
    target: BarState,
    phase: AnimationPhase,
): { state: BarState; maxDelta: number; done: boolean } {
    const dRef = { value: 0 };
    const n = target.bars.length;
    const { alphaX, alphaY } = phase;
    const now = performance.now();
    /* Match prev↔target bars by BUCKET IDENTITY (bucketKey) first. A
     *  bucket keeps its key across slider drags and within a fold, so
     *  the same bucket is matched as PERSISTENT (no enter/exit) — the
     *  smooth-slide path. bucketKey is fold-unit-scoped, so a fold
     *  change (day→week) yields different keys → those targets fall
     *  through to `pairBarsForFold`'s iso-containment, which handles
     *  split/merge. Legacy non-atomic bars (bucketKey `''`) also fall
     *  through. */
    const reshapedPrev: Array<BarItem | undefined> = new Array(n);
    const usedPrev = new Set<number>();
    const prevByBucketKey = new Map<string, { item: BarItem; idx: number }>();
    for (let j = 0; j < prev.bars.length; j++) {
        const p = prev.bars[j];
        if (p.bucketKey) prevByBucketKey.set(p.bucketKey, { item: p, idx: j });
    }
    const unmatchedTargets: number[] = [];
    for (let i = 0; i < n; i++) {
        const t = target.bars[i];
        if (t.bucketKey) {
            const hit = prevByBucketKey.get(t.bucketKey);
            if (hit && !usedPrev.has(hit.idx)) {
                reshapedPrev[i] = hit.item;
                usedPrev.add(hit.idx);
                continue;
            }
        }
        unmatchedTargets.push(i);
    }
    /* Legacy iso-containment fallback for non-atomic bars among the
     *  still-unmatched targets. */
    if (unmatchedTargets.length > 0) {
        const remainingPrev = prev.bars.map((p, j) => usedPrev.has(j) ? null : p);
        const remainingTarget = unmatchedTargets.map(i => target.bars[i]);
        const legacy = pairBarsForFold(
            remainingPrev.filter((p): p is BarItem => p !== null),
            remainingTarget,
        );
        const prevIdxMap: number[] = [];
        prev.bars.forEach((_, j) => { if (!usedPrev.has(j)) prevIdxMap.push(j); });
        unmatchedTargets.forEach((targetIdx, k) => {
            const matched = legacy.matched[k];
            if (matched) {
                reshapedPrev[targetIdx] = matched;
                const prevIdxInRemaining = remainingPrev.filter((p): p is BarItem => p !== null).indexOf(matched);
                if (prevIdxInRemaining >= 0) usedPrev.add(prevIdxMap[prevIdxInRemaining]);
            }
        });
    }
    /* Index prev by iso so the entering branch can inherit `enteredAt`
     *  from a prev frame's still-entering bar (drag accumulation). */
    const prevByIso = new Map<string, BarItem>();
    for (const p of prev.bars) if (p.iso) prevByIso.set(p.iso, p);
    /* SPLIT groups: target indices sharing a prev parent. Each child
     *  within the group gets a packed slot inside the parent's x-span
     *  at t=0 — no overlap. Slot index by chronological order (target x). */
    const splitGroupByPrev = new Map<BarItem, number[]>();
    for (let i = 0; i < n; i++) {
        const p = reshapedPrev[i];
        if (!p) continue;
        const group = splitGroupByPrev.get(p);
        if (group) group.push(i);
        else splitGroupByPrev.set(p, [i]);
    }
    const splitSlotByTargetIdx = new Map<number, { slot: number; count: number }>();
    for (const [, group] of splitGroupByPrev) {
        if (group.length <= 1) continue;
        const sorted = [...group].sort((a, b) => target.bars[a].x - target.bars[b].x);
        sorted.forEach((targetIdx, slot) => {
            splitSlotByTargetIdx.set(targetIdx, { slot, count: sorted.length });
        });
    }
    /* Cascade ranks for entering/exiting bars (chronological order). */
    const enteringIdxs: number[] = [];
    for (let i = 0; i < n; i++) if (!reshapedPrev[i]) enteringIdxs.push(i);
    enteringIdxs.sort((a, b) => target.bars[a].x - target.bars[b].x);
    const enteringRank = new Map<number, number>();
    enteringIdxs.forEach((idx, rank) => enteringRank.set(idx, rank));
    const exitingPrevIdxs: number[] = [];
    for (let j = 0; j < prev.bars.length; j++) if (!usedPrev.has(j)) exitingPrevIdxs.push(j);
    exitingPrevIdxs.sort((a, b) => prev.bars[a].x - prev.bars[b].x);
    const exitingRank = new Map<number, number>();
    exitingPrevIdxs.forEach((idx, rank) => exitingRank.set(idx, rank));
    const out: BarItem[] = [];
    for (let i = 0; i < n; i++) {
        const t = target.bars[i];
        const p = reshapedPrev[i];
        if (p) {
            const enteredAt = p.enteredAt;
            const enterClockA = enteredAt != null
                ? Math.max(0, Math.min(1, (now - enteredAt) / ANIMATION_DURATION_MS))
                : 1;
            if (enteredAt != null && enterClockA < 1) {
                const baseY = t.y + t.h;
                const a = easeOutCubic(enterClockA);
                out.push({
                    x: lerpNumber(p.x, t.x, alphaX, dRef),
                    y: lerpNumber(baseY, t.y, a, dRef),
                    w: lerpNumber(p.w, t.w, alphaX, dRef),
                    h: lerpNumber(0, t.h, a, dRef),
                    color: t.color, hit: t.hit,
                    iso: t.iso, isoEnd: t.isoEnd,
                    bucketKey: t.bucketKey,
                    status: t.status,
                    enteredAt, exitingAt: null,
                });
            } else {
                /* SPLIT (start): each child packs inside parent's x-span
                 *  at t=0. PERSISTENT (N=1): start = prev geometry. */
                const splitInfo = splitSlotByTargetIdx.get(i);
                let startX: number, startW: number, startY: number, startH: number;
                if (splitInfo) {
                    const slotW = p.w / splitInfo.count;
                    startX = p.x + splitInfo.slot * slotW;
                    startW = slotW;
                    startY = p.y;
                    startH = p.h;
                } else {
                    startX = p.x; startW = p.w; startY = p.y; startH = p.h;
                }
                out.push({
                    x: lerpNumber(startX, t.x, alphaX, dRef),
                    y: lerpNumber(startY, t.y, alphaY, dRef),
                    w: lerpNumber(startW, t.w, alphaX, dRef),
                    h: lerpNumber(startH, t.h, alphaY, dRef),
                    color: t.color, hit: t.hit,
                    iso: t.iso, isoEnd: t.isoEnd,
                    bucketKey: t.bucketKey,
                    status: t.status,
                    enteredAt: null, exitingAt: null,
                });
            }
        } else {
            /* Entering: inherit `enteredAt` from a prev-iso match (drag
             *  accumulation) or stamp `now + rankOffset`. */
            const prevByIsoHit = prevByIso.get(t.iso);
            const inherited = prevByIsoHit?.enteredAt;
            const rank = enteringRank.get(i) ?? 0;
            const total = enteringIdxs.length;
            const rankOffsetMs = total > 1
                ? (rank / (total - 1)) * PER_BAR_START_SPREAD * ANIMATION_DURATION_MS
                : 0;
            let enteredAt: number;
            if (inherited != null) {
                enteredAt = inherited;
            } else if (prevByIsoHit) {
                enteredAt = now + rankOffsetMs;
                prevByIsoHit.enteredAt = enteredAt;
            } else {
                enteredAt = now + rankOffsetMs;
            }
            const enterClockA = Math.max(0, Math.min(1, (now - enteredAt) / (PER_BAR_GROW_SPAN * ANIMATION_DURATION_MS)));
            const a = easeOutCubic(enterClockA);
            const baseY = t.y + t.h;
            out.push({
                x: t.x,
                y: lerpNumber(baseY, t.y, a, dRef),
                w: t.w,
                h: lerpNumber(0, t.h, a, dRef),
                color: t.color, hit: t.hit,
                iso: t.iso, isoEnd: t.isoEnd,
                bucketKey: t.bucketKey,
                status: t.status,
                enteredAt: enterClockA < 1 ? enteredAt : null,
                exitingAt: null,
            });
        }
    }
    /* Unmatched prevs: MERGE (calendar-contained in some target —
     *  converge) vs EXIT (no containment — descend). */
    for (const j of exitingPrevIdxs) {
        const p = prev.bars[j];
        let mergeTarget: BarItem | undefined;
        if (p.iso) {
            for (let i = 0; i < n; i++) {
                const t = target.bars[i];
                if (t.isoEnd && p.iso >= t.iso && p.iso < t.isoEnd) {
                    mergeTarget = t; break;
                }
            }
        }
        if (mergeTarget) {
            const t = mergeTarget;
            out.push({
                x: lerpNumber(p.x, t.x, alphaX, dRef),
                y: lerpNumber(p.y, t.y, alphaY, dRef),
                w: lerpNumber(p.w, t.w, alphaX, dRef),
                h: lerpNumber(p.h, t.h, alphaY, dRef),
                color: t.color, hit: t.hit,
                iso: t.iso, isoEnd: t.isoEnd,
                bucketKey: t.bucketKey,
                status: t.status,
                enteredAt: null, exitingAt: null,
            });
            continue;
        }
        /* True EXIT: per-bar exit clock stamped on first encounter,
         *  preserved across rAF ticks via prev mutation. */
        const rank = exitingRank.get(j) ?? 0;
        const total = exitingPrevIdxs.length;
        const rankOffsetMs = total > 1
            ? (rank / (total - 1)) * PER_BAR_START_SPREAD * ANIMATION_DURATION_MS
            : 0;
        if (p.exitingAt == null) {
            p.exitingAt = now + rankOffsetMs;
        }
        const exitingAt = p.exitingAt;
        const exitClockA = Math.max(0, Math.min(1, (now - exitingAt) / (PER_BAR_GROW_SPAN * ANIMATION_DURATION_MS)));
        if (exitClockA >= 1) continue;
        const a = easeOutCubic(exitClockA);
        const baseY = p.y + p.h;
        out.push({
            x: p.x,
            y: lerpNumber(p.y, baseY, a, dRef),
            w: p.w,
            h: lerpNumber(p.h, 0, a, dRef),
            color: p.color, hit: p.hit,
            iso: p.iso, isoEnd: p.isoEnd,
            bucketKey: p.bucketKey,
            status: p.status,
            enteredAt: null,
            exitingAt,
        });
    }
    /* Done? Per-bar enter/exit clocks run on wall time independent of
     *  the main tween's duration. If any bar still has an active clock,
     *  signal "not done" so the engine keeps rAF ticking until the
     *  bar's growth/decay actually finishes. */
    let done = true;
    for (const b of out) {
        if (b.enteredAt != null || b.exitingAt != null) { done = false; break; }
    }
    return { state: { bars: out }, maxDelta: dRef.value, done };
}
