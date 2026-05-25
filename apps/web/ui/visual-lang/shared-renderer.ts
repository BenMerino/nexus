/// <reference types="@webgpu/types" />
/**
 * Visual language — single shared renderer for every molecule canvas on
 * the page. WebGPU-first; falls back to WebGL2 when the browser doesn't
 * expose `navigator.gpu` (Safari ≤25, older mobile, server-side render).
 *
 * One OffscreenCanvas + one render context for the whole page. Each
 * consumer's visible canvas uses the cheap `bitmaprenderer` context (not
 * GPU) and receives an `ImageBitmap` of the rendered frame via
 * `transferToImageBitmap()`. The shared renderer resizes its buffer to
 * the target's pixel dimensions, draws, then transfers — repeat per
 * consumer per frame. Total active GPU contexts: 1.
 *
 * Public API is backend-agnostic — `renderFrame()` takes cell data and
 * uniforms and handles the entire lifecycle (clear, upload, draw,
 * transfer). Consumers never touch GL or GPU state directly. Backend
 * choice is invisible.
 *
 * Acquisition is async (WebGPU's `requestAdapter`/`requestDevice` are
 * promise-returning). The first call kicks off acquisition; subsequent
 * calls return the cached promise. Consumers `await` once at effect
 * setup; the result lives for the lifetime of the page.
 *
 * Backend-specific acquisition + draw bodies live in
 * `shared-renderer-webgpu.ts` and `shared-renderer-webgl2.ts`; this
 * file is the router + the public types.
 */

import type { ActiveRegion } from './molecule-grid.js';
import type { ChartDrawParams as ChartDrawParamsBase } from './chart-geometry-gpu.js';
import { tryAcquireWebGpu } from './shared-renderer-webgpu.js';
import { tryAcquireWebGl2 } from './shared-renderer-webgl2.js';

export type { ActiveRegion } from './molecule-grid.js';
export type { ChartDrawParams } from './chart-geometry-gpu.js';

export interface DrawParams {
    moleculeTime: number;
    density: number;
    glow: number;
    iridescence: number;
    overflow: number;
    activeRegion?: ActiveRegion;
    /** Dormant cell body brightness [0..1]. Falls back to engine default. */
    dormantBrightness?: number;
    /** Dormant cell grey overlay alpha [0..1]. Falls back to engine default. */
    dormantGreyAlpha?: number;
}

export interface SharedRenderer {
    backend: 'webgpu' | 'webgl2';
    /** Render one molecule-grid frame (LoaderMolecule path). */
    renderFrame(
        bitmapCtx: ImageBitmapRenderingContext,
        wPx: number, hPx: number,
        cols: number, rows: number,
        cellData: Float32Array,
        params: DrawParams,
    ): void;
    /** Render one chart frame from a packed triangle vertex buffer.
     *  `vertices` is a Float32Array of (pos.xy, color.rgba, frame.xy) per
     *  vertex (8 floats × 3 verts per triangle). All chart families feed
     *  through this single API. */
    renderChart(
        bitmapCtx: ImageBitmapRenderingContext,
        wPx: number, hPx: number,
        vertices: Float32Array,
        triCount: number,
        params: ChartDrawParamsBase,
    ): void;
}

let acquisition: Promise<SharedRenderer | null> | null = null;

/** Acquire (or reuse) the shared renderer. Resolves to null on SSR or
 *  when neither WebGPU nor WebGL2 is available (very rare — basically
 *  ancient browsers). Cached: every call after the first returns the
 *  same promise. */
export function acquireSharedRenderer(): Promise<SharedRenderer | null> {
    if (acquisition) return acquisition;
    acquisition = doAcquire();
    return acquisition;
}

async function doAcquire(): Promise<SharedRenderer | null> {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const gpu = await tryAcquireWebGpu();
    if (gpu) return gpu;
    return tryAcquireWebGl2();
}

/* Dev-only HMR: when the WGSL or GLSL source modules change, drop the
 * cached renderer so the next render compiles fresh shaders. */
const hot = (import.meta as unknown as { hot?: { accept(dep: string, cb: () => void): void; dispose(cb: () => void): void } }).hot;
if (hot) {
    hot.accept('./molecule-grid.js', () => { acquisition = null; });
    hot.accept('./molecule-grid-gpu.js', () => { acquisition = null; });
    hot.accept('./molecule-grid-shaders.js', () => { acquisition = null; });
    hot.accept('./molecule-grid-wgsl.js', () => { acquisition = null; });
    hot.accept('./chart-geometry-gpu.js', () => { acquisition = null; });
    hot.accept('./chart-geometry-gl.js', () => { acquisition = null; });
    hot.accept('./chart-geometry-wgsl.js', () => { acquisition = null; });
    hot.accept('./chart-geometry-shaders.js', () => { acquisition = null; });
    hot.accept('./chart-bloom-gpu.js', () => { acquisition = null; });
    hot.accept('./chart-bloom-wgsl.js', () => { acquisition = null; });
    hot.accept('./chart-bloom-gl.js', () => { acquisition = null; });
    hot.accept('./chart-bloom-shaders.js', () => { acquisition = null; });
    hot.accept('./shared-renderer-webgpu.js', () => { acquisition = null; });
    hot.accept('./shared-renderer-webgl2.js', () => { acquisition = null; });
    hot.dispose(() => { acquisition = null; });
}
