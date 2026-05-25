/**
 * Visual language — molecule grid renderer (WebGL2 fallback).
 *
 * Same fragment shader vocabulary as the WebGPU primary (superellipse
 * cell SDF + bloom + iridescence + dormant grey + blowout highlight),
 * implemented in GLSL ES 3.00 for browsers without WebGPU. The shared
 * renderer (`shared-renderer.ts`) routes to this when `navigator.gpu` is
 * absent or device acquisition fails.
 *
 * Cell brightness data is uploaded each frame as an RGBA float texture
 * (cols × rows). Texture-backed (not uniform array) so the same primitive
 * handles 25-cell loaders and 1000+ cell charts identically.
 *
 * GLSL sources for VERTEX_SHADER / FRAGMENT_SHADER live in
 * ./molecule-grid-shaders.ts to keep this file under the size ceiling.
 */

import { compileShader, linkProgram } from './gl-boot.js';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './molecule-grid-shaders.js';

/** Target cell pitch in CSS pixels — the visual size of one molecule cell.
 *
 * Charts use this constant to derive `cols`/`rows` from canvas size, so
 * cells stay visually consistent — same pixel size whether the chart is
 * 200 px wide or 1200. Cell *count* varies with canvas; cell *size* is
 * fixed.
 *
 * Reference: the LoaderMolecule's DNA preview at `size = 120` renders
 * 5×5 cells across the inner 120 CSS px (24 px/cell baseline). Lowering
 * the pitch → finer cell density. */
export const CELL_PITCH_PX = 6;


export interface MoleculeGridProgram {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    uniforms: {
        uMoleculeTime: WebGLUniformLocation | null;
        uDensity: WebGLUniformLocation | null;
        uGlow: WebGLUniformLocation | null;
        uIridescence: WebGLUniformLocation | null;
        uCols: WebGLUniformLocation | null;
        uRows: WebGLUniformLocation | null;
        uOverflow: WebGLUniformLocation | null;
        uAaWidth: WebGLUniformLocation | null;
        uResolution: WebGLUniformLocation | null;
        uActiveKind: WebGLUniformLocation | null;
        uActiveCenter: WebGLUniformLocation | null;
        uActiveROuter: WebGLUniformLocation | null;
        uActiveRInner: WebGLUniformLocation | null;
        uActiveStartAngle: WebGLUniformLocation | null;
        uActiveEndAngle: WebGLUniformLocation | null;
        uActiveRectMin: WebGLUniformLocation | null;
        uActiveRectMax: WebGLUniformLocation | null;
        uDormant: WebGLUniformLocation | null;
        uDormantGrey: WebGLUniformLocation | null;
        uCells: WebGLUniformLocation | null;
    };
    cellTexture: WebGLTexture;
    quadBuffer: WebGLBuffer;
    cleanup: () => void;
}

/** Compile + link the molecule grid program, allocate the cell texture and
 *  fullscreen quad. Returns null if any step fails. Caller binds attribs +
 *  drives the rAF loop. */
export function createMoleculeGridProgram(gl: WebGL2RenderingContext): MoleculeGridProgram | null {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    const program = linkProgram(gl, vs, fs);
    if (!program) return null;

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPosition');
    if (aPos >= 0) {
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }

    const cellTexture = gl.createTexture();
    if (!cellTexture) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cellTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uniforms = {
        uMoleculeTime: gl.getUniformLocation(program, 'uMoleculeTime'),
        uDensity:      gl.getUniformLocation(program, 'uDensity'),
        uGlow:         gl.getUniformLocation(program, 'uGlow'),
        uIridescence:  gl.getUniformLocation(program, 'uIridescence'),
        uCols:         gl.getUniformLocation(program, 'uCols'),
        uRows:         gl.getUniformLocation(program, 'uRows'),
        uOverflow:     gl.getUniformLocation(program, 'uOverflow'),
        uAaWidth:      gl.getUniformLocation(program, 'uAaWidth'),
        uResolution:   gl.getUniformLocation(program, 'uResolution'),
        uActiveKind:   gl.getUniformLocation(program, 'uActiveKind'),
        uActiveCenter: gl.getUniformLocation(program, 'uActiveCenter'),
        uActiveROuter: gl.getUniformLocation(program, 'uActiveROuter'),
        uActiveRInner: gl.getUniformLocation(program, 'uActiveRInner'),
        uActiveStartAngle: gl.getUniformLocation(program, 'uActiveStartAngle'),
        uActiveEndAngle: gl.getUniformLocation(program, 'uActiveEndAngle'),
        uActiveRectMin: gl.getUniformLocation(program, 'uActiveRectMin'),
        uActiveRectMax: gl.getUniformLocation(program, 'uActiveRectMax'),
        uDormant:      gl.getUniformLocation(program, 'uDormant'),
        uDormantGrey:  gl.getUniformLocation(program, 'uDormantGrey'),
        uCells:        gl.getUniformLocation(program, 'uCells'),
    };

    return {
        gl, program, uniforms, cellTexture, quadBuffer,
        cleanup: () => {
            gl.deleteProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.deleteBuffer(quadBuffer);
            gl.deleteTexture(cellTexture);
        },
    };
}

/** Upload a cols × rows grid of (r, g, b, brightness) cell data to the
 *  cell texture. cellData length must be cols * rows * 4. */
export function uploadCellGrid(
    p: MoleculeGridProgram,
    cols: number,
    rows: number,
    cellData: Float32Array,
): void {
    p.gl.activeTexture(p.gl.TEXTURE0);
    p.gl.bindTexture(p.gl.TEXTURE_2D, p.cellTexture);
    p.gl.texImage2D(
        p.gl.TEXTURE_2D, 0, p.gl.RGBA32F,
        cols, rows, 0,
        p.gl.RGBA, p.gl.FLOAT, cellData,
    );
}

/** Active region declaration. Cells outside this region produce no
 *  fragment contribution — pixels stay transparent so a backdrop
 *  layer can show through. */
export type ActiveRegion =
    | { kind: 'full' }
    | {
        kind: 'annulus';
        cxPx: number; cyPx: number;
        rOuterPx: number; rInnerPx: number;
        /** Optional angular sweep in radians. Omit for full circle. */
        startAngle?: number; endAngle?: number;
    }
    | {
        kind: 'rect';
        xPx: number; yPx: number;
        wPx: number; hPx: number;
    };

/** Bind the program's uniforms (excluding cell data) and draw the
 *  fullscreen quad. Caller is responsible for canvas sizing + viewport.
 *
 *  `resW`/`resH` are the canvas physical pixel dimensions — needed to
 *  render visually-square cells regardless of canvas aspect, and to
 *  derive a constant AA width that replaces the old per-cell fwidth().
 *
 *  `activeRegion` declares which portion of the grid may light up.
 *  Defaults to `{ kind: 'full' }` — every cell can activate. */
export function drawMoleculeGrid(
    p: MoleculeGridProgram,
    cols: number,
    rows: number,
    moleculeTime: number,
    density: number,
    glow: number,
    iridescence: number,
    overflow: number,
    resW: number,
    resH: number,
    activeRegion: ActiveRegion = { kind: 'full' },
    dormant: number = 0.02,
    dormantGrey: number = 0.25,
): void {
    const { gl, uniforms } = p;
    gl.useProgram(p.program);
    gl.uniform1f(uniforms.uMoleculeTime, moleculeTime);
    gl.uniform1f(uniforms.uDensity, density);
    gl.uniform1f(uniforms.uGlow, glow);
    gl.uniform1f(uniforms.uIridescence, iridescence);
    gl.uniform1f(uniforms.uCols, cols);
    gl.uniform1f(uniforms.uRows, rows);
    gl.uniform1f(uniforms.uOverflow, overflow);
    const minCellPx = Math.max(1, Math.min(resW / cols, resH / rows));
    gl.uniform1f(uniforms.uAaWidth, 1.5 / minCellPx);
    gl.uniform2f(uniforms.uResolution, resW, resH);
    gl.uniform1f(uniforms.uDormant, dormant);
    gl.uniform1f(uniforms.uDormantGrey, dormantGrey);
    /* Always bind every uniform so the GL state is fully defined,
     * regardless of which kind the active region is. */
    gl.uniform2f(uniforms.uActiveCenter, 0, 0);
    gl.uniform1f(uniforms.uActiveROuter, 0);
    gl.uniform1f(uniforms.uActiveRInner, 0);
    gl.uniform1f(uniforms.uActiveStartAngle, 0);
    gl.uniform1f(uniforms.uActiveEndAngle, 0);
    gl.uniform2f(uniforms.uActiveRectMin, 0, 0);
    gl.uniform2f(uniforms.uActiveRectMax, 0, 0);
    if (activeRegion.kind === 'annulus') {
        /* Active center arrives in CSS top-down coords (cyPx measured from
         * canvas top). Shader reads cellPxCenter in fragCoord (bottom-up,
         * y=0 = canvas bottom). Same Y-flip as the rect branch: convert at
         * upload so the masking disc lands where the JS code expects.
         * Without this, on cards where the chart wrapper isn't vertically
         * centered (Overview gauges with title row above), the annulus
         * gates the wrong half of the canvas.
         *
         * Angles also live in math-convention (CCW, +x = 0). Since the
         * shader's atan(dPx.y, dPx.x) operates on the now-flipped dPx.y,
         * the sign of the angular sweep flips too. Negate the angle
         * bounds so the gauge's intentional [π, 2π] sweep keeps masking
         * its bottom semi-annulus, not its top. */
        gl.uniform1i(uniforms.uActiveKind, 1);
        const cyFrag = resH - activeRegion.cyPx;
        gl.uniform2f(uniforms.uActiveCenter, activeRegion.cxPx, cyFrag);
        gl.uniform1f(uniforms.uActiveROuter, activeRegion.rOuterPx);
        gl.uniform1f(uniforms.uActiveRInner, activeRegion.rInnerPx);
        const flipAngle = (a: number) => -a;
        gl.uniform1f(uniforms.uActiveStartAngle, flipAngle(activeRegion.endAngle ?? 0));
        gl.uniform1f(uniforms.uActiveEndAngle, flipAngle(activeRegion.startAngle ?? 0));
    } else if (activeRegion.kind === 'rect') {
        /* Active rect arrives in CSS top-down coords (yPx = top edge from
         * canvas top, hPx = height growing downward). The shader's
         * cellPxCenter is in fragCoord (bottom-up): y=0 is the canvas
         * bottom. Flip Y at upload so masking reads correctly. Without
         * this, on cards taller than the chart wrapper (Overview, where
         * an annotation strip and slider extend the card below the SVG),
         * the active rect lands in the wrong half and the upper portion
         * of the chart's lit cells get masked away. */
        gl.uniform1i(uniforms.uActiveKind, 2);
        const yMinFrag = resH - (activeRegion.yPx + activeRegion.hPx);
        const yMaxFrag = resH - activeRegion.yPx;
        gl.uniform2f(uniforms.uActiveRectMin, activeRegion.xPx, yMinFrag);
        gl.uniform2f(uniforms.uActiveRectMax, activeRegion.xPx + activeRegion.wPx, yMaxFrag);
    } else {
        gl.uniform1i(uniforms.uActiveKind, 0);
    }
    gl.uniform1i(uniforms.uCells, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
