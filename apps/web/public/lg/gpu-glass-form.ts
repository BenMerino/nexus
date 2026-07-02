// WGSL for the element's PHYSICAL FORM (interpolated into gpu-glass-shader).
// Everything here is C² by construction: refraction differentiates the
// surface, so any curvature-only (C¹) seam prints a hard line in the image.
// References the shared uniform struct `u` and bg() from the host shader —
// WGSL module scope is order-independent.
export const FORM_WGSL = /* wgsl */`
// Signed-distance-like field to the element's footprint (device px). The
// corner quadrant uses a 4-norm instead of the euclidean 2-norm: the straight
// edge then meets the corner with C³ continuity (no curvature seam → no
// refraction crease) and the corner is the design system's superellipse
// (squircle), not a circle.
fn sdRR(p: vec2f) -> f32 {
  let q = abs(p - u.b.xy) - u.b.zw + vec2f(u.c.x);
  let m = max(q, vec2f(0.0));
  let m2 = m * m;
  return pow(dot(m2, m2), 0.25) + min(max(q.x, q.y), 0.0) - u.c.x;
}

// The form's height ABOVE the flat back face's top. The rim rises over the
// bezel band with a cubic ease (zero slope AND zero curvature where it meets
// the flat top); the optional dome is a superellipse cap in normalized
// coordinates (NOT in SDF distance, whose interior iso-lines crease at the
// diagonals and medial axis), fading to zero before the rim.
fn height(p: vec2f) -> f32 {
  let e = -sdRR(p);                       // distance in from the edge
  if (e <= 0.0) { return 0.0; }
  let x = min(e / u.c.y, 1.0);
  let rim = u.c.y * (1.0 - pow(1.0 - x, 3.0));
  let s = (p - u.b.xy) / u.b.zw;          // -1..1 across the footprint
  let s2 = s * s;
  let cap = pow(max(1.0 - dot(s2, s2), 0.0), 3.0);
  return rim + u.d.w * cap;
}

// Frosted sampling: roughness scatters the ray in a cone — gather the
// background over a Gaussian-weighted golden spiral of radius u.e.w, rotated
// per-pixel by interleaved-gradient noise so residual undersampling reads as
// fine grain rather than ghost images or banding.
fn frosted(q: vec2f, seed: vec2f) -> vec3f {
  let rot = fract(52.9829189 * fract(dot(seed, vec2f(0.06711056, 0.00583715)))) * 6.2832;
  var acc = vec3f(0.0);
  var wsum = 0.0;
  for (var i = 0u; i < 32u; i++) {
    let t = (f32(i) + 0.5) / 32.0;
    let a = 2.3999632 * f32(i) + rot;
    let w = exp(-3.0 * t);
    acc += bg(q + vec2f(cos(a), sin(a)) * (u.e.w * sqrt(t))) * w;
    wsum += w;
  }
  return acc / wsum;
}
`;
