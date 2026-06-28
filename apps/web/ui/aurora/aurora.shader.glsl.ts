/* ── aurora GLSL ───────────────────────────────────────────
 * A living mesh / aurora gradient on a fullscreen quad — soft overlapping
 * color blobs that drift inside the surface, blended by inverse-distance
 * weighting (a smooth Shepard interpolation). Designed as a button FILL: it
 * sizes to its container and its colors default to the DNA --primary /
 * --secondary tokens. The visual token sibling of the particle molecules,
 * but a rectangular gradient surface rather than a point cloud.
 *
 * Pure WebGL2 (GLSL ES 3.00). Compiled via visual-lang gl-boot helpers. */

export const AURORA_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;   // fullscreen triangle in clip space
out vec2 vUv;                        // [0,1] across the surface
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/* Up to 5 blobs. Each is a color + a base position; the shader drifts the
 * positions over time on per-blob lissajous orbits so the mesh keeps moving. */
export const AURORA_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
uniform float uTime;
uniform float uAspect;     // w/h, so blobs stay round in a wide button
uniform float uSpeed;      // drift speed
uniform float uSoftness;   // blob falloff (higher = softer, broader blend)
uniform int   uCount;      // active blob count (2..5)
uniform vec3  uColors[5];  // blob colors (default --primary/--secondary mix)
uniform vec2  uSeeds[5];   // per-blob orbit phase seeds
out vec4 fragColor;

// Push a color toward vivid: lift saturation around its own luminance + a
// small brightness gain. Keeps eye-candy punch without blowing to white.
vec3 vivid(vec3 c, float sat, float gain) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    return clamp((c - l) * sat + l + gain, 0.0, 1.0);
}

void main() {
    // Work in aspect-corrected space so blobs are circular, not stretched.
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    float t = uTime * uSpeed;

    // ADDITIVE LIGHT — every blob is colored light on ONE shared field. We do
    // NOT average (averaging mixes pigment → muddy 'oil', e.g. red+green=brown).
    // Instead each blob ADDS its color×falloff, so overlaps build NEW hues and
    // brightness the way lights do: red+green→yellow, and where many stack it
    // glows brighter. The HDR sum is tone-mapped back into range afterwards.
    // The fill is ALWAYS 100% colored — never the theme bg, never dim gray.
    // A normalized weighted blend gives the base color at every pixel (the
    // softmax-ish field below), and the blobs just CONCENTRATE their hue where
    // they're near. We weight each color by its falloff PLUS a small floor, so
    // even far pixels resolve to a full-strength blend of the palette rather
    // than fading toward black.
    vec3 weighted = vec3(0.0);
    float wsum = 0.0;
    float peak = 0.0;        // strongest single-band presence (for the glow lift)
    // CRESCENT field: each color is a band at a fixed RADIUS from a shared arc
    // origin placed BELOW the surface — so its iso-distance curve is an arc that
    // opens UPWARD ( a smile / bowl ). Stacking colors at growing radii gives
    // the nested-crescent "bulb" read. The origin drifts on a slow bounce so the
    // arcs breathe organically rather than sitting static.
    // Origin centered horizontally (x = surface centre), fixed below the
    // surface; only a tiny VERTICAL breathe so the stack stays centered (no
    // horizontal drift that would push the crescents off-center).
    float originY = -0.55;
    vec2 arc = vec2(0.5 * uAspect, originY + sin(t * 0.45) * 0.05);
    float dist = distance(p, arc);
    // Center the radius bands on the origin→surface-centre distance, so the
    // MIDDLE band passes through (0.5, 0.5) and the stack is vertically centered.
    float centerR = 0.5 - originY;                // distance origin → surface centre
    float bandStep = 0.24;
    float count = max(float(uCount) - 1.0, 1.0);
    for (int i = 0; i < 5; i++) {
        if (i >= uCount) break;
        // Per-color radius band, centered on centerR (i below centre → inner,
        // above → outer). Each wobbles on its own phase so crescents flex.
        float radius = centerR + (float(i) - count * 0.5) * bandStep
                     + sin(t * (0.6 + float(i) * 0.17) + float(i) * 2.1) * 0.05;
        float d = abs(dist - radius);                 // distance to THIS arc
        float fall = exp(-d * d / (uSoftness * 1.4 + 0.04));
        float w = fall + 0.05;
        weighted += vivid(uColors[i], 1.4, 0.0) * w;
        wsum += w;
        peak = max(peak, fall);
    }
    // Normalized blend = the base color at FULL strength everywhere (the gradient
    // — which hue dominates shifts by proximity, but it's always saturated color,
    // never gray or bg).
    vec3 color = weighted / max(wsum, 0.001);
    // Concentration glow: lift brightness where a blob is near, so the gradient
    // points read as bright cores without the rest going dim.
    color = vivid(color, 1.0, peak * 0.12);
    color = color / (1.0 + color * 0.04);   // tame only true blow-out

    // Faint diagonal sheen — a broad moving highlight band, premium glass feel.
    color += 0.04 * sin((vUv.x + vUv.y) * 3.14159 + t * 1.5);

    fragColor = vec4(color, 1.0);
}
`;
