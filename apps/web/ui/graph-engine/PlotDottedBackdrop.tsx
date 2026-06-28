/**
 * Plot-area dotted backdrop. Sits below the GPU canvas so data marks
 * paint over it; scoped to the plot rectangle (plotXR × plotYR) so it
 * never bleeds into axis-label gutters. Fades to opaque card-bg at the
 * top so the marks' upper register reads clean while the lower portion
 * (near the x-axis) carries the dot texture.
 *
 * Cartesian-only — non-cartesian families pass null and this returns
 * null. Centered horizontally inside the chart wrapper using the same
 * `left: 50%; transform: translateX(-50%)` trick that `ChartChromeLayer`
 * uses, so viewBox coords (plotXR/plotYR) map directly to layout px.
 */

import React from 'react';

export function PlotDottedBackdrop({
    plotXR, plotYR, layoutW, layoutH,
}: {
    plotXR: [number, number] | null;
    plotYR: [number, number] | null;
    layoutW: number;
    layoutH: number;
}) {
    if (!plotXR || !plotYR) return null;
    return (
        <div style={{
            position: 'absolute',
            left: '50%', top: 0,
            width: `${layoutW}px`, height: `${layoutH}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 0,
        }}>
            <div style={{
                position: 'absolute',
                left: `${plotXR[0]}px`,
                top: `${plotYR[0]}px`,
                width: `${plotXR[1] - plotXR[0]}px`,
                height: `${plotYR[1] - plotYR[0]}px`,
                /* Fade ramp only: the top ~25% of the plot rolls into the
                 * CARD background so the marks' upper register reads clean.
                 * The dot texture was REPLACED by horizontal Y-tick gridlines
                 * (drawn in ChartChromeLayer's YAxis, which owns the y-scale)
                 * — those carry the in-plot value reference now. The fade
                 * colour must be the SURFACE the chart sits on (--bg-card):
                 * the chart wrapper is transparent, so a --bg-main fade would
                 * paint a gray gradient over the card. */
                backgroundImage: `linear-gradient(to bottom, var(--bg-card) 0%, transparent 25%)`,
            }} />
        </div>
    );
}
