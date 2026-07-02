// WGSL for the physically-based glass element (gpu-glass.ts). One fullscreen
// pass: the background is our sky gradient (same palette as sky-gpu); the
// element is a real 3D form — a glass slab with a curvature-continuous
// (C²) cubic-eased bezel and squircle corners — and every pixel inside it
// is RAY-TRACED:
//   entry refraction (Snell, air→glass at the surface normal derived from the
//   form's height field) → march the internal ray to the flat back face →
//   exit refraction (Snell, glass→air; total internal reflection falls back
//   to a real reflection) → sample the background where the ray lands.
//   Beer–Lambert absorption over the internal path length; Schlick-Fresnel
//   mixes in the reflected environment. No textures, no displacement maps —
//   the optics follow from the geometry.
// There is NO background pass here: the canvas is TRANSPARENT outside the
// slab, so the page's already-running #sky-bg engine shows through untouched.
// SKY_WGSL (exported by that engine — its own function, not a re-derivation)
// is evaluated ONLY for the refracted/reflected samples inside the glass, so
// the bent image agrees with the live engine behind the canvas.
import { SKY_WGSL } from "../sky/sky-gpu";

export const GLASS_SHADER = /* wgsl */`
struct U {
  a: vec4f,   // res.x, res.y, backgroundGap, ior
  b: vec4f,   // center.x, center.y, halfW, halfH   (device px)
  c: vec4f,   // cornerRadius, bezelRadius, slabThickness, glowX (0..1)
  top: vec4f, // sky top color (rgb 0..1), a = HDR ceiling
  hor: vec4f, // sky horizon color (rgb 0..1), a = glow intensity
  d: vec4f,   // gridSpacing, gridOpacity, gridHalfWidth, domeHeight (device px)
  e: vec4f,   // Beer–Lambert absorption k (rgb, device-px⁻¹), frost radius (px)
};
@group(0) @binding(0) var<uniform> u: U;
${SKY_WGSL}

fn sky(p: vec2f) -> vec3f {
  return skyColor(p / u.a.xy, u.top.rgb, u.hor, u.c.w, u.top.w);
}

// Reference grid, lab-only: coverage of a hairline grid at p (0..1).
fn gridA(p: vec2f) -> f32 {
  let g = abs(fract(p / u.d.x + vec2f(0.5)) - vec2f(0.5)) * u.d.x;
  let m = min(g.x, g.y);
  return (1.0 - smoothstep(u.d.z - 0.5, u.d.z + 0.5, m)) * u.d.y;
}

// The scene the glass refracts = the engine sky WITH the printed grid, so
// grid lines physically bend through the bezel like everything else.
fn bg(p: vec2f) -> vec3f {
  return mix(sky(p), vec3f(1.0), gridA(p));
}

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

// The element's physical form, C² everywhere — refraction differentiates the
// surface, so any curvature break prints a hard line. The rim rises over the
// bezel band with a cubic ease (zero slope AND zero curvature where it meets
// the flat top); the optional dome is a superellipse cap in normalized
// coordinates (NOT in SDF distance, whose interior iso-lines crease at the
// diagonals and medial axis), fading to zero before the rim. h is height
// ABOVE the flat back face's top.
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

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1., -1.), vec2f(3., -1.), vec2f(-1., 3.));
  return vec4f(pos[i], 0., 1.);
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let p = frag.xy;
  // Outside the slab: only the reference grid, premultiplied over transparency
  // — the LIVE background engine behind this canvas stays the one background.
  if (sdRR(p) >= 0.0) {
    let ga = gridA(p);
    return vec4f(vec3f(ga), ga);
  }

  // Surface normal from the form's height field (central differences).
  let eps = 1.0;
  let hx = height(p + vec2f(eps, 0.)) - height(p - vec2f(eps, 0.));
  let hy = height(p + vec2f(0., eps)) - height(p - vec2f(0., eps));
  let n = normalize(vec3f(-hx / (2.0 * eps), -hy / (2.0 * eps), 1.0));

  let I = vec3f(0.0, 0.0, -1.0);          // orthographic view ray
  let ior = u.a.w;

  // Snell at the front surface (air → glass).
  let t1 = refract(I, n, 1.0 / ior);
  // March inside the slab to the flat back face.
  let z0 = u.c.z + height(p);
  let path = z0 / max(-t1.z, 1e-4);
  var q = p + t1.xy * path;
  // Snell at the back face (glass → air); TIR → genuine internal reflection.
  var t2 = refract(t1, vec3f(0.0, 0.0, 1.0), ior);
  if (all(t2 == vec3f(0.0))) { t2 = reflect(t1, vec3f(0.0, 0.0, 1.0)); }
  q += t2.xy * (u.a.z / max(abs(t2.z), 1e-4));

  var col = bg(q);
  if (u.e.w > 0.25) { col = frosted(q, p); }
  // Beer–Lambert absorption over the internal path (tint = uniform k).
  col *= exp(-u.e.rgb * path);
  // Schlick-Fresnel: reflectance rises at grazing incidence on the bezel.
  let f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let f = f0 + (1.0 - f0) * pow(1.0 - max(dot(-I, n), 0.0), 5.0);
  let r = reflect(I, n);
  var refl = bg(p + r.xy * 200.0);
  if (u.e.w > 0.25) { refl = frosted(p + r.xy * 200.0, p + vec2f(17.0, 9.0)); }
  col = mix(col, refl, f);
  return vec4f(col, 1.0);
}
`;
