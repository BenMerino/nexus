/// <reference types="@webgpu/types" />
/* WGSL shaders for the multi-pass bloom chain.
 *
 * Three pipelines share this module:
 *   - bright_extract  — reads the geometry color texture, threshold-
 *                       filters bright pixels into a bloom buffer at
 *                       half resolution.
 *   - blur            — separable Gaussian (driven by uniform `axis`:
 *                       0 = horizontal, 1 = vertical). Two draws per
 *                       pyramid level.
 *   - composite       — adds the blurred bloom on top of the original
 *                       geometry texture, scaled by the `intensity`
 *                       uniform. Final write goes to the canvas.
 *
 * The vertex stage is a fullscreen-triangle for all three; we use 3
 * vertices generated from the vertex_index to avoid a vertex buffer.
 */

export const CHART_BLOOM_WGSL = /* wgsl */ `
struct BloomUniforms {
    /* Texel size = 1/textureDimensions, used by extract + blur to step
     * through neighbours regardless of resolution. */
    texel: vec2<f32>,
    /* Brightness threshold for extract; bloom intensity for composite.
     * Reused field — only one pass uses it at a time. */
    threshold: f32,
    intensity: f32,
    /* Blur direction selector for the blur pass. 0 = horizontal, 1 = vertical. */
    axis: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0) var<uniform> u: BloomUniforms;
@group(0) @binding(1) var srcTex: texture_2d<f32>;
@group(0) @binding(2) var srcSampler: sampler;
/* Composite pass binds an additional texture (the blurred bloom). */
@group(0) @binding(3) var bloomTex: texture_2d<f32>;

struct VsOut {
    @builtin(position) clipPos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vid: u32) -> VsOut {
    /* Fullscreen triangle covering NDC [-1, 1] × [-1, 1] using 3
     * vertices. UV is computed so the canvas-bottom corner = (0, 0). */
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0),
    );
    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0),
    );
    var out: VsOut;
    out.clipPos = vec4<f32>(positions[vid], 0.0, 1.0);
    out.uv = uvs[vid];
    return out;
}

/* Bright-extract: emit polygon color × alpha, regardless of brightness.
 * After Gaussian blur, this becomes a "presence cloud" centered on the
 * polygon — brightest at the edges, fading radially outward. The
 * composite pass uses this to paint a halo outside the polygon
 * without modifying the polygon's interior color. The threshold is
 * kept as a soft modulator so very dim marks contribute less. */
@fragment
fn fs_extract(in: VsOut) -> @location(0) vec4<f32> {
    let c = textureSampleLevel(srcTex, srcSampler, in.uv, 0.0);
    let lum = dot(c.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let knee = max(0.0001, u.threshold);
    let soft = smoothstep(knee * 0.5, knee * 2.0, lum);
    return vec4<f32>(c.rgb * soft, c.a * soft);
}

/* Separable Gaussian — 9-tap, σ ≈ 2 texels. Linear-filtering trick:
 * sample at half-texel offsets so each tap reads two source texels and
 * weights them by their position. With 4 H+V iterations compounding,
 * the effective halo radius is ~30-40 source pixels — wide enough for
 * a real glow, narrow enough per-pass to avoid visible banding from
 * over-strided sampling. */
@fragment
fn fs_blur(in: VsOut) -> @location(0) vec4<f32> {
    /* 9-tap weights (σ ≈ 2). Center + 4 symmetric pairs. */
    let weights = array<f32, 5>(0.227027, 0.194594, 0.121622, 0.054054, 0.016216);
    var dir: vec2<f32>;
    if (u.axis < 0.5) {
        dir = vec2<f32>(u.texel.x, 0.0);
    } else {
        dir = vec2<f32>(0.0, u.texel.y);
    }
    var acc = textureSampleLevel(srcTex, srcSampler, in.uv, 0.0) * weights[0];
    for (var i: i32 = 1; i < 5; i = i + 1) {
        let off = dir * f32(i);
        acc = acc + textureSampleLevel(srcTex, srcSampler, in.uv + off, 0.0) * weights[i];
        acc = acc + textureSampleLevel(srcTex, srcSampler, in.uv - off, 0.0) * weights[i];
    }
    return acc;
}

/* Composite: layer the polygon (base) on top of the diffuse bloom
 * cloud. Where the polygon is opaque (inside the mark), we render
 * base.rgb verbatim — interior color stays exactly what the geometry
 * pass produced. Where the polygon is transparent (outside the mark),
 * we render bloom × intensity — the diffuse halo cloud, brightest
 * near the edges, fading outward.
 *
 * No additive blending across the boundary: that produced either a
 * dark gradient seam (when masked) or interior over-brightening
 * (when raw-additive). This straight "polygon over halo" composite
 * reads as a real glow without either artifact. */
@fragment
fn fs_composite(in: VsOut) -> @location(0) vec4<f32> {
    let base = textureSampleLevel(srcTex, srcSampler, in.uv, 0.0);
    let bloom = textureSampleLevel(bloomTex, srcSampler, in.uv, 0.0);
    let halo = bloom * u.intensity;
    /* Standard "src-over" composite of base on top of halo:
     *   out.rgb = base.rgb + halo.rgb * (1 - base.a)
     *   out.a   = base.a   + halo.a   * (1 - base.a) */
    let outRgb = base.rgb + halo.rgb * (1.0 - base.a);
    let outA = base.a + halo.a * (1.0 - base.a);
    return vec4<f32>(outRgb, outA);
}
`;
