import React from 'react';
import { ChartGeometryCanvas } from './ChartGeometryCanvas.js';
import type { Primitive } from './chart-primitive.types.js';

/* ── ChartCanvasStack ───────────────────────────────────────
 * Two-layer WebGPU canvas stack for a chart:
 *
 *   1. Data layer (bars / lines / areas) — full DNA tuning (glow,
 *      iridescence, edge softness, saturation). Renders to a canvas
 *      with bloom enabled when tuning.glow > 0.
 *   2. Feature layer (trendline / MA / threshold / markers / mean) —
 *      glow=0, iridescence=0. Annotations stay crisp; a 1.5px trend
 *      line is not swallowed by the data marks' bloom halo. Only
 *      mounted when there ARE feature primitives.
 *
 * Both canvases are absolute-positioned within the same wrapper, same
 * width/height, so they overlay pixel-for-pixel. The feature canvas
 * sits later in DOM order so it paints on top.
 * ──────────────────────────────────────────────────────────── */

export interface ChartCanvasStackProps {
    primitives: Primitive[];
    featurePrimitives: Primitive[];
    width: number;
    height: number;
    glow: number;
    iridescence: number;
    edgeSoftness: number;
    saturation: number;
}

export function ChartCanvasStack({
    primitives, featurePrimitives, width, height,
    glow, iridescence, edgeSoftness, saturation,
}: ChartCanvasStackProps) {
    return (
        <>
            <ChartGeometryCanvas
                primitives={primitives}
                width={width} height={height}
                glow={glow} iridescence={iridescence}
                edgeSoftness={edgeSoftness} saturation={saturation}
            />
            {featurePrimitives.length > 0 && (
                <ChartGeometryCanvas
                    primitives={featurePrimitives}
                    width={width} height={height}
                    glow={0} iridescence={0}
                    edgeSoftness={edgeSoftness} saturation={saturation}
                />
            )}
        </>
    );
}
