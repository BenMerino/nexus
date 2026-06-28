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
export const UNIFORM_BYTES = UNIFORM_FLOATS * 4;

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
    canvasFormat: GPUTextureFormat,
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
    /* Composite writes the VISIBLE canvas, so its target is the canvas's
     * presentation format (preferred / bgra8unorm), not the rgba16float
     * used for the offscreen bloom/geometry intermediates. Safari ≤27
     * cannot present rgba16float — configuring the canvas with it composites
     * opaque-black and the page never shows through. Extract/blur above
     * write offscreen, so they stay `format`. */
    const compositePipeline = device.createRenderPipeline({
        label: 'chart-bloom-composite',
        layout: device.createPipelineLayout({ bindGroupLayouts: [compositeLayout] }),
        vertex: { module, entryPoint: 'vs_fullscreen' },
        fragment: { module, entryPoint: 'fs_composite', targets: [{ format: canvasFormat, blend: blendPremul }] },
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
