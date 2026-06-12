import React from 'react';
import { useTween, TWEEN_DURATION_MS } from './tween.js';

/* ── TweenedNumber ───────────────────────────────────────────
 * Renders a number that smoothly tweens between updates instead
 * of snapping. Returns the formatted text as a Fragment so the
 * host element is up to the caller (use inside <BaseText>, SVG
 * <text>, <span>, etc).
 *
 * Use this when the value source SNAPS (server payload, prop
 * change, computed total in one tick). Don't wrap a value that's
 * already animating from an upstream tween — that double-tweens.
 * ──────────────────────────────────────────────────────────── */

interface Props {
    value: number;
    /** Format the in-flight numeric value to a string. Receives the tweened value each frame. */
    format?: (n: number) => string;
    /** Tween duration in ms. Default 280 (matches engine). */
    duration?: number;
    /** Round to integer each frame (default true — set false for currency cents/decimals). */
    round?: boolean;
}

export function TweenedNumber({ value, format, duration = TWEEN_DURATION_MS, round = true }: Props) {
    const displayed = useTween(value, duration, round);
    return <>{format ? format(displayed) : String(displayed)}</>;
}
