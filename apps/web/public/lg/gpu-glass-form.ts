// WGSL for the glass MATERIAL — the element's physical form and its optics —
// shared by the single-slab lab shader (gpu-glass-shader.ts) and the
// multi-slab page shader (gpu-glass-multi.ts). Geometry arrives as function
// arguments (center, half-size, corner radius…), so each host shader feeds
// its own uniforms/storage. Everything is C² by construction: refraction
// differentiates the surface, so any curvature-only (C¹) seam prints a hard
// line in the image. Requires a module-scope bg(p: vec2f) -> vec3f from the
// host shader (WGSL module scope is order-independent).
export const FORM_WGSL = /* wgsl */`
// Signed-distance-like field to a slab footprint (device px). The corner
// quadrant uses a 4-norm instead of the euclidean 2-norm: the straight edge
// then meets the corner with C³ continuity (no curvature seam → no refraction
// crease) and the corner is the design system's superellipse (squircle).
fn sdRR(p: vec2f, c: vec2f, hb: vec2f, r: f32) -> f32 {
  let q = abs(p - c) - hb + vec2f(r);
  let m = max(q, vec2f(0.0));
  let m2 = m * m;
  return pow(dot(m2, m2), 0.25) + min(max(q.x, q.y), 0.0) - r;
}

// The form's height ABOVE the flat back face's top. The rim rises over the
// bezel band with a cubic ease (zero slope AND zero curvature where it meets
// the flat top); the optional dome is a superellipse cap in normalized
// coordinates (NOT in SDF distance, whose interior iso-lines crease at the
// diagonals and medial axis), fading to zero before the rim.
fn formHeight(p: vec2f, c: vec2f, hb: vec2f, r: f32, bezel: f32, domeH: f32) -> f32 {
  let e = -sdRR(p, c, hb, r);
  if (e <= 0.0) { return 0.0; }
  let x = min(e / bezel, 1.0);
  let rim = bezel * (1.0 - pow(1.0 - x, 3.0));
  let s = (p - c) / hb;                   // -1..1 across the footprint
  let s2 = s * s;
  let cap = pow(max(1.0 - dot(s2, s2), 0.0), 3.0);
  return rim + domeH * cap;
}

// Frosted sampling: roughness scatters the ray in a cone — gather the
// background over a Gaussian-weighted golden spiral of radius rad, rotated
// per-pixel by interleaved-gradient noise so residual undersampling reads as
// fine grain rather than ghost images or banding.
fn frosted(q: vec2f, seed: vec2f, rad: f32) -> vec3f {
  let rot = fract(52.9829189 * fract(dot(seed, vec2f(0.06711056, 0.00583715)))) * 6.2832;
  var acc = vec3f(0.0);
  var wsum = 0.0;
  for (var i = 0u; i < 32u; i++) {
    let t = (f32(i) + 0.5) / 32.0;
    let a = 2.3999632 * f32(i) + rot;
    let w = exp(-3.0 * t);
    acc += bg(q + vec2f(cos(a), sin(a)) * (rad * sqrt(t))) * w;
    wsum += w;
  }
  return acc / wsum;
}

// One channel's trace from entry point p with surface normal n and entry
// height h0: Snell entry → march to the flat back face (slab thickness
// thick) → Snell exit (TIR → genuine internal reflection) → landing point on
// the background plane gap px below. Returns (q.x, q.y, internal path).
fn landing(p: vec2f, n: vec3f, ior: f32, h0: f32, thick: f32, gap: f32) -> vec3f {
  let t1 = refract(vec3f(0.0, 0.0, -1.0), n, 1.0 / ior);
  let path = (thick + h0) / max(-t1.z, 1e-4);
  var q = p + t1.xy * path;
  var t2 = refract(t1, vec3f(0.0, 0.0, 1.0), ior);
  if (all(t2 == vec3f(0.0))) { t2 = reflect(t1, vec3f(0.0, 0.0, 1.0)); }
  q += t2.xy * (gap / max(abs(t2.z), 1e-4));
  return vec3f(q, path);
}

// What the ray sees where it lands: the background, scattered if frosted.
fn shade(q: vec2f, seed: vec2f, frostR: f32) -> vec3f {
  if (frostR > 0.25) { return frosted(q, seed, frostR); }
  return bg(q);
}
`;
