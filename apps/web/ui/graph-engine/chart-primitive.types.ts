/**
 * Chart geometry primitive vocabulary.
 *
 * Every chart mark in the system reduces to one of these primitives.
 * Chart families translate their domain (bars, line series, pie wedges,
 * etc.) into `Primitive[]`, and the GPU pipeline + hit-test layer consume
 * that uniform shape. Coordinates are in the chart's viewBox px space
 * (origin top-left, +y down).
 *
 * `data` is an opaque payload the chart family uses to populate the
 * tooltip / hover state when the primitive is hit. The renderer never
 * looks at it.
 */

export interface PrimitiveBase {
    color: string;
    /** Optional alpha multiplier [0..1]. Defaults to 1. Used for series
     *  toggle fades and stacked-area layer transparency. */
    opacity?: number;
    /** Hit metadata — surfaced to the tooltip when this primitive is
     *  hovered. Pass through whatever the family needs (label, value,
     *  series name, idx, etc.). Renderer is opaque to its shape. */
    data?: unknown;
}

export interface RectPrimitive extends PrimitiveBase {
    kind: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
    /** Corner radii in px. `radiusTop`/`radiusBot` round BOTH top or
     *  bottom corners uniformly; per-corner overrides
     *  `radiusTL`/`radiusTR`/`radiusBL`/`radiusBR` round one corner
     *  at a time and fall back to `radiusTop`/`radiusBot` when unset.
     *  Used by atomic-bar clusters where the leftmost atom rounds its
     *  top-left only, the rightmost atom rounds its top-right only, and
     *  inner atoms stay flat-topped so the cluster reads as one polygon
     *  with rounded outer corners and seamless inner edges. */
    radiusTop?: number;
    radiusBot?: number;
    radiusTL?: number;
    radiusTR?: number;
    radiusBL?: number;
    radiusBR?: number;
    /** Optional vertical gradient — alpha varies linearly from
     *  `topOpacity` at the rect's top edge to `bottomOpacity` at its
     *  bottom edge. Matches `AreaBandPrimitive.gradient` semantics so
     *  bars can adopt the same fade-toward-baseline treatment as area
     *  fills. Omit for flat fill (default). */
    gradient?: { topOpacity: number; bottomOpacity: number };
}

export interface PolygonPrimitive extends PrimitiveBase {
    kind: 'polygon';
    points: ReadonlyArray<{ x: number; y: number }>;
    /** Optional vertical gradient — opacity fades from `topOpacity` at
     *  the polygon's top edge to `bottomOpacity` at its bottom. Used by
     *  area/stacked-area charts to fade fills toward the baseline.
     *  Omit for flat fill. */
    gradient?: { topOpacity: number; bottomOpacity: number };
}

export interface PolylinePrimitive extends PrimitiveBase {
    kind: 'polyline';
    points: ReadonlyArray<{ x: number; y: number }>;
    /** Stroke width in px. Required — there's no default. */
    strokeWidth: number;
    /** Dash pattern `[onPx, offPx]`. Omit ⇒ solid. Rendered by
     *  arc-length geometric split at tessellation time (one short stroke
     *  per "on" run) — NO shader/dash uniform. A dash IS short lines.
     *  The solid path pays nothing: only set primitives are split. */
    dash?: [number, number];
}

/** Monotone-x area ribbon: a band between two y-tracks (top and base)
 *  that share the same x positions. Tessellates as a triangle strip in
 *  O(n) — no ear-clipping. Both tracks may be curves; for a flat-base
 *  area (`baseY: number`), the writer fills the base track with a
 *  constant Y.
 *
 *  Use when the shape is a "ribbon" over a sorted x axis: single-area,
 *  stacked-area, future range bands. For arbitrary simple polygons
 *  (radar, funnel) keep using `'polygon'`. */
export interface AreaBandPrimitive extends PrimitiveBase {
    kind: 'area-band';
    /** Top track. Must be x-sorted ascending. */
    top: ReadonlyArray<{ x: number; y: number }>;
    /** Base track. Either a constant Y (flat baseline) or a same-length
     *  array of points matching `top` x positions. */
    base: number | ReadonlyArray<{ x: number; y: number }>;
    /** Optional vertical gradient — alpha fades from `topOpacity` at the
     *  top track to `bottomOpacity` at the base track. */
    gradient?: { topOpacity: number; bottomOpacity: number };
}

export interface CirclePrimitive extends PrimitiveBase {
    kind: 'circle';
    cx: number;
    cy: number;
    r: number;
    /** When set, renders a stroked circle of this width instead of filled. */
    strokeWidth?: number;
}

/** Filled annular arc — used for pie wedges, donut slices, gauges, rings.
 *  The renderer tessellates as a triangle fan between inner and outer
 *  radii sampled at small angle steps. `innerRadius=0` collapses to a
 *  pie wedge. */
export interface ArcPrimitive extends PrimitiveBase {
    kind: 'arc';
    cx: number;
    cy: number;
    outerRadius: number;
    innerRadius: number;
    /** Radians, math convention (CCW from +x). */
    startAngle: number;
    endAngle: number;
}

export type Primitive =
    | RectPrimitive
    | PolygonPrimitive
    | PolylinePrimitive
    | AreaBandPrimitive
    | CirclePrimitive
    | ArcPrimitive;

/** Returns the bounding box of a primitive in chart-local coords. Used
 *  by the hit-test overlay to render an invisible target rect for each
 *  primitive. (For circles/arcs we use the bounding box too — close
 *  enough for hover; the family can supply tighter hit shapes later.) */
export function primitiveBBox(p: Primitive): { x: number; y: number; w: number; h: number } {
    switch (p.kind) {
        case 'rect':
            return { x: p.x, y: p.y, w: p.w, h: p.h };
        case 'polygon':
        case 'polyline': {
            if (p.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
            let minX = p.points[0].x, maxX = minX;
            let minY = p.points[0].y, maxY = minY;
            for (let i = 1; i < p.points.length; i++) {
                const pt = p.points[i];
                if (pt.x < minX) minX = pt.x; else if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y; else if (pt.y > maxY) maxY = pt.y;
            }
            const pad = p.kind === 'polyline' ? p.strokeWidth * 0.5 : 0;
            return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
        }
        case 'area-band': {
            if (p.top.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
            let minX = p.top[0].x, maxX = minX;
            let minY = p.top[0].y, maxY = minY;
            for (let i = 1; i < p.top.length; i++) {
                const pt = p.top[i];
                if (pt.x < minX) minX = pt.x; else if (pt.x > maxX) maxX = pt.x;
                if (pt.y < minY) minY = pt.y; else if (pt.y > maxY) maxY = pt.y;
            }
            if (typeof p.base === 'number') {
                if (p.base < minY) minY = p.base; else if (p.base > maxY) maxY = p.base;
            } else {
                for (let i = 0; i < p.base.length; i++) {
                    const by = p.base[i].y;
                    if (by < minY) minY = by; else if (by > maxY) maxY = by;
                }
            }
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }
        case 'circle':
            return { x: p.cx - p.r, y: p.cy - p.r, w: p.r * 2, h: p.r * 2 };
        case 'arc':
            return {
                x: p.cx - p.outerRadius,
                y: p.cy - p.outerRadius,
                w: p.outerRadius * 2,
                h: p.outerRadius * 2,
            };
    }
}
