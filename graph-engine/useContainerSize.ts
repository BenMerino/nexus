import { useState, useEffect, useCallback } from 'react';
import type { ContainerDimensions } from './graph-spatial.types';

/* ── useContainerSize ────────────────────────────────────────
 * Spatial Awareness Engine: tracks container WIDTH only via
 * ResizeObserver, then derives height from a capped aspect
 * ratio. This prevents feedback loops in scroll/flex contexts
 * where the chart's own height would grow the container,
 * triggering a new observation, ad infinitum.
 *
 * Aspect ratio caps:
 *   - Default: width × 0.47 (≈ 16:7.5, a wide landscape)
 *   - Compact types: fixed 40px height
 *   - Max height: 280px (prevents oversized charts in wide layouts)
 * ──────────────────────────────────────────────────────────── */

const DEFAULT: ContainerDimensions = { width: 320, height: 150 };
const ASPECT_RATIO = 0.47;
const MAX_HEIGHT = 280;
const MIN_HEIGHT = 60;

export function useContainerSize(ref: React.RefObject<HTMLElement | null>): ContainerDimensions {
    const [size, setSize] = useState<ContainerDimensions>(DEFAULT);

    const measure = useCallback((entry: ResizeObserverEntry) => {
        const w = Math.round(entry.contentRect.width);
        if (w <= 0) return;
        const h = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(w * ASPECT_RATIO)));
        setSize(prev => (prev.width === w && prev.height === h) ? prev : { width: w, height: h });
    }, []);

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
