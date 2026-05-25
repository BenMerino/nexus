/// <reference types="@webgpu/types" />
/**
 * Multi-pass bloom for the chart geometry pipeline.
 *
 * Render flow when `glow > 0`:
 *   1. Geometry pass renders to `geometryTex` (full-res, single-sample,
 *      MSAA-resolved from the existing chart-geometry pipeline).
 *   2. Bright-extract pass reads `geometryTex`, writes `bloomA` at half
 *      resolution.
 *   3. Blur passes ping-pong between `bloomA` and `bloomB`: H then V.
 *   4. Composite pass reads `geometryTex` + `bloomB`, writes the canvas.
 *
 * When `glow === 0`, the entire chain is skipped and the geometry pass
 * renders directly to the canvas — zero overhead path.
 */

import { CHART_BLOOM_WGSL } from './chart-bloom-wgsl.js';

const UNIFORM_FLOATS = 8;
const UNIFORM_BYTES = UNIFORM_FLOATS * 4;

export interface ChartBloomGpuProgram {
    device: GPUDevice;
    format: GPUTextureFormat;
    extractPipeline: GPURenderPipeline;
    blurPipeline: GPURenderPipeline;
    compositePipeline: GPURenderPipeline;
    extractLayout: GPUBindGroupLayout;
    compositeLayout: GPUBindGroupLayout;
    uniformBuffer: GPUBuffer;
    uniformScratch: ArrayBuffer;
    uniformF32: Float32Array;
    sampler: GPUSampler;
    /** Cached textures, reallocated when canvas size changes. */
    geometryTex: GPUTexture | null;
    bloomA: GPUTexture | null;
    bloomB: GPUTexture | null;
    cacheW: number;
    cacheH: number;
}

export function createChartBloomGpuProgram(
    device: GPUDevice,
    format: GPUTextureFormat,
): ChartBloomGpuProgram {
    const module = device.createShaderModule({
        label: 'chart-bloom-wgsl',
        code: CHART_BLOOM_WGSL,
    });

    const extractLayout = device.createBindGroupLayout({
        label: 'chart-bloom-extract-bgl',
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
    });
    const compositeLayout = device.createBindGroupLayout({
        label: 'chart-bloom-composite-bgl',
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        ],
    });

    const blendOpaque = {
        color: { srcFactor: 'one' as const, dstFactor: 'zero' as const, operation: 'add' as const },
        alpha: { srcFactor: 'one' as const, dstFactor: 'zero' as const, operation: 'add' as const },
    };
    const blendPremul = {
        color: { srcFactor: 'one' as const, dstFactor: 'one-minus-src-alpha' as const, operation: 'add' as const },
        alpha: { srcFactor: 'one' as const, dstFactor: 'one-minus-src-alpha' as const, operation: 'add' as const },
    };

    const extractPipeline = device.createRenderPipeline({
        label: 'chart-bloom-extract',
        layout: device.createPipelineLayout({ bindGroupLayouts: [extractLayout] }),
        vertex: { module, entryPoint: 'vs_fullscreen' },
        fragment: { module, entryPoint: 'fs_extract', targets: [{ format, blend: blendOpaque }] },
        primitive: { topology: 'triangle-list' },
    });
    const blurPipeline = device.createRenderPipeline({
        label: 'chart-bloom-blur',
        layout: device.createPipelineLayout({ bindGroupLayouts: [extractLayout] }),
        vertex: { module, entryPoint: 'vs_fullscreen' },
        fragment: { module, entryPoint: 'fs_blur', targets: [{ format, blend: blendOpaque }] },
        primitive: { topology: 'triangle-list' },
    });
    const compositePipeline = device.createRenderPipeline({
        label: 'chart-bloom-composite',
        layout: device.createPipelineLayout({ bindGroupLayouts: [compositeLayout] }),
        vertex: { module, entryPoint: 'vs_fullscreen' },
        fragment: { module, entryPoint: 'fs_composite', targets: [{ format, blend: blendPremul }] },
        primitive: { topology: 'triangle-list' },
    });

    const uniformBuffer = device.createBuffer({
        label: 'chart-bloom-uniforms',
        size: UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformScratch = new ArrayBuffer(UNIFORM_BYTES);

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
    });

    return {
        device, format,
        extractPipeline, blurPipeline, compositePipeline,
        extractLayout, compositeLayout,
        uniformBuffer, uniformScratch,
        uniformF32: new Float32Array(uniformScratch),
        sampler,
        geometryTex: null, bloomA: null, bloomB: null,
        cacheW: 0, cacheH: 0,
    };
}

/** Ensure the geometry texture and bloom ping-pong buffers exist at the
 *  given canvas dimensions. Half-resolution bloom buffers — adequate for
 *  soft-halo bloom, 4× cheaper than full-res. Returns the geometry view
 *  the geometry pipeline should render INTO. */
export function ensureBloomTextures(
    p: ChartBloomGpuProgram,
    canvasW: number,
    canvasH: number,
): { geometryView: GPUTextureView } {
    if (p.geometryTex && p.cacheW === canvasW && p.cacheH === canvasH) {
        return { geometryView: p.geometryTex.createView() };
    }
    if (p.geometryTex) p.geometryTex.destroy();
    if (p.bloomA) p.bloomA.destroy();
    if (p.bloomB) p.bloomB.destroy();
    p.geometryTex = p.device.createTexture({
        label: 'chart-geometry-color',
        size: { width: canvasW, height: canvasH, depthOrArrayLayers: 1 },
        format: p.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const halfW = Math.max(1, Math.floor(canvasW / 2));
    const halfH = Math.max(1, Math.floor(canvasH / 2));
    p.bloomA = p.device.createTexture({
        label: 'chart-bloom-a',
        size: { width: halfW, height: halfH, depthOrArrayLayers: 1 },
        format: p.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    p.bloomB = p.device.createTexture({
        label: 'chart-bloom-b',
        size: { width: halfW, height: halfH, depthOrArrayLayers: 1 },
        format: p.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    p.cacheW = canvasW;
    p.cacheH = canvasH;
    return { geometryView: p.geometryTex.createView() };
}

/** Number of H+V Gaussian blur iterations. Each pair of passes spreads
 *  the halo further; with σ=2 9-tap kernel at half-res, 12 iterations
 *  give ~70px of bleed in source-canvas pixels — wide enough for a
 *  smooth diffuse halo without visible banding from over-strided
 *  sampling. Two pyramid levels would be cheaper, but at this iteration
 *  count we're still well under 1ms per chart frame. */
const BLUR_ITERATIONS = 12;

/** Run the full bloom chain: extract → N×(blur H + blur V) → composite
 *  to `canvasView`. Caller is responsible for the geometry pass writing
 *  into `geometryTex` BEFORE this is invoked. */
export function runBloomChain(
    p: ChartBloomGpuProgram,
    canvasView: GPUTextureView,
    canvasW: number,
    canvasH: number,
    threshold: number,
    intensity: number,
): void {
    if (!p.geometryTex || !p.bloomA || !p.bloomB) return;
    const halfW = Math.max(1, Math.floor(canvasW / 2));
    const halfH = Math.max(1, Math.floor(canvasH / 2));
    const f = p.uniformF32;

    /* Sub-helper: write the current scratch into the uniform buffer
     * AND submit a one-pass command buffer immediately. Doing each
     * pass in its own submission guarantees writeBuffer-then-draw
     * ordering — the alternative (one big encoder, multiple
     * writeBuffers to the same offset) reads the FINAL value in every
     * pass, which is why early versions of this had only-vertical
     * blur. */
    const submitOnePass = (
        targetView: GPUTextureView,
        pipeline: GPURenderPipeline,
        bindGroup: GPUBindGroup,
    ): void => {
        const encoder = p.device.createCommandEncoder({ label: 'chart-bloom-pass' });
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: targetView,
                loadOp: 'clear', storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
            }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();
        p.device.queue.submit([encoder.finish()]);
    };

    /* 1. Extract: geometryTex → bloomA at half-res. */
    f[0] = 1 / canvasW; f[1] = 1 / canvasH;
    f[2] = threshold; f[3] = 0; f[4] = 0;
    f[5] = 0; f[6] = 0; f[7] = 0;
    p.device.queue.writeBuffer(p.uniformBuffer, 0, p.uniformScratch, 0, UNIFORM_BYTES);
    submitOnePass(
        p.bloomA.createView(),
        p.extractPipeline,
        p.device.createBindGroup({
            layout: p.extractLayout,
            entries: [
                { binding: 0, resource: { buffer: p.uniformBuffer } },
                { binding: 1, resource: p.geometryTex.createView() },
                { binding: 2, resource: p.sampler },
            ],
        }),
    );

    /* 2. Repeated H+V blur passes ping-ponging A ↔ B. */
    for (let iter = 0; iter < BLUR_ITERATIONS; iter++) {
        /* Blur H: A → B. */
        f[0] = 1 / halfW; f[1] = 1 / halfH;
        f[2] = 0; f[3] = 0; f[4] = 0; /* axis=0 (horizontal) */
        f[5] = 0; f[6] = 0; f[7] = 0;
        p.device.queue.writeBuffer(p.uniformBuffer, 0, p.uniformScratch, 0, UNIFORM_BYTES);
        submitOnePass(
            p.bloomB.createView(),
            p.blurPipeline,
            p.device.createBindGroup({
                layout: p.extractLayout,
                entries: [
                    { binding: 0, resource: { buffer: p.uniformBuffer } },
                    { binding: 1, resource: p.bloomA.createView() },
                    { binding: 2, resource: p.sampler },
                ],
            }),
        );
        /* Blur V: B → A. */
        f[4] = 1; /* axis=1 (vertical) */
        p.device.queue.writeBuffer(p.uniformBuffer, 0, p.uniformScratch, 0, UNIFORM_BYTES);
        submitOnePass(
            p.bloomA.createView(),
            p.blurPipeline,
            p.device.createBindGroup({
                layout: p.extractLayout,
                entries: [
                    { binding: 0, resource: { buffer: p.uniformBuffer } },
                    { binding: 1, resource: p.bloomB.createView() },
                    { binding: 2, resource: p.sampler },
                ],
            }),
        );
    }

    /* 3. Composite: geometryTex + bloomA → canvas. */
    f[0] = 1 / canvasW; f[1] = 1 / canvasH;
    f[2] = 0; f[3] = intensity; f[4] = 0;
    f[5] = 0; f[6] = 0; f[7] = 0;
    p.device.queue.writeBuffer(p.uniformBuffer, 0, p.uniformScratch, 0, UNIFORM_BYTES);
    {
        const bg = p.device.createBindGroup({
            layout: p.compositeLayout,
            entries: [
                { binding: 0, resource: { buffer: p.uniformBuffer } },
                { binding: 1, resource: p.geometryTex.createView() },
                { binding: 2, resource: p.sampler },
                { binding: 3, resource: p.bloomA.createView() },
            ],
        });
        const encoder = p.device.createCommandEncoder({ label: 'chart-bloom-composite-encoder' });
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: canvasView,
                loadOp: 'clear', storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
            }],
        });
        pass.setPipeline(p.compositePipeline);
        pass.setBindGroup(0, bg);
        pass.draw(3);
        pass.end();
        p.device.queue.submit([encoder.finish()]);
    }
}
