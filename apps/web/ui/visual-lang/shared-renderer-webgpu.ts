/// <reference types="@webgpu/types" />
/**
 * WebGPU acquisition + per-frame draw bodies for the shared renderer.
 * Extracted from shared-renderer.ts to keep that file under the
 * NBR-15 line ceiling. Exported via tryAcquireWebGpu(); the router in
 * shared-renderer.ts decides whether to call it.
 */

import {
    createMoleculeGridGpuProgram,
    uploadCellGridGpu,
    drawMoleculeGridGpu,
    type MoleculeGridGpuProgram,
} from './molecule-grid-gpu.js';
import {
    createChartGeometryGpuProgram,
    drawChartGeometryGpu,
    type ChartGeometryGpuProgram,
} from './chart-geometry-gpu.js';
import {
    createChartBloomGpuProgram,
    ensureBloomTextures,
    runBloomChain,
    type ChartBloomGpuProgram,
} from './chart-bloom-gpu.js';
import type { SharedRenderer } from './shared-renderer.js';

export interface WebGpuRenderer extends SharedRenderer {
    backend: 'webgpu';
    canvas: OffscreenCanvas;
    device: GPUDevice;
    ctx: GPUCanvasContext;
    format: GPUTextureFormat;
    grid: MoleculeGridGpuProgram;
    chart: ChartGeometryGpuProgram;
    bloom: ChartBloomGpuProgram;
}

export async function tryAcquireWebGpu(): Promise<WebGpuRenderer | null> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
        return null;
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return null;
        const device = await adapter.requestDevice();

        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null;
        if (!ctx) return null;
        const format = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({
            device,
            format,
            alphaMode: 'premultiplied',
        });
        const grid = createMoleculeGridGpuProgram(device, format);
        const chart = createChartGeometryGpuProgram(device, format);
        const bloom = createChartBloomGpuProgram(device, format);
        return {
            backend: 'webgpu',
            canvas, device, ctx, format, grid, chart, bloom,
            renderFrame(bitmapCtx, wPx, hPx, cols, rows, cellData, params) {
                if (canvas.width !== wPx) canvas.width = wPx;
                if (canvas.height !== hPx) canvas.height = hPx;
                uploadCellGridGpu(grid, cols, rows, cellData);
                const view = ctx.getCurrentTexture().createView();
                drawMoleculeGridGpu(
                    grid, cols, rows,
                    params.moleculeTime, params.density,
                    params.glow, params.iridescence, params.overflow,
                    wPx, hPx,
                    view,
                    params.activeRegion ?? { kind: 'full' },
                    params.dormantBrightness ?? 0.02,
                    params.dormantGreyAlpha ?? 0.25,
                );
                const bitmap = canvas.transferToImageBitmap();
                bitmapCtx.transferFromImageBitmap(bitmap);
            },
            renderChart(bitmapCtx, wPx, hPx, vertices, triCount, params) {
                if (canvas.width !== wPx) canvas.width = wPx;
                if (canvas.height !== hPx) canvas.height = hPx;
                const canvasView = ctx.getCurrentTexture().createView();
                /* Bloom path: render geometry to offscreen, then run
                 * extract→blur→composite to canvas. */
                if ((params.glow ?? 0) > 0.001) {
                    const { geometryView } = ensureBloomTextures(bloom, wPx, hPx);
                    /* Geometry pass: glow=0 in shader (we apply bloom
                     * additively after), so the offscreen texture holds
                     * the unboosted color. */
                    const geomParams = { ...params, glow: 0 };
                    drawChartGeometryGpu(chart, vertices, triCount, wPx, hPx, geometryView, geomParams);
                    /* 12 narrow-kernel blur iterations produce a
                     * smooth diffuse cloud. Intensity scaled to 4×
                     * since the per-pixel bloom value is more spread
                     * out than with the previous wide-stride kernel. */
                    const threshold = Math.max(0.02, 0.3 - params.glow * 0.1);
                    const intensity = params.glow * 4.0;
                    runBloomChain(bloom, canvasView, wPx, hPx, threshold, intensity);
                } else {
                    /* Fast path — straight to canvas, zero bloom overhead. */
                    drawChartGeometryGpu(chart, vertices, triCount, wPx, hPx, canvasView, params);
                }
                const bitmap = canvas.transferToImageBitmap();
                bitmapCtx.transferFromImageBitmap(bitmap);
            },
        };
    } catch (err) {
        /* Any acquisition failure (lost device, shader compile error,
         * unsupported features) drops to WebGL2 fallback. Logged so we
         * notice silent regressions in dev. */
        console.warn('[visual-lang] WebGPU acquisition failed, falling back to WebGL2:', err);
        return null;
    }
}
