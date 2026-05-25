/// <reference types="@webgpu/types" />
/* WGSL shader for chart 2D geometry rendering.
 *
 * Single render pipeline that draws filled triangles in a viewBox-mapped
 * coordinate space. Each vertex carries (position.xy in viewBox units +
 * RGBA color); the vertex shader maps to NDC, the fragment shader applies
 * a small post-process chain controlled by uniforms (glow halo, iridescence
 * modulation, edge softness via per-fragment alpha).
 *
 * Shape primitives (bars, polygons, polylines-as-strips, antialiased
 * circles) are all tessellated into triangles CPU-side and uploaded into
 * one vertex buffer per draw — same pipeline handles every shape.
 *
 * Conventions:
 *   - Vertex position is in viewBox px (0,0 = top-left, +y down). The
 *     vertex stage flips Y so chart-space (top-left origin, +y down) maps
 *     correctly to clip-space (+y up).
 *   - The `frame` (vec2) input encodes which side of an antialiased edge
 *     the vertex sits on — 0 at the soft outer edge, 1 at the solid
 *     interior. Used by the fragment shader's edgeSoftness uniform to
 *     feather edges. For non-antialiased shapes (bars), set frame=1
 *     everywhere and the smoothstep collapses to a constant 1.
 */

export const CHART_GEOMETRY_WGSL = /* wgsl */ `
struct Uniforms {
    /* Canvas resolution in physical pixels — used to convert vertex
     * positions from viewBox px into NDC. */
    resolution: vec2<f32>,
    /* Time accumulator, drives iridescence shimmer. */
    time: f32,
    /* Glow halo strength [0..2]. 0 = flat fill, 1 = engine baseline. */
    glow: f32,
    /* Iridescence shimmer strength [0..1]. 0 = flat color. */
    iridescence: f32,
    /* Edge softness [0..2] — controls the smoothstep band on antialiased
     * shapes. 1 = engine baseline. Bars stay crisp regardless because
     * frame=1 everywhere on them. */
    edgeSoftness: f32,
    /* Color saturation multiplier [0..2]. 1 = neutral. */
    saturation: f32,
    _pad0: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
    @location(0) position: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) gradRange: vec2<f32>,
    @location(3) bottomMul: f32,
};

struct VsOut {
    @builtin(position) clipPos: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) gradRange: vec2<f32>,
    @location(2) worldPos: vec2<f32>,
    @location(3) bottomMul: f32,
};

@vertex
fn vs_main(input: VsIn) -> VsOut {
    var out: VsOut;
    /* viewBox px → NDC. NDC x=-1..1 across resolution.x, y=-1..1 across
     * resolution.y but with Y flipped (viewBox is +y down, NDC is +y up). */
    let ndcX = (input.position.x / u.resolution.x) * 2.0 - 1.0;
    let ndcY = 1.0 - (input.position.y / u.resolution.y) * 2.0;
    out.clipPos = vec4<f32>(ndcX, ndcY, 0.0, 1.0);
    out.color = input.color;
    out.gradRange = input.gradRange;
    out.bottomMul = input.bottomMul;
    out.worldPos = input.position;
    return out;
}

fn applySaturation(c: vec3<f32>, s: f32) -> vec3<f32> {
    let luma = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
    return mix(vec3<f32>(luma), c, s);
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    /* Screen-Y vertical gradient. gradRange.x = world-space Y at the
     * gradient top (alpha mul = 1), gradRange.y = world-space Y at
     * the gradient bottom (alpha mul = bottomMul). Computing bandY
     * per-fragment from worldPos.y rather than interpolating it from
     * vertex attributes makes the gradient a pure function of screen
     * position — independent of triangle shape — so sloped quads and
     * ear-clipped polygons don't kink the gradient at the diagonal.
     * When gradBotY <= gradTopY the primitive is non-gradient and we
     * short-circuit to color.a. u.edgeSoftness referenced as a no-op
     * so its uniform binding survives shader optimization. */
    let gradTop = in.gradRange.x;
    let gradBot = in.gradRange.y;
    let span = gradBot - gradTop;
    var gradA = 1.0;
    if (span > 0.0) {
        let bandY = clamp((in.worldPos.y - gradTop) / span, 0.0, 1.0);
        gradA = mix(1.0, in.bottomMul, bandY);
    }
    let alpha = in.color.a * gradA + u.edgeSoftness * 0.0;

    /* Iridescence: phase derived from world-space position + time. Adds
     * a wavelength-shifted color band that drifts across the geometry.
     * Off when iridescence=0 (mix collapses). */
    let iriPhase = (in.worldPos.x * 0.015 - in.worldPos.y * 0.015) + u.time * 1.2;
    let iriRGB = vec3<f32>(0.5) + vec3<f32>(0.5) *
        cos(vec3<f32>(iriPhase) + vec3<f32>(0.0, 2.0, 4.0));
    let iridescent = mix(in.color.rgb, in.color.rgb * iriRGB * 1.6, u.iridescence);

    /* u.glow is consumed by the bloom post-pipeline (extract -> blur ->
     * composite) at the renderer level - NOT here. The geometry pass
     * emits the unboosted color so the bloom pipeline can sample it. */
    let finalRGB = applySaturation(iridescent, u.saturation);
    return vec4<f32>(finalRGB * alpha, alpha);
}
`;
