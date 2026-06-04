/* Chart-type → family classification + animated handler dispatch.
 *
 * The handler table maps each chart type to:
 *   - its `AnimatedFamily<State>` (sample / lerp / primitives)
 *   - a layout builder that produces the family-natural layout shape
 *   - a chrome builder that produces the SVG overlay elements
 *
 * ChartRender uses `buildFamilyAnimation()` to assemble everything for
 * one chart: the family, the layout it expects, the chrome to mount,
 * and the layout-size for sizing the wrapper. The rAF loop in
 * `useChartAnimation` then drives sample → lerp → primitives.
 */

import type { GraphDirective } from '../../architect/graph-composer.types.js';
import type { ChartChrome } from './chart-chrome.types.js';
import {
    buildCartesianLayout,
    cartesianDragResolve,
    cartesianIsoToFrame,
    type CartesianLayout,
    type DragEndpoint,
} from './chart-primitives-cartesian.js';
import { cartesianChrome } from './chart-cartesian-chrome.js';
import {
    buildRadialLayout,
    radialChrome,
    radarChrome,
    gridChrome,
} from './chart-primitives-radial.js';
import { animatedBar } from './animated-cartesian.js';
import { animatedStackedBar } from './animated-cartesian-stacked.js';
import { animatedLine, animatedMultiLine } from './animated-cartesian-lines.js';
import { animatedArea, animatedStackedArea } from './animated-cartesian-areas.js';
import {
    animatedScatter, animatedBubble,
    animatedWaterfall, animatedDistribution,
} from './animated-cartesian-special.js';
import { animatedPie, animatedGauge, animatedRing } from './animated-radial.js';
import { animatedRadar, animatedHeatmap } from './animated-grid.js';
import { animatedTreemap, animatedFunnel } from './animated-packed.js';
import { animatedGeo } from './animated-geo.js';
import type { AnimatedFamily } from './animated-family.js';

const CARTESIAN = new Set([
    'bar', 'stacked-bar', 'area', 'stacked-area', 'line', 'multi-line',
    'sparkline', 'distribution', 'waterfall', 'scatter', 'bubble',
]);
const RADIAL = new Set(['pie', 'donut', 'gauge', 'progress-ring']);
const POLAR = new Set(['radar']);
const GRID = new Set(['heatmap', 'treemap', 'funnel']);
const GEO = new Set(['choropleth']);

export function isCartesian(type: string): boolean { return CARTESIAN.has(type); }
export function isRadial(type: string): boolean { return RADIAL.has(type); }
export function isPolar(type: string): boolean { return POLAR.has(type); }
export function isGrid(type: string): boolean { return GRID.has(type); }
export function isGeo(type: string): boolean { return GEO.has(type); }

export type ChartFamilyName = 'cartesian' | 'radial' | 'polar' | 'grid' | 'geo' | 'unknown';

export function familyOf(type: string): ChartFamilyName {
    if (CARTESIAN.has(type)) return 'cartesian';
    if (RADIAL.has(type)) return 'radial';
    if (POLAR.has(type)) return 'polar';
    if (GRID.has(type)) return 'grid';
    if (GEO.has(type)) return 'geo';
    return 'unknown';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFamily = AnimatedFamily<any>;

interface ChartTypeHandler {
    family: AnyFamily;
    /** Builds the family-natural layout the animated family's sample
     *  function expects as its `layoutRaw` argument. */
    buildLayout: (chart: GraphDirective, w: number, h: number, axesOverride?: string) => unknown;
    /** Builds the SVG chrome overlay (axes, labels, threshold lines). */
    buildChrome: (chart: GraphDirective, layout: unknown) => ChartChrome;
    /** Output canvas size — usually same as input but radial squares it. */
    layoutSize: (chart: GraphDirective, w: number, h: number) => { w: number; h: number };
    /** Cartesian-only: drag resolver, iso→frame reverse projector,
     *  plot rectangle in viewBox px (xR × yR). */
    dragSupport: (chart: GraphDirective, layout: unknown) => {
        dragResolve: ((vx: number, vw: number) => DragEndpoint | null) | null;
        isoToFrame: ((iso: string) => DragEndpoint | null) | null;
        plotXR: [number, number] | null;
        plotYR: [number, number] | null;
    };
}

const cartesianHandler: ChartTypeHandler = {
    family: animatedBar /* placeholder; overridden by per-type entries */,
    buildLayout: (chart, w, h) => buildCartesianLayout(chart, w, h),
    buildChrome: (chart, layout) => cartesianChrome(chart, layout as CartesianLayout),
    layoutSize: (_chart, w, h) => ({ w, h }),
    dragSupport: (chart, layout) => {
        const l = layout as CartesianLayout;
        return {
            dragResolve: cartesianDragResolve(chart, l),
            isoToFrame: cartesianIsoToFrame(chart, l),
            plotXR: l.xR,
            plotYR: l.yR,
        };
    },
};

const radialHandler: ChartTypeHandler = {
    family: animatedPie,
    buildLayout: (chart, w, h) => {
        const size = Math.min(w, h);
        return buildRadialLayout(chart, size);
    },
    buildChrome: (chart, layout) => radialChrome(chart, layout as ReturnType<typeof buildRadialLayout>),
    layoutSize: (_chart, w, h) => {
        const size = Math.min(w, h);
        return { w: size, h: size };
    },
    dragSupport: () => ({ dragResolve: null, isoToFrame: null, plotXR: null, plotYR: null }),
};

const polarHandler: ChartTypeHandler = {
    family: animatedRadar,
    /* Radar layout is just the canvas size — sample reads it directly. */
    buildLayout: (_chart, w, h) => Math.min(w, h),
    buildChrome: (chart, layout) => radarChrome(chart, layout as number),
    layoutSize: (_chart, w, h) => {
        const size = Math.min(w, h);
        return { w: size, h: size };
    },
    dragSupport: () => ({ dragResolve: null, isoToFrame: null, plotXR: null, plotYR: null }),
};

const gridHandler: ChartTypeHandler = {
    family: animatedHeatmap,
    /* Grid families take a width/height pair + axesOverride passthrough. */
    buildLayout: (_chart, w, h, axesOverride) => ({ width: w, height: h, axesOverride }),
    buildChrome: (chart, layout) => {
        const l = layout as { width: number; height: number };
        return gridChrome(chart, l.width, l.height);
    },
    layoutSize: (_chart, w, h) => ({ w, h }),
    dragSupport: () => ({ dragResolve: null, isoToFrame: null, plotXR: null, plotYR: null }),
};

const geoHandler: ChartTypeHandler = {
    family: animatedGeo,
    /* The geo family projects lon/lat into this box; it letterboxes internally
     *  to keep the 2:1 world aspect, so any w/h works. No chrome (no axes/
     *  labels) — hover comes from each country polygon's `data` payload. */
    buildLayout: (_chart, w, h) => ({ width: w, height: h }),
    buildChrome: () => ({ elements: [] }),
    layoutSize: (_chart, w, h) => ({ w, h }),
    dragSupport: () => ({ dragResolve: null, isoToFrame: null, plotXR: null, plotYR: null }),
};

/* Per-type entries — each gets its own animated family. The base
 * handlers above provide layout + chrome shared across family-mates. */
const TYPE_HANDLERS: Record<string, ChartTypeHandler> = {
    bar:            { ...cartesianHandler, family: animatedBar },
    'stacked-bar':  { ...cartesianHandler, family: animatedStackedBar },
    area:           { ...cartesianHandler, family: animatedArea },
    sparkline:      { ...cartesianHandler, family: animatedArea },
    'stacked-area': { ...cartesianHandler, family: animatedStackedArea },
    line:           { ...cartesianHandler, family: animatedLine },
    'multi-line':   { ...cartesianHandler, family: animatedMultiLine },
    distribution:   { ...cartesianHandler, family: animatedDistribution },
    waterfall:      { ...cartesianHandler, family: animatedWaterfall },
    scatter:        { ...cartesianHandler, family: animatedScatter },
    bubble:         { ...cartesianHandler, family: animatedBubble },

    pie:            { ...radialHandler, family: animatedPie },
    donut:          { ...radialHandler, family: animatedPie },
    gauge:          { ...radialHandler, family: animatedGauge },
    'progress-ring': { ...radialHandler, family: animatedRing },

    radar:          polarHandler,

    heatmap:        { ...gridHandler, family: animatedHeatmap },
    treemap:        { ...gridHandler, family: animatedTreemap },
    funnel:         { ...gridHandler, family: animatedFunnel },

    choropleth:     geoHandler,
};

export interface FamilyAnimation {
    family: AnyFamily;
    chart: GraphDirective;
    layout: unknown;
    chrome: ChartChrome;
    layoutSize: { w: number; h: number };
    dragResolve: ((viewportX: number, viewportRectWidth: number) => DragEndpoint | null) | null;
    /** Reverse projector: stored iso → endpoint in the CURRENT frame.
     *  Null for non-cartesian families. The renderer uses this to keep
     *  the drag selection glued to its timeline anchor across pan/zoom. */
    isoToFrame: ((iso: string) => DragEndpoint | null) | null;
    /** Plot rectangle in viewBox px — null for non-cartesian families.
     *  Used by `ChartRender` to scope the dotted backdrop layer to the
     *  marks' lane (excluding axis labels / titles). */
    plotXR: [number, number] | null;
    plotYR: [number, number] | null;
}

/** Single entry point used by ChartRender. Resolves the chart's type
 *  to its handler, builds the layout, computes chrome + size + drag
 *  support, and returns the animated family ready to drive the rAF
 *  loop. */
export function buildFamilyAnimation(
    chart: GraphDirective,
    width: number,
    height: number,
    axesOverride?: string,
): FamilyAnimation {
    const handler = TYPE_HANDLERS[chart.type];
    if (!handler) {
        /* Unknown type — return a noop animation that paints nothing. */
        return {
            family: noopFamily,
            chart, layout: null,
            chrome: { elements: [] },
            layoutSize: { w: width, h: height },
            dragResolve: null, isoToFrame: null, plotXR: null, plotYR: null,
        };
    }
    const layout = handler.buildLayout(chart, width, height, axesOverride);
    const chrome = handler.buildChrome(chart, layout);
    const layoutSize = handler.layoutSize(chart, width, height);
    const { dragResolve, isoToFrame, plotXR, plotYR } = handler.dragSupport(chart, layout);
    return {
        family: handler.family,
        chart, layout, chrome, layoutSize,
        dragResolve, isoToFrame, plotXR, plotYR,
    };
}

const noopFamily: AnyFamily = {
    sample: () => ({}),
    lerp: (_p, t) => ({ state: t, maxDelta: 0 }),
    primitives: () => [],
};
