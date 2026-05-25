/**
 * Unified GPU canvas for chart marks.
 *
 * Takes a `Primitive[]` from any chart family, calls the single-source
 * `tessellatePrimitives` to pack triangles, mounts a <canvas> that the
 * shared renderer draws into. Every chart family in the system uses
 * exactly this component — no per-family variants, no per-family
 * tessellation paths.
 *
 * The `BLOOM_MARGIN_PX` knob extends the canvas past its plot area
 * when set (currently 0; the bloom-margin-bleed trick fought
 * responsive layout in production). Keeping the plumbing so re-enabling
 * is one constant flip away.
 */

import React, { useRef, useMemo } from 'react';
import { useChartCanvas } from '../visual-lang/index.js';
import type { Primitive } from './chart-primitive.types.js';
import { tessellatePrimitives } from './tessellate-primitives.js';
import { useTheme } from '../../hooks/useTheme.js';

/** Bloom margin disabled — see commit notes in
 *  `tessellate-primitives.ts`. Set non-zero to re-enable halo bleed. */
export const BLOOM_MARGIN_PX = 0;

export interface ChartGeometryCanvasProps {
    primitives: ReadonlyArray<Primitive>;
    width: number;
    height: number;
    glow?: number;
    iridescence?: number;
    edgeSoftness?: number;
    saturation?: number;
}

export const ChartGeometryCanvas: React.FC<ChartGeometryCanvasProps> = ({
    primitives, width, height, glow, iridescence, edgeSoftness, saturation,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const m = BLOOM_MARGIN_PX;
    const canvasW = width + m * 2;
    const canvasH = height + m * 2;

    /* `isDark` is included in the memo deps so a light↔dark toggle
     *  re-runs `tessellatePrimitives`. The tessellator caches
     *  CSS-var-resolved RGB tuples and that cache is invalidated by a
     *  MutationObserver on `<html class>`, but invalidating the cache
     *  alone doesn't redraw — it only ensures the NEXT tessellate call
     *  resolves fresh. Without this dep, a static (no-tween) chart kept
     *  the old GPU vertex colors until the next directive change. */
    const isDark = useTheme();
    const { vertices, triCount } = useMemo(
        () => tessellatePrimitives(primitives, m),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [primitives, m, isDark],
    );

    useChartCanvas(canvasRef, {
        cssWidth: canvasW,
        cssHeight: canvasH,
        vertices,
        triCount,
        glow,
        iridescence,
        edgeSoftness,
        saturation,
    });

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                /* Center within the (possibly wider) wrapper via auto
                 *  margins on a both-edges-anchored absolute box. Radial
                 *  charts have `canvasW < wrapper.width`, so this
                 *  visibly centers them. Cartesian charts have
                 *  `canvasW == wrapper.width`, so the auto-margin
                 *  collapses to zero and behavior is unchanged. */
                left: `${-m}px`,
                right: `${-m}px`,
                top: `${-m}px`,
                margin: '0 auto',
                width: `${canvasW}px`,
                height: `${canvasH}px`,
                pointerEvents: 'none',
                display: 'block',
                zIndex: 0,
            }}
        />
    );
};
