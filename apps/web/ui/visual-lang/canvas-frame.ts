/**
 * Visual language — per-frame canvas DPR resize + clear scaffold.
 *
 * The "resize canvas to physical pixels, set viewport, clear" preamble that
 * runs every frame for any DPR-aware visual surface. Caller follows up with
 * its own program-bind + uniform upload + draw.
 *
 * DPR is clamped to 2 (matches molecule behavior — retina at 3x or higher
 * doubles fragment cost without proportional perceptual gain).
 */

export const MAX_DPR = 2;

/** Resize the canvas to match `cssPx × cssPx` at device-pixel resolution
 *  (clamped to MAX_DPR), set the viewport, and clear. Returns the physical
 *  pixel dimension actually used (caller may want it for shader uniforms). */
export function prepareSquareFrame(
    gl: WebGL2RenderingContext,
    canvas: HTMLCanvasElement,
    cssPx: number,
): number {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const dim = Math.max(1, Math.round(cssPx * dpr));
    if (canvas.width !== dim || canvas.height !== dim) {
        canvas.width = dim;
        canvas.height = dim;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return dim;
}
