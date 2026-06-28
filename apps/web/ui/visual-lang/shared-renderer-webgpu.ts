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
    type ChartBloomGpuProgram,
} from './chart-bloom-gpu.js';
import { runBloomChain } from './chart-bloom-gpu-run.js';
import type { SharedRenderer } from './shared-renderer.js';

export interface WebGpuRenderer extends SharedRenderer {
    backend: 'webgpu';
    device: GPUDevice;
    format: GPUTextureFormat;
    grid: MoleculeGridGpuProgram;
    /** Geometry program whose pipeline targets the offscreen HDR
     *  (rgba16float) texture — used on the bloom path. */
    chart: ChartGeometryGpuProgram;
    /** Geometry program whose pipeline targets the visible canvas
     *  (presentation format) — used on the zero-bloom fast path. */
    chartCanvas: ChartGeometryGpuProgram;
    bloom: ChartBloomGpuProgram;
}

/* Internal HDR format for OFFSCREEN render targets (geometry texture, bloom
 * ping-pong, MSAA). rgba16float gives headroom above SDR white so the bloom
 * math keeps full precision. Every browser supports it as a render-attachment
 * texture — the Safari limitation is only about PRESENTING it on a canvas. */
const HDR_FORMAT: GPUTextureFormat = 'rgba16float';

export async function tryAcquireWebGpu(): Promise<WebGpuRenderer | null> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
        return null;
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return null;
        const device = await adapter.requestDevice();

        /* The visible canvas is presented in the browser's preferred format
         * (bgra8unorm everywhere). rgba16float is NOT a presentable canvas
         * format on Safari ≤27 — configuring the canvas with it composites
         * opaque-black, hiding the page behind the canvas. Offscreen targets
         * keep HDR_FORMAT. Pipelines that write the canvas (molecule grid,
         * zero-bloom geometry, bloom composite) are built against canvasFormat;
         * pipelines that write offscreen (bloom-path geometry, extract, blur)
         * against HDR_FORMAT. */
        const format = HDR_FORMAT;
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        const grid = createMoleculeGridGpuProgram(device, canvasFormat);
        const chart = createChartGeometryGpuProgram(device, format);
        const chartCanvas = createChartGeometryGpuProgram(device, canvasFormat);
        const bloom = createChartBloomGpuProgram(device, format, canvasFormat);

        /* Per-visible-canvas swapchain. The device + pipelines above are
         * shared; each consumer canvas gets its own `webgpu` context
         * configured against that device, cached by element. Rendering
         * straight into the visible canvas (vs. the old offscreen +
         * bitmaprenderer transfer) is what keeps the HDR signal intact —
         * an ImageBitmap hop would clamp it to 8-bit SDR. */
        const contexts = new WeakMap<HTMLCanvasElement, GPUCanvasContext>();
        const targetView = (canvas: HTMLCanvasElement, wPx: number, hPx: number): GPUTextureView => {
            let ctx = contexts.get(canvas);
            if (!ctx) {
                ctx = canvas.getContext('webgpu') as GPUCanvasContext;
                ctx.configure({
                    device,
                    format: canvasFormat,
                    alphaMode: 'premultiplied',
                    /* `extended`: map values >1.0 into the display's HDR headroom
                     * so a brighter-than-white lobe reads as genuinely above SDR
                     * white on an HDR panel (clamps to white on SDR displays).
                     *
                     * The earlier light-bg INVERSION (a bright lobe composited
                     * DARKER than white) came from bright-but-TRANSLUCENT pixels:
                     * premultiplied (rgb≫1, a<1) un-premultiplies to an enormous
                     * color the extended path then composites below page luminance.
                     * The fix lives at the source — `paintAiGlowRing` now couples
                     * alpha to brightness, so wherever the glow is bright it is
                     * also opaque (no bright-translucent fringe to invert). */
                    toneMapping: { mode: 'extended' },
                });
                contexts.set(canvas, ctx);
            }
            if (canvas.width !== wPx) canvas.width = wPx;
            if (canvas.height !== hPx) canvas.height = hPx;
            return ctx.getCurrentTexture().createView();
        };

        return {
            backend: 'webgpu',
            hdr: true,
            device, format, grid, chart, chartCanvas, bloom,
            renderFrame(canvas, wPx, hPx, cols, rows, cellData, params) {
                const view = targetView(canvas, wPx, hPx);
                uploadCellGridGpu(grid, cols, rows, cellData);
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
            },
            renderChart(canvas, wPx, hPx, vertices, triCount, params) {
                const canvasView = targetView(canvas, wPx, hPx);
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
                    /* Bloom intensity: charts scale ×4 (diffuse spread); the AI
                     * glow overrides via bloomGain (the 4× was the supernova —
                     * way too hot for a thin edge glow seen through glass). */
                    const intensity = params.glow * (params.bloomGain ?? 4.0);
                    /* bloomOnly → don't composite the crisp band; halo only.
                     * bloomSpread → halo reach (fewer blur iterations = shorter). */
                    runBloomChain(bloom, canvasView, wPx, hPx, threshold, intensity,
                        params.bloomOnly ? 0 : 1, params.bloomSpread);
                } else {
                    /* Fast path — straight to canvas, zero bloom overhead.
                     * Uses chartCanvas (pipeline + MSAA target in the canvas's
                     * presentation format), not chart (rgba16float, offscreen
                     * only) — the MSAA resolve target must match the canvas. */
                    drawChartGeometryGpu(chartCanvas, vertices, triCount, wPx, hPx, canvasView, params);
                }
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
