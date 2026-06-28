/* ── shared GLSL noise primitives ──────────────────────────
 * value-noise + fbm, lifted out of the particle-sphere shader so every
 * GPU molecule that needs organic drift reads ONE noise source instead of
 * duplicating it. GLSL ES 3.00 string, inlined into a fragment/vertex shader.
 *
 * hash → vnoise (trilinear-smoothed value noise) → fbm (3 octaves). Same
 * coefficients the sphere shipped with, so its look is unchanged after it
 * adopts this. */

/** Inline into any GLSL ES 3.00 shader that needs hash/vnoise/fbm/rotation. */
export const GLSL_NOISE = /* glsl */ `
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}
float fbm(vec3 p) {
    return 0.6 * vnoise(p) + 0.3 * vnoise(p * 2.03) + 0.15 * vnoise(p * 4.01);
}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,-s, 0.,s,c); }
`;
