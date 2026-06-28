/// <reference types="@webgpu/types" />
/**
 * Per-frame execution of the chart bloom chain (extract → N×blur → composite).
 * Split from `chart-bloom-gpu.ts` (program creation + texture allocation) to
 * keep each under the NBR-15 ceiling — this file owns the runtime passes, that
 * one owns the pipelines/layouts/buffers.
 */

import { type ChartBloomGpuProgram, UNIFORM_BYTES } from './chart-bloom-gpu.js';

/** Default H+V Gaussian blur iterations. Each pair spreads the halo further;
 *  with σ=2 9-tap at half-res, 12 iterations give ~70px of bleed in source px
 *  — wide enough for a smooth diffuse halo. Callers can pass fewer for a
 *  tighter, shorter glow. */
const DEFAULT_BLUR_ITERATIONS = 12;

/** Run the full bloom chain: extract → N×(blur H + blur V) → composite to
 *  `canvasView`. Caller must run the geometry pass into `geometryTex` first.
 *  `baseMix` 1 = normal (crisp band over halo); 0 = halo only (no border).
 *  `blurIterations` controls halo reach (lower = shorter/tighter glow). */
export function runBloomChain(
    p: ChartBloomGpuProgram,
    canvasView: GPUTextureView,
    canvasW: number,
    canvasH: number,
    threshold: number,
    intensity: number,
    baseMix = 1,
    blurIterations = DEFAULT_BLUR_ITERATIONS,
): void {
    if (!p.geometryTex || !p.bloomA || !p.bloomB) return;
    const halfW = Math.max(1, Math.floor(canvasW / 2));
    const halfH = Math.max(1, Math.floor(canvasH / 2));
    const f = p.uniformF32;

    /* Sub-helper: write the current scratch into the uniform buffer AND submit
     * a one-pass command buffer immediately. Per-pass submission guarantees
     * writeBuffer-then-draw ordering (one big encoder reusing the same offset
     * reads the FINAL value in every pass). */
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
    for (let iter = 0; iter < blurIterations; iter++) {
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

    /* 3. Composite: geometryTex + bloomA → canvas. f[5]=baseMix (0=halo only). */
    f[0] = 1 / canvasW; f[1] = 1 / canvasH;
    f[2] = 0; f[3] = intensity; f[4] = 0;
    f[5] = baseMix; f[6] = 0; f[7] = 0;
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
