/**
 * Visual language — GL boot plumbing.
 *
 * Pure WebGL2 helpers shared by every visual-lang surface (LoaderMolecule
 * today, GraphRenderer next). No molecule-specific assumptions: any caller
 * that wants a fragment-shader-driven canvas uses these to compile, link,
 * and bind a fullscreen quad.
 */

/** Compile a single GLSL shader. Logs and returns null on compile error so
 *  the caller can early-return without throwing. */
export function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[visual-lang] shader compile failed:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}

/** Link a vertex+fragment shader pair into a program. Logs and returns null
 *  on link error. */
export function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('[visual-lang] program link failed:', gl.getProgramInfoLog(prog));
        gl.deleteProgram(prog);
        return null;
    }
    return prog;
}
