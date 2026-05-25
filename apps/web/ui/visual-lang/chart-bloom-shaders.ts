/* WebGL2 / GLSL ES 3.00 mirror of chart-bloom-wgsl.ts. Three fragment
 * shaders — extract / blur / composite — share one fullscreen-triangle
 * vertex shader. */

export const BLOOM_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
    vec2 positions[3] = vec2[3](
        vec2(-1.0, -1.0),
        vec2( 3.0, -1.0),
        vec2(-1.0,  3.0)
    );
    vec2 uvs[3] = vec2[3](
        vec2(0.0, 0.0),
        vec2(2.0, 0.0),
        vec2(0.0, 2.0)
    );
    gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
    vUv = uvs[gl_VertexID];
}
`;

export const BLOOM_EXTRACT_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform float uThreshold;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec4 c = texture(uSrc, vUv);
    float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float knee = max(0.0001, uThreshold);
    float soft = smoothstep(knee * 0.5, knee, lum);
    fragColor = vec4(c.rgb * soft, c.a * soft);
}
`;

export const BLOOM_BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uAxis;
in vec2 vUv;
out vec4 fragColor;
void main() {
    float weights[5] = float[5](0.227027, 0.194594, 0.121622, 0.054054, 0.016216);
    vec2 dir = uAxis < 0.5 ? vec2(uTexel.x, 0.0) : vec2(0.0, uTexel.y);
    vec4 acc = texture(uSrc, vUv) * weights[0];
    for (int i = 1; i < 5; i++) {
        vec2 off = dir * float(i);
        acc += texture(uSrc, vUv + off) * weights[i];
        acc += texture(uSrc, vUv - off) * weights[i];
    }
    fragColor = acc;
}
`;

export const BLOOM_COMPOSITE_FS = `#version 300 es
precision highp float;
uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform float uIntensity;
in vec2 vUv;
out vec4 fragColor;
void main() {
    vec4 base = texture(uBase, vUv);
    vec4 bloom = texture(uBloom, vUv);
    /* Standard "src-over": base on top of the diffuse halo cloud. */
    vec4 halo = bloom * uIntensity;
    vec3 outRgb = base.rgb + halo.rgb * (1.0 - base.a);
    float outA = base.a + halo.a * (1.0 - base.a);
    fragColor = vec4(outRgb, outA);
}
`;
