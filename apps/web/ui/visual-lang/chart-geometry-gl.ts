/**
 * Visual language — chart geometry renderer (WebGL2 fallback).
 *
 * Mirrors chart-geometry-gpu.ts exactly: same vertex layout, same uniform
 * surface, same fragment shader logic, just GLSL ES 3.00 + WebGL2 calls.
 * Used when navigator.gpu is absent (older Safari, etc.).
 */

import { compileShader, linkProgram } from './gl-boot.js';
import { CHART_GEOMETRY_VS, CHART_GEOMETRY_FS } from './chart-geometry-shaders.js';

/* Vertex layout: 9 floats per vertex
 * (pos.xy, color.rgba, gradRange.xy, bottomMul). */
export const VERTEX_FLOATS_GL = 9;
export const VERTEX_BYTES_GL = VERTEX_FLOATS_GL * 4;

export interface ChartGeometryGlProgram {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    uniforms: {
        uResolution: WebGLUniformLocation | null;
        uTime: WebGLUniformLocation | null;
        uGlow: WebGLUniformLocation | null;
        uIridescence: WebGLUniformLocation | null;
        uEdgeSoftness: WebGLUniformLocation | null;
        uSaturation: WebGLUniformLocation | null;
    };
    vao: WebGLVertexArrayObject;
    vertexBuffer: WebGLBuffer;
    vertexBufferCapacity: number;
}

export function createChartGeometryGlProgram(gl: WebGL2RenderingContext): ChartGeometryGlProgram | null {
    const vs = compileShader(gl, gl.VERTEX_SHADER, CHART_GEOMETRY_VS);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, CHART_GEOMETRY_FS);
    if (!vs || !fs) return null;
    const program = linkProgram(gl, vs, fs);
    if (!program) return null;

    const vertexBuffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!vertexBuffer || !vao) return null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    /* aPosition  (loc 0) at offset 0,  vec2.
     * aColor     (loc 1) at offset 8,  vec4.
     * aGradRange (loc 2) at offset 24, vec2 — (gradTopY, gradBotY).
     * aBottomMul (loc 3) at offset 32, float. */
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, VERTEX_BYTES_GL, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, VERTEX_BYTES_GL, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, VERTEX_BYTES_GL, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, VERTEX_BYTES_GL, 32);

    gl.bindVertexArray(null);

    return {
        gl, program,
        uniforms: {
            uResolution: gl.getUniformLocation(program, 'uResolution'),
            uTime: gl.getUniformLocation(program, 'uTime'),
            uGlow: gl.getUniformLocation(program, 'uGlow'),
            uIridescence: gl.getUniformLocation(program, 'uIridescence'),
            uEdgeSoftness: gl.getUniformLocation(program, 'uEdgeSoftness'),
            uSaturation: gl.getUniformLocation(program, 'uSaturation'),
        },
        vao, vertexBuffer,
        vertexBufferCapacity: 0,
    };
}

export interface ChartDrawParamsGl {
    time: number;
    glow: number;
    iridescence: number;
    edgeSoftness: number;
    saturation: number;
}

export function drawChartGeometryGl(
    p: ChartGeometryGlProgram,
    vertices: Float32Array,
    triCount: number,
    resW: number,
    resH: number,
    params: ChartDrawParamsGl,
): void {
    const { gl, program, uniforms } = p;
    gl.useProgram(program);
    gl.uniform2f(uniforms.uResolution, resW, resH);
    gl.uniform1f(uniforms.uTime, params.time);
    gl.uniform1f(uniforms.uGlow, params.glow);
    gl.uniform1f(uniforms.uIridescence, params.iridescence);
    gl.uniform1f(uniforms.uEdgeSoftness, params.edgeSoftness);
    gl.uniform1f(uniforms.uSaturation, params.saturation);

    gl.bindVertexArray(p.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, p.vertexBuffer);
    const bytesNeeded = vertices.byteLength;
    if (p.vertexBufferCapacity < bytesNeeded) {
        const cap = Math.max(4096, Math.ceil(bytesNeeded / 4096) * 4096);
        gl.bufferData(gl.ARRAY_BUFFER, cap, gl.DYNAMIC_DRAW);
        p.vertexBufferCapacity = cap;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);

    // triCount === 0 is a legitimate empty frame — skip the draw (parity with
    // the WebGPU path). drawArrays(…, 0) is a no-op that some drivers warn on.
    if (triCount > 0) gl.drawArrays(gl.TRIANGLES, 0, triCount * 3);
    gl.bindVertexArray(null);
}
