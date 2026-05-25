import { useEffect, useRef, useState } from 'react';

/* ── Tween Primitives ────────────────────────────────────────
 * One RAF-driven value tween used across the design system:
 * KPI counters, chart series weights, gauge values, etc.
 *
 * - `easeOutCubic` is the canonical easing — match this for any
 *   animation that should feel kin to the rest of the app.
 * - `useTween(target)` smoothly chases a single number.
 * - `useTweenedMap(targets)` does the same for a Map<key, number>.
 * - Re-targeting mid-tween starts the next tween from the
 *   currently-displayed value, not from the prop's previous value.
 * - First mount renders the initial value with no animation.
 * ──────────────────────────────────────────────────────────── */

export const TWEEN_DURATION_MS = 280;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useTween(target: number, duration = TWEEN_DURATION_MS, round = true): number {
    const [displayed, setDisplayed] = useState(target);
    const rafRef = useRef<number | null>(null);
    const fromRef = useRef(target);
    const toRef = useRef(target);

    useEffect(() => {
        if (toRef.current === target) return;
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        fromRef.current = displayed;
        toRef.current = target;
        const start = performance.now();
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const v = fromRef.current + (toRef.current - fromRef.current) * easeOutCubic(t);
            setDisplayed(round ? Math.round(v) : v);
            if (t < 1) rafRef.current = requestAnimationFrame(step);
            else rafRef.current = null;
        };
        rafRef.current = requestAnimationFrame(step);
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, duration, round]);

    return displayed;
}

/** Tween a keyed map of numbers. Each key independently chases its target value.
 *
 * Limitations:
 * - Keys present in `targets` but not in the prior displayed map appear at their
 *   target value on the next animation tick (no enter animation).
 * - Keys removed from `targets` disappear from the displayed map without an
 *   exit animation. Callers that need exit animation should keep the key in
 *   `targets` with target = 0 until the animation completes.
 */
export function useTweenedMap(targets: Map<string, number>, duration = TWEEN_DURATION_MS): Map<string, number> {
    const [displayed, setDisplayed] = useState<Map<string, number>>(() => new Map(targets));
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        const from = new Map(displayed);
        const to = targets;
        // Skip animation if every key already matches.
        let dirty = false;
        for (const [k, v] of to) if ((from.get(k) ?? v) !== v) { dirty = true; break; }
        for (const k of from.keys()) if (!to.has(k)) { dirty = true; break; }
        if (!dirty) return;

        const start = performance.now();
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(t);
            const next = new Map<string, number>();
            for (const [k, target] of to) {
                const a = from.get(k) ?? target;
                next.set(k, a + (target - a) * eased);
            }
            setDisplayed(next);
            if (t < 1) rafRef.current = requestAnimationFrame(step);
            else rafRef.current = null;
        };
        rafRef.current = requestAnimationFrame(step);
        return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targets, duration]);

    return displayed;
}
