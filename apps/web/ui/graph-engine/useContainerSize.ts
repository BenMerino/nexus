import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import type { ContainerDimensions } from './graph-spatial.types.js';

/* ── useContainerSize ────────────────────────────────────────
 * Spatial Awareness Engine: tracks container WIDTH only via
 * ResizeObserver, then derives height from a capped aspect
 * ratio. This prevents feedback loops in scroll/flex contexts
 * where the chart's own height would grow the container,
 * triggering a new observation, ad infinitum.
 *
 * Returns `null` until the container has been measured. Callers
 * should render only the container element (so the ref attaches)
 * and skip the chart geometry until a real size is available.
 * This avoids any "grow from a corner" effect: the chart simply
 * doesn't paint at the wrong size, then paints once at the right
 * size on the next render. No tween, no snap, no synthesis.
 *
 * Aspect ratio caps:
 *   - Default: width × 0.47 (≈ 16:7.5, a wide landscape)
 *   - Compact types: fixed 40px height
 *   - Max height: 280px (prevents oversized charts in wide layouts)
 *
 * `opts` lets a caller override the derived aspect for shape-locked charts —
 * e.g. a world choropleth passes `{ aspect: 0.5, maxHeight: Infinity }` so the
 * container is exactly 2:1 and the map fills it with no letterbox whitespace.
 * ──────────────────────────────────────────────────────────── */

const ASPECT_RATIO = 0.47;
const MAX_HEIGHT = 280;
const MIN_HEIGHT = 60;

export interface ContainerSizeOpts {
    /** Height = width × aspect (defaults to 0.47). */
    aspect?: number;
    /** Height ceiling (defaults to 280; pass Infinity to follow aspect exactly). */
    maxHeight?: number;
}

function dimsFromWidth(w: number, opts?: ContainerSizeOpts): ContainerDimensions {
    const aspect = opts?.aspect ?? ASPECT_RATIO;
    const maxH = opts?.maxHeight ?? MAX_HEIGHT;
    const h = Math.min(maxH, Math.max(MIN_HEIGHT, Math.round(w * aspect)));
    return { width: w, height: h };
}

export function useContainerSize(
    ref: React.RefObject<HTMLElement | null>,
    opts?: ContainerSizeOpts,
): ContainerDimensions | null {
    const [size, setSize] = useState<ContainerDimensions | null>(null);
    const aspect = opts?.aspect;
    const maxHeight = opts?.maxHeight;

    const measure = useCallback((entry: ResizeObserverEntry) => {
        const w = Math.round(entry.contentRect.width);
        if (w <= 0) return;
        setSize(prev => {
            const next = dimsFromWidth(w, { aspect, maxHeight });
            return (prev && prev.width === next.width && prev.height === next.height) ? prev : next;
        });
    }, [aspect, maxHeight]);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Measure the CONTENT box (clientWidth) to match the ResizeObserver,
        // which reads entry.contentRect.width. getBoundingClientRect() returns
        // the BORDER box — with the container's 1px border that's 2px wider, so
        // the first paint measured border-box then the observer corrected to
        // content-box → a phantom resize that SNAPped every chart ~600ms after
        // load (the "bounce"). Both paths now read content-box; no settle.
        const w = Math.round(el.clientWidth);
        if (w > 0) {
            setSize(prev => {
                const next = dimsFromWidth(w, { aspect, maxHeight });
                return (prev && prev.width === next.width && prev.height === next.height) ? prev : next;
            });
        }
    }, [ref, aspect, maxHeight]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let raf = 0;
        const observer = new ResizeObserver(entries => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => { if (entries[0]) measure(entries[0]); });
        });
        observer.observe(el);
        return () => { cancelAnimationFrame(raf); observer.disconnect(); };
    }, [ref, measure]);

    return size;
}
