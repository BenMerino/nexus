/**
 * WebGL2 mirror of chart-bloom-gpu.ts. Renders the bloom chain via
 * framebuffer objects bound to color textures.
 *
 * Three programs, three FBO+texture pairs (geometryFB, bloomA, bloomB),
 * one fullscreen-triangle VAO shared across all draws. Caller calls
 * `ensureBloomFBOsGl(gl, p, w, h)` and `runBloomChainGl(...)` around
 * the existing geometry pipeline.
 */

import { compileShader, linkProgram } from './gl-boot.js';
import {
    BLOOM_VS,
    BLOOM_EXTRACT_FS,
    BLOOM_BLUR_FS,
    BLOOM_COMPOSITE_FS,
} from './chart-bloom-shaders.js';

export interface ChartBloomGlProgram {
    gl: WebGL2RenderingContext;
    extract: WebGLProgram;
    blur: WebGLProgram;
    composite: WebGLProgram;
    uniforms: {
        extract: { uSrc: WebGLUniformLocation | null; uThreshold: WebGLUniformLocation | null };
        blur: { uSrc: WebGLUniformLocation | null; uTexel: WebGLUniformLocation | null; uAxis: WebGLUniformLocation | null };
        composite: { uBase: WebGLUniformLocation | null; uBloom: WebGLUniformLocation | null; uIntensity: WebGLUniformLocation | null };
    };
    vao: WebGLVertexArrayObject;
    /** Geometry rendering uses an MSAA renderbuffer FBO; we then blit
     *  the result into the single-sample `geometryTex` FBO for
     *  subsequent sampling. Without this 2-FBO pattern, WebGL2 in
     *  bloom-path loses MSAA (texture-backed FBOs aren't multisampled),
     *  producing aliased edges. */
    geometryMsaaFB: WebGLFramebuffer | null;
    geometryMsaaRB: WebGLRenderbuffer | null;
    geometryFB: WebGLFramebuffer | null;
    geometryTex: WebGLTexture | null;
    bloomFB_A: WebGLFramebuffer | null;
    bloomTex_A: WebGLTexture | null;
    bloomFB_B: WebGLFramebuffer | null;
    bloomTex_B: WebGLTexture | null;
    cacheW: number;
    cacheH: number;
}

export function createChartBloomGlProgram(gl: WebGL2RenderingContext): ChartBloomGlProgram | null {
    const vs = compileShader(gl, gl.VERTEX_SHADER, BLOOM_VS);
    if (!vs) return null;
    const extractFs = compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_EXTRACT_FS);
    const blurFs = compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_BLUR_FS);
    const compositeFs = compileShader(gl, gl.FRAGMENT_SHADER, BLOOM_COMPOSITE_FS);
    if (!extractFs || !blurFs || !compositeFs) return null;
    const extract = linkProgram(gl, vs, extractFs);
    const blur = linkProgram(gl, vs, blurFs);
    const composite = linkProgram(gl, vs, compositeFs);
    if (!extract || !blur || !composite) return null;

    const vao = gl.createVertexArray();
    if (!vao) return null;

    return {
        gl, extract, blur, composite,
        uniforms: {
            extract: {
                uSrc: gl.getUniformLocation(extract, 'uSrc'),
                uThreshold: gl.getUniformLocation(extract, 'uThreshold'),
            },
            blur: {
                uSrc: gl.getUniformLocation(blur, 'uSrc'),
                uTexel: gl.getUniformLocation(blur, 'uTexel'),
                uAxis: gl.getUniformLocation(blur, 'uAxis'),
            },
            composite: {
                uBase: gl.getUniformLocation(composite, 'uBase'),
                uBloom: gl.getUniformLocation(composite, 'uBloom'),
                uIntensity: gl.getUniformLocation(composite, 'uIntensity'),
            },
        },
        vao,
        geometryMsaaFB: null, geometryMsaaRB: null,
        geometryFB: null, geometryTex: null,
        bloomFB_A: null, bloomTex_A: null,
        bloomFB_B: null, bloomTex_B: null,
        cacheW: 0, cacheH: 0,
    };
}

/** 4× MSAA renderbuffer + FBO pair sized to (w, h). Used for the
 *  geometry pass when bloom is active so chart edges keep their
 *  antialiasing through the offscreen render. */
function makeMsaaFB(gl: WebGL2RenderingContext, w: number, h: number): { fb: WebGLFramebuffer; rb: WebGLRenderbuffer } | null {
    const fb = gl.createFramebuffer();
    const rb = gl.createRenderbuffer();
    if (!fb || !rb) return null;
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    /* SAMPLES = 4 matches the WebGPU pipeline's multisample.count. */
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.RGBA8, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    return { fb, rb };
}

function makeColorFB(gl: WebGL2RenderingContext, w: number, h: number): { fb: WebGLFramebuffer; tex: WebGLTexture } | null {
    const tex = gl.createTexture();
    const fb = gl.createFramebuffer();
    if (!tex || !fb) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fb, tex };
}

export function ensureBloomFBOsGl(p: ChartBloomGlProgram, w: number, h: number): void {
    if (p.geometryFB && p.cacheW === w && p.cacheH === h) return;
    const { gl } = p;
    /* Tear down old (if any). */
    if (p.geometryMsaaFB) gl.deleteFramebuffer(p.geometryMsaaFB);
    if (p.geometryMsaaRB) gl.deleteRenderbuffer(p.geometryMsaaRB);
    if (p.geometryFB) gl.deleteFramebuffer(p.geometryFB);
    if (p.geometryTex) gl.deleteTexture(p.geometryTex);
    if (p.bloomFB_A) gl.deleteFramebuffer(p.bloomFB_A);
    if (p.bloomTex_A) gl.deleteTexture(p.bloomTex_A);
    if (p.bloomFB_B) gl.deleteFramebuffer(p.bloomFB_B);
    if (p.bloomTex_B) gl.deleteTexture(p.bloomTex_B);
    const msaa = makeMsaaFB(gl, w, h);
    const geom = makeColorFB(gl, w, h);
    const halfW = Math.max(1, Math.floor(w / 2));
    const halfH = Math.max(1, Math.floor(h / 2));
    const a = makeColorFB(gl, halfW, halfH);
    const b = makeColorFB(gl, halfW, halfH);
    p.geometryMsaaFB = msaa?.fb ?? null;
    p.geometryMsaaRB = msaa?.rb ?? null;
    p.geometryFB = geom?.fb ?? null;
    p.geometryTex = geom?.tex ?? null;
    p.bloomFB_A = a?.fb ?? null;
    p.bloomTex_A = a?.tex ?? null;
    p.bloomFB_B = b?.fb ?? null;
    p.bloomTex_B = b?.tex ?? null;
    p.cacheW = w;
    p.cacheH = h;
}

/** Bind the MSAA geometry FBO so the next geometry draw lands in the
 *  multisampled renderbuffer. After the draw the caller must invoke
 *  `resolveGeometryFBOGl` to blit MSAA samples down to the single-
 *  sample `geometryTex` before bloom passes can sample it. */
export function bindGeometryFBOGl(p: ChartBloomGlProgram): void {
    if (!p.geometryMsaaFB) return;
    p.gl.bindFramebuffer(p.gl.FRAMEBUFFER, p.geometryMsaaFB);
}

/** Resolve the MSAA renderbuffer down into the single-sample
 *  `geometryTex` via blitFramebuffer. Required between the geometry
 *  pass and the bloom chain — bloom shaders sample `geometryTex` as a
 *  normal 2D texture, which can't read MSAA samples directly. */
export function resolveGeometryFBOGl(p: ChartBloomGlProgram, w: number, h: number): void {
    if (!p.geometryMsaaFB || !p.geometryFB) return;
    const { gl } = p;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, p.geometryMsaaFB);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.geometryFB);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
}

/** Run extract → blur H → blur V → composite-to-canvas. Caller is
 *  responsible for the geometry pass having already written to
 *  geometryTex. After this returns, the canvas backbuffer holds the
 *  composited result. */
export function runBloomChainGl(
    p: ChartBloomGlProgram,
    canvasW: number, canvasH: number,
    threshold: number, intensity: number,
    blurIterations = 12,
): void {
    if (!p.geometryTex || !p.bloomFB_A || !p.bloomFB_B || !p.bloomTex_A || !p.bloomTex_B) return;
    const { gl } = p;
    const halfW = Math.max(1, Math.floor(canvasW / 2));
    const halfH = Math.max(1, Math.floor(canvasH / 2));
    gl.bindVertexArray(p.vao);
    gl.disable(gl.BLEND);

    /* Extract: geometryTex → bloomFB_A. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, p.bloomFB_A);
    gl.viewport(0, 0, halfW, halfH);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p.extract);
    gl.uniform1i(p.uniforms.extract.uSrc, 0);
    gl.uniform1f(p.uniforms.extract.uThreshold, threshold);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.geometryTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* Repeated H+V blur passes ping-ponging A ↔ B. More iterations = a wider,
     * farther-reaching halo (defaults to 12 for chart callers; PrismTitle asks
     * for more reach). */
    const BLUR_ITERATIONS = blurIterations;
    gl.useProgram(p.blur);
    gl.uniform1i(p.uniforms.blur.uSrc, 0);
    gl.uniform2f(p.uniforms.blur.uTexel, 1 / halfW, 1 / halfH);
    for (let iter = 0; iter < BLUR_ITERATIONS; iter++) {
        /* Blur H: A → B. */
        gl.bindFramebuffer(gl.FRAMEBUFFER, p.bloomFB_B);
        gl.viewport(0, 0, halfW, halfH);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(p.uniforms.blur.uAxis, 0);
        gl.bindTexture(gl.TEXTURE_2D, p.bloomTex_A);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        /* Blur V: B → A. */
        gl.bindFramebuffer(gl.FRAMEBUFFER, p.bloomFB_A);
        gl.viewport(0, 0, halfW, halfH);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(p.uniforms.blur.uAxis, 1);
        gl.bindTexture(gl.TEXTURE_2D, p.bloomTex_B);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* Composite: geometryTex + bloomTex_A → canvas (default framebuffer). */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.composite);
    gl.uniform1i(p.uniforms.composite.uBase, 0);
    gl.uniform1i(p.uniforms.composite.uBloom, 1);
    gl.uniform1f(p.uniforms.composite.uIntensity, intensity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.geometryTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, p.bloomTex_A);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
}
