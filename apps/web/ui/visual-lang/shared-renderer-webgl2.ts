/**
 * WebGL2 acquisition + per-frame draw bodies for the shared renderer.
 * Used as fallback when WebGPU is unavailable. Extracted from
 * shared-renderer.ts to keep it under the NBR-15 line ceiling.
 */

import {
    createMoleculeGridProgram,
    uploadCellGrid as uploadCellGridGl,
    drawMoleculeGrid as drawMoleculeGridGl,
    type MoleculeGridProgram,
} from './molecule-grid.js';
import {
    createChartGeometryGlProgram,
    drawChartGeometryGl,
    type ChartGeometryGlProgram,
} from './chart-geometry-gl.js';
import {
    createChartBloomGlProgram,
    ensureBloomFBOsGl,
    bindGeometryFBOGl,
    resolveGeometryFBOGl,
    runBloomChainGl,
    type ChartBloomGlProgram,
} from './chart-bloom-gl.js';
import type { SharedRenderer } from './shared-renderer.js';

export interface WebGl2Renderer extends SharedRenderer {
    backend: 'webgl2';
    canvas: OffscreenCanvas;
    gl: WebGL2RenderingContext;
    grid: MoleculeGridProgram;
    chart: ChartGeometryGlProgram;
    bloom: ChartBloomGlProgram;
}

export function tryAcquireWebGl2(): WebGl2Renderer | null {
    const canvas = new OffscreenCanvas(1, 1);
    const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true, alpha: true });
    if (!gl) return null;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const grid = createMoleculeGridProgram(gl);
    if (!grid) return null;
    const chart = createChartGeometryGlProgram(gl);
    if (!chart) return null;
    const bloom = createChartBloomGlProgram(gl);
    if (!bloom) return null;
    /* SDR fallback: one shared GL context draws to the offscreen canvas,
     * each visible canvas presents via its own cheap `bitmaprenderer`
     * context (cached by element). No HDR — the ImageBitmap hop is 8-bit. */
    const bitmapCtxs = new WeakMap<HTMLCanvasElement, ImageBitmapRenderingContext>();
    const bitmapCtxFor = (target: HTMLCanvasElement): ImageBitmapRenderingContext | null => {
        let b = bitmapCtxs.get(target);
        if (!b) {
            b = target.getContext('bitmaprenderer');
            if (!b) return null;
            bitmapCtxs.set(target, b);
        }
        return b;
    };
    return {
        backend: 'webgl2',
        hdr: false,
        canvas, gl, grid, chart, bloom,
        renderFrame(targetCanvas, wPx, hPx, cols, rows, cellData, params) {
            const bitmapCtx = bitmapCtxFor(targetCanvas);
            if (!bitmapCtx) return;
            if (canvas.width !== wPx) canvas.width = wPx;
            if (canvas.height !== hPx) canvas.height = hPx;
            gl.viewport(0, 0, wPx, hPx);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            uploadCellGridGl(grid, cols, rows, cellData);
            drawMoleculeGridGl(
                grid, cols, rows,
                params.moleculeTime, params.density,
                params.glow, params.iridescence, params.overflow,
                wPx, hPx,
                params.activeRegion ?? { kind: 'full' },
                params.dormantBrightness ?? 0.02,
                params.dormantGreyAlpha ?? 0.25,
            );
            const bitmap = canvas.transferToImageBitmap();
            bitmapCtx.transferFromImageBitmap(bitmap);
        },
        renderChart(targetCanvas, wPx, hPx, vertices, triCount, params) {
            const bitmapCtx = bitmapCtxFor(targetCanvas);
            if (!bitmapCtx) return;
            if (canvas.width !== wPx) canvas.width = wPx;
            if (canvas.height !== hPx) canvas.height = hPx;
            const useBloom = (params.glow ?? 0) > 0.001;
            if (useBloom) {
                /* Bloom path: render geometry into the MSAA renderbuffer
                 * FBO, resolve to the single-sample texture, then run
                 * extract → blur H → blur V → composite to canvas. */
                ensureBloomFBOsGl(bloom, wPx, hPx);
                bindGeometryFBOGl(bloom);
                gl.viewport(0, 0, wPx, hPx);
                gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                const geomParams = { ...params, glow: 0 };
                drawChartGeometryGl(chart, vertices, triCount, wPx, hPx, geomParams);
                resolveGeometryFBOGl(bloom, wPx, hPx);
                const threshold = Math.max(0.02, 0.3 - params.glow * 0.1);
                const intensity = params.glow * 4.0;
                runBloomChainGl(bloom, wPx, hPx, threshold, intensity);
            } else {
                /* Fast path — straight to canvas, zero bloom overhead. */
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, wPx, hPx);
                gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
                drawChartGeometryGl(chart, vertices, triCount, wPx, hPx, params);
            }
            const bitmap = canvas.transferToImageBitmap();
            bitmapCtx.transferFromImageBitmap(bitmap);
        },
    };
}
