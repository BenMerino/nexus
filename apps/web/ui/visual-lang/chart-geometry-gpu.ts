/// <reference types="@webgpu/types" />
/**
 * Visual language — chart geometry renderer (WebGPU).
 *
 * Single render pipeline for filled 2D triangles. Each vertex carries
 * (position.xy, color.rgba, frame.xy). Position is in viewBox-space px;
 * color is per-vertex (lets bars carry distinct colors without separate
 * draws); frame.x is the antialiasing distance (0 = soft edge, 1 = solid
 * interior — for crisp bars set frame=1 everywhere, for circles/curves
 * fill it from the SDF).
 *
 * One render pass per frame. Vertex buffer reallocates only when the
 * required size grows; uniforms stream every frame.
 */

import { CHART_GEOMETRY_WGSL } from './chart-geometry-wgsl.js';

/* Uniform layout — std140-ish. resolution(vec2) + 5 floats + 1 pad =
 * 8 floats × 4 bytes = 32 bytes (16-byte aligned). */
const UNIFORM_FLOATS = 8;
const UNIFORM_BYTES = UNIFORM_FLOATS * 4;

/* Vertex layout: 9 floats per vertex
 * (pos.xy, color.rgba, gradRange.xy, bottomMul). */
export const VERTEX_FLOATS = 9;
export const VERTEX_BYTES = VERTEX_FLOATS * 4;
/** MSAA sample count. 4× is the universally-supported value across WebGPU
 *  implementations and gives ~2px effective AA at chart scale — visibly
 *  softer arc edges, pie wedge boundaries, polygon perimeters. Enabled
 *  via the multisample texture pattern (render to MSAA texture, resolve
 *  to canvas texture in the same pass). */
const MSAA_SAMPLES = 4;

export interface ChartGeometryGpuProgram {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    uniformBuffer: GPUBuffer;
    uniformScratch: ArrayBuffer;
    uniformF32: Float32Array;
    bindGroup: GPUBindGroup;
    /** Vertex buffer is grown on demand (multiple of 4 KB pages). */
    vertexBuffer: GPUBuffer | null;
    vertexBufferCapacity: number;
    /** MSAA color attachment, reallocated when canvas size changes. */
    msaaTexture: GPUTexture | null;
    msaaWidth: number;
    msaaHeight: number;
    msaaFormat: GPUTextureFormat;
}

export function createChartGeometryGpuProgram(
    device: GPUDevice,
    format: GPUTextureFormat,
): ChartGeometryGpuProgram {
    const module = device.createShaderModule({
        label: 'chart-geometry-wgsl',
        code: CHART_GEOMETRY_WGSL,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        label: 'chart-geometry-bgl',
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
    });

    const pipeline = device.createRenderPipeline({
        label: 'chart-geometry-pipeline',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: {
            module,
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: VERTEX_BYTES,
                attributes: [
                    { shaderLocation: 0, format: 'float32x2', offset: 0 },           // position
                    { shaderLocation: 1, format: 'float32x4', offset: 8 },           // color
                    { shaderLocation: 2, format: 'float32x2', offset: 24 },          // gradRange (gradTopY, gradBotY)
                    { shaderLocation: 3, format: 'float32',   offset: 32 },          // bottomMul
                ],
            }],
        },
        fragment: {
            module,
            entryPoint: 'fs_main',
            targets: [{
                format,
                blend: {
                    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                },
            }],
        },
        primitive: { topology: 'triangle-list' },
        multisample: { count: MSAA_SAMPLES },
    });

    const uniformBuffer = device.createBuffer({
        label: 'chart-geometry-uniforms',
        size: UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformScratch = new ArrayBuffer(UNIFORM_BYTES);

    const bindGroup = device.createBindGroup({
        label: 'chart-geometry-bg',
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    return {
        device,
        pipeline,
        uniformBuffer,
        uniformScratch,
        uniformF32: new Float32Array(uniformScratch),
        bindGroup,
        vertexBuffer: null,
        vertexBufferCapacity: 0,
        msaaTexture: null,
        msaaWidth: 0,
        msaaHeight: 0,
        msaaFormat: format,
    };
}

/** Ensure the MSAA texture is sized to (w, h). Reallocates on size
 *  change. */
function ensureMsaaTexture(p: ChartGeometryGpuProgram, w: number, h: number): GPUTexture {
    if (p.msaaTexture && p.msaaWidth === w && p.msaaHeight === h) return p.msaaTexture;
    if (p.msaaTexture) p.msaaTexture.destroy();
    p.msaaTexture = p.device.createTexture({
        label: 'chart-geometry-msaa',
        size: { width: w, height: h, depthOrArrayLayers: 1 },
        sampleCount: MSAA_SAMPLES,
        format: p.msaaFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    p.msaaWidth = w;
    p.msaaHeight = h;
    return p.msaaTexture;
}

export interface ChartDrawParams {
    /** Time accumulator for iridescence. */
    time: number;
    /** Glow halo strength. */
    glow: number;
    /** Iridescence shimmer strength. */
    iridescence: number;
    /** Antialiasing band width [0..2]. */
    edgeSoftness: number;
    /** Color saturation multiplier. */
    saturation: number;
}

/** Encode + submit a draw of `triCount` triangles' worth of vertices.
 *  `vertices` must be packed as (pos.xy, color.rgba, frame.xy) per vertex
 *  in the order TRI_LIST expects (3 verts per triangle). */
export function drawChartGeometryGpu(
    p: ChartGeometryGpuProgram,
    vertices: Float32Array,
    triCount: number,
    resW: number,
    resH: number,
    targetView: GPUTextureView,
    params: ChartDrawParams,
): void {
    /* Grow the vertex buffer if needed. WebGPU requires buffer size to be
     * a multiple of 4 bytes; we pad to the next 4 KB so frequent small
     * growths don't hammer the device with reallocations. */
    const bytesNeeded = vertices.byteLength;
    if (!p.vertexBuffer || p.vertexBufferCapacity < bytesNeeded) {
        if (p.vertexBuffer) p.vertexBuffer.destroy();
        const cap = Math.max(4096, Math.ceil(bytesNeeded / 4096) * 4096);
        p.vertexBuffer = p.device.createBuffer({
            label: 'chart-geometry-verts',
            size: cap,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        p.vertexBufferCapacity = cap;
    }
    p.device.queue.writeBuffer(p.vertexBuffer!, 0, vertices.buffer, vertices.byteOffset, bytesNeeded);

    /* Uniforms (std140-ish): resolution.xy at 0..1, time at 2, glow at 3,
     * iridescence at 4, edgeSoftness at 5, saturation at 6, _pad0 at 7. */
    const f = p.uniformF32;
    f[0] = resW; f[1] = resH;
    f[2] = params.time;
    f[3] = params.glow;
    f[4] = params.iridescence;
    f[5] = params.edgeSoftness;
    f[6] = params.saturation;
    f[7] = 0;
    p.device.queue.writeBuffer(p.uniformBuffer, 0, p.uniformScratch, 0, UNIFORM_BYTES);

    /* MSAA: render to a multisampled color attachment, then resolve
     * down to the canvas's regular texture in the same pass. */
    const msaa = ensureMsaaTexture(p, resW, resH);
    const encoder = p.device.createCommandEncoder({ label: 'chart-geometry-encoder' });
    const pass = encoder.beginRenderPass({
        label: 'chart-geometry-pass',
        colorAttachments: [{
            view: msaa.createView(),
            resolveTarget: targetView,
            loadOp: 'clear',
            /* Discard the MSAA samples after resolving — only the
             * resolved single-sample image lands in the canvas. */
            storeOp: 'discard',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
        }],
    });
    pass.setPipeline(p.pipeline);
    pass.setBindGroup(0, p.bindGroup);
    pass.setVertexBuffer(0, p.vertexBuffer!);
    // triCount === 0 is a legitimate frame: a chart with no geometry (empty
    // data, or all series tweened to weight 0 mid-transition). Issuing
    // draw(0) makes WebGPU warn ("Draw with a vertex count of 0 is unusual")
    // and on some backends invalidates the pass. The clear pass above still
    // runs, so the canvas blanks cleanly to "no data" — we just skip the
    // empty draw. This is a robustness invariant: an empty dataset renders
    // nothing, never an error.
    if (triCount > 0) pass.draw(triCount * 3);
    pass.end();
    p.device.queue.submit([encoder.finish()]);
}
