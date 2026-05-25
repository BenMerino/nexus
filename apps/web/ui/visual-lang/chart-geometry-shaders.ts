/* GLSL fallback of the chart-geometry pipeline for browsers without
 * WebGPU. Line-for-line equivalent to chart-geometry-wgsl.ts — same
 * uniforms, same vertex layout, same fragment math. */

export const CHART_GEOMETRY_VS = `#version 300 es
precision highp float;

uniform vec2 uResolution;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aColor;
layout(location = 2) in vec2 aGradRange;
layout(location = 3) in float aBottomMul;

out vec4 vColor;
out vec2 vGradRange;
out float vBottomMul;
out vec2 vWorldPos;

void main() {
    float ndcX = (aPosition.x / uResolution.x) * 2.0 - 1.0;
    float ndcY = 1.0 - (aPosition.y / uResolution.y) * 2.0;
    gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);
    vColor = aColor;
    vGradRange = aGradRange;
    vBottomMul = aBottomMul;
    vWorldPos = aPosition;
}
`;

export const CHART_GEOMETRY_FS = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uGlow;
uniform float uIridescence;
uniform float uEdgeSoftness;
uniform float uSaturation;

in vec4 vColor;
in vec2 vGradRange;
in float vBottomMul;
in vec2 vWorldPos;

out vec4 fragColor;

vec3 applySaturation(vec3 c, float s) {
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luma), c, s);
}

void main() {
    /* Screen-Y vertical gradient: vGradRange.x = world-space Y at the
     *  gradient top (alpha mul = 1), vGradRange.y = world-space Y at
     *  the gradient bottom (alpha mul = vBottomMul). Computing bandY
     *  per-fragment from worldPos.y rather than interpolating it from
     *  vertex attributes makes the gradient a pure function of screen
     *  position — independent of triangle shape — so sloped quads and
     *  ear-clipped polygons don't kink the gradient at the diagonal.
     *  When gradBotY <= gradTopY the primitive is non-gradient and we
     *  short-circuit to vColor.a. uEdgeSoftness referenced as a no-op
     *  so its uniform binding survives shader optimization. */
    float gradTop = vGradRange.x;
    float gradBot = vGradRange.y;
    float span = gradBot - gradTop;
    float bandY = span > 0.0 ? clamp((vWorldPos.y - gradTop) / span, 0.0, 1.0) : 0.0;
    float gradA = span > 0.0 ? mix(1.0, vBottomMul, bandY) : 1.0;
    float alpha = vColor.a * gradA + uEdgeSoftness * 0.0;

    float iriPhase = (vWorldPos.x * 0.015 - vWorldPos.y * 0.015) + uTime * 1.2;
    vec3 iriRGB = vec3(0.5) + vec3(0.5) * cos(vec3(iriPhase) + vec3(0.0, 2.0, 4.0));
    vec3 iridescent = mix(vColor.rgb, vColor.rgb * iriRGB * 1.6, uIridescence);

    /* uGlow consumed by the WebGL2 bloom post-pipeline — NOT here. */
    vec3 finalRGB = applySaturation(iridescent, uSaturation);
    fragColor = vec4(finalRGB * alpha, alpha);
}
`;
