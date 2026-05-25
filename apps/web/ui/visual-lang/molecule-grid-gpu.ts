/// <reference types="@webgpu/types" />
/**
 * Visual language — molecule grid renderer (WebGPU).
 *
 * Same vocabulary as the WebGL2 implementation in molecule-grid.ts:
 * superellipse cell SDF + bloom + iridescence + dormant grey + active
 * region gate. Single render pipeline, uniform buffer, RGBA32Float cell
 * texture sampled per-pixel. Drawn as a 4-vertex triangle-strip covering
 * the whole framebuffer.
 *
 * Public surface intentionally mirrors molecule-grid.ts so that
 * shared-renderer.ts can route to either backend uniformly.
 */

import { MOLECULE_GRID_WGSL } from './molecule-grid-wgsl.js';

/** Same active-region surface as the WebGL implementation. Re-exported
 *  here so consumers don't care which backend is in use. */
export type ActiveRegion =
    | { kind: 'full' }
    | {
        kind: 'annulus';
        cxPx: number; cyPx: number;
        rOuterPx: number; rInnerPx: number;
        startAngle?: number; endAngle?: number;
    }
    | {
        kind: 'rect';
        xPx: number; yPx: number;
        wPx: number; hPx: number;
    };

/* Uniform buffer layout — matches the WGSL `Uniforms` struct exactly.
 * Order and padding are load-bearing: WGSL uniforms follow std140-ish
 * alignment (vec2 = 8B aligned, vec4 = 16B aligned). After all the named
 * fields the struct contains _pad1 + _pad2 to round its size up to a
 * 16-byte multiple (28 f32 = 112 bytes). The buffer must be sized to the
 * full 112; WebGPU's bind-group validator rejects anything smaller even
 * though the trailing slack is never read. */
const UNIFORM_FLOATS = 28;
const UNIFORM_BYTES = UNIFORM_FLOATS * 4;

export interface MoleculeGridGpuProgram {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    uniformBuffer: GPUBuffer;
    /** Reused scratch ArrayBuffer for assembling uniforms before the
     *  single writeBuffer call per draw. */
    uniformScratch: ArrayBuffer;
    uniformF32: Float32Array;
    uniformU32: Uint32Array;
    sampler: GPUSampler;
    /** RGBA32Float storage for cell brightness/color. Reallocated when
     *  cols/rows change. Null until first uploadCellGrid call. */
    cellTexture: GPUTexture | null;
    cellTextureCols: number;
    cellTextureRows: number;
    /** Bind group is rebuilt whenever the cell texture is reallocated. */
    bindGroup: GPUBindGroup | null;
    cleanup: () => void;
}

/** Compile the WGSL module and build the render pipeline. Single
 *  triangle-strip pipeline targeting the canvas's preferred format with
 *  premultiplied-alpha blending (same as the WebGL implementation's
 *  gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)). */
export function createMoleculeGridGpuProgram(
    device: GPUDevice,
    format: GPUTextureFormat,
): MoleculeGridGpuProgram {
    const module = device.createShaderModule({
        label: 'molecule-grid-wgsl',
        code: MOLECULE_GRID_WGSL,
    });

    const bindGroupLayout = device.createBindGroupLayout({
        label: 'molecule-grid-bgl',
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'unfilterable-float' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'non-filtering' } },
        ],
    });

    const pipeline = device.createRenderPipeline({
        label: 'molecule-grid-pipeline',
        layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
        vertex: { module, entryPoint: 'vs_main' },
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
        primitive: { topology: 'triangle-strip' },
    });

    const uniformBuffer = device.createBuffer({
        label: 'molecule-grid-uniforms',
        size: UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformScratch = new ArrayBuffer(UNIFORM_BYTES);

    /* Cell texture is unfilterable-float (rgba32float doesn't support
     * filterable sampling without the float32-filterable feature). The
     * shader samples at level 0 with a non-filtering sampler — same
     * NEAREST behavior as the WebGL implementation. */
    const sampler = device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
        mipmapFilter: 'nearest',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
    });

    return {
        device,
        pipeline,
        uniformBuffer,
        uniformScratch,
        uniformF32: new Float32Array(uniformScratch),
        uniformU32: new Uint32Array(uniformScratch),
        sampler,
        cellTexture: null,
        cellTextureCols: 0,
        cellTextureRows: 0,
        bindGroup: null,
        cleanup: () => {
            uniformBuffer.destroy();
            if (true) { /* texture destroyed below */ }
        },
    };
}

/** Upload a cols × rows grid of (r, g, b, brightness) cell data. Allocates
 *  (or reallocates) the cell texture if the dimensions changed. Same
 *  bottom-up cell convention as the WebGL implementation: gy=0 is the
 *  visual bottom row; the WGSL fragment shader flips the texture-coord Y
 *  on read so the visual orientation matches. */
export function uploadCellGridGpu(
    p: MoleculeGridGpuProgram,
    cols: number,
    rows: number,
    cellData: Float32Array,
): void {
    if (p.cellTextureCols !== cols || p.cellTextureRows !== rows || !p.cellTexture) {
        if (p.cellTexture) p.cellTexture.destroy();
        p.cellTexture = p.device.createTexture({
            label: 'molecule-grid-cells',
            size: { width: cols, height: rows, depthOrArrayLayers: 1 },
            format: 'rgba32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        p.cellTextureCols = cols;
        p.cellTextureRows = rows;
        p.bindGroup = p.device.createBindGroup({
            label: 'molecule-grid-bg',
            layout: p.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: p.uniformBuffer } },
                { binding: 1, resource: p.cellTexture.createView() },
                { binding: 2, resource: p.sampler },
            ],
        });
    }
    /* writeTexture copies straight from the typed-array view. Bytes per
     * row = cols * 4 channels * 4 bytes/channel. WebGPU requires
     * bytesPerRow to be a multiple of 256 only for COPY_TO_BUFFER ops —
     * direct CPU→texture writes have no such constraint. */
    p.device.queue.writeTexture(
        { texture: p.cellTexture! },
        cellData.buffer,
        { offset: cellData.byteOffset, bytesPerRow: cols * 16, rowsPerImage: rows },
        { width: cols, height: rows, depthOrArrayLayers: 1 },
    );
}

/** Encode and submit one draw of the molecule grid to the supplied
 *  framebuffer view (typically the OffscreenCanvas's current context
 *  texture view). Mirrors drawMoleculeGrid in molecule-grid.ts; the
 *  uniforms are packed into a single writeBuffer call before the pass. */
export function drawMoleculeGridGpu(
    p: MoleculeGridGpuProgram,
    cols: number,
    rows: number,
    moleculeTime: number,
    density: number,
    glow: number,
    iridescence: number,
    overflow: number,
    resW: number,
    resH: number,
    targetView: GPUTextureView,
    activeRegion: ActiveRegion = { kind: 'full' },
    dormant: number = 0.02,
    dormantGrey: number = 0.25,
): void {
    if (!p.bindGroup || !p.cellTexture) return; /* uploadCellGrid not yet called */

    const f = p.uniformF32;
    const u = p.uniformU32;
    /* Layout (offsets in floats):
     *  0: moleculeTime, 1: density, 2: glow, 3: iridescence,
     *  4: cols, 5: rows, 6: overflow, 7: aaWidth,
     *  8: resolution.x, 9: resolution.y, 10: activeKind (u32), 11: _pad0,
     * 12: activeCenter.x, 13: activeCenter.y, 14: activeROuter, 15: activeRInner,
     * 16: activeStartAngle, 17: activeEndAngle, 18: activeRectMin.x, 19: activeRectMin.y,
     * 20: activeRectMax.x, 21: activeRectMax.y, 22: dormant, 23: dormantGrey
     * (then _pad1, _pad2 at WGSL level — slack, never read.) */
    f[0] = moleculeTime; f[1] = density; f[2] = glow; f[3] = iridescence;
    f[4] = cols; f[5] = rows; f[6] = overflow;
    const minCellPx = Math.max(1, Math.min(resW / cols, resH / rows));
    f[7] = 1.5 / minCellPx;
    f[8] = resW; f[9] = resH;

    /* Default-zero the active-region fields before branching, matching
     * the WebGL impl's "always-bind every uniform". */
    f[12] = 0; f[13] = 0; f[14] = 0; f[15] = 0;
    f[16] = 0; f[17] = 0;
    f[18] = 0; f[19] = 0; f[20] = 0; f[21] = 0;

    if (activeRegion.kind === 'annulus') {
        u[10] = 1;
        const cyFrag = resH - activeRegion.cyPx;
        f[12] = activeRegion.cxPx; f[13] = cyFrag;
        f[14] = activeRegion.rOuterPx; f[15] = activeRegion.rInnerPx;
        const flipAngle = (a: number) => -a;
        f[16] = flipAngle(activeRegion.endAngle ?? 0);
        f[17] = flipAngle(activeRegion.startAngle ?? 0);
    } else if (activeRegion.kind === 'rect') {
        u[10] = 2;
        const yMinFrag = resH - (activeRegion.yPx + activeRegion.hPx);
        const yMaxFrag = resH - activeRegion.yPx;
        f[18] = activeRegion.xPx; f[19] = yMinFrag;
        f[20] = activeRegion.xPx + activeRegion.wPx; f[21] = yMaxFrag;
    } else {
        u[10] = 0;
    }
    f[22] = dormant; f[23] = dormantGrey;
    /* density read into f[1] above (we keep it here so future shader
     * tweaks that consume `uDensity` don't need a uniform-layout change). */
    f[1] = density;

    p.device.queue.writeBuffer(p.uniformBuffer, 0, p.uniformScratch, 0, UNIFORM_BYTES);

    const encoder = p.device.createCommandEncoder({ label: 'molecule-grid-encoder' });
    const pass = encoder.beginRenderPass({
        label: 'molecule-grid-pass',
        colorAttachments: [{
            view: targetView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
        }],
    });
    pass.setPipeline(p.pipeline);
    pass.setBindGroup(0, p.bindGroup);
    /* 4 vertices, triangle-strip → fullscreen quad. */
    pass.draw(4);
    pass.end();
    p.device.queue.submit([encoder.finish()]);
}
