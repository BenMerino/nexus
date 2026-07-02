// WGSL for the physically-based glass element (gpu-glass.ts). One fullscreen
// pass: the background is our sky gradient (same palette as sky-gpu); the
// element is a real 3D form — a glass slab with a curvature-continuous
// (C²) cubic-eased bezel and squircle corners — and every pixel inside it
// is RAY-TRACED:
//   entry refraction (Snell, air→glass at the surface normal derived from the
//   form's height field) → march the internal ray to the flat back face →
//   exit refraction (Snell, glass→air; total internal reflection falls back
//   to a real reflection) → sample the background where the ray lands.
//   Chromatic dispersion traces red/blue at their own IOR; Beer–Lambert
//   absorption over the internal path length; Schlick-Fresnel mixes in the
//   reflected environment. No textures, no displacement maps — the optics
//   follow from the geometry.
// There is NO background pass here: the canvas is TRANSPARENT outside the
// slab, so the page's already-running #sky-bg engine shows through untouched.
// SKY_WGSL (exported by that engine — its own function, not a re-derivation)
// is evaluated ONLY for the refracted/reflected samples inside the glass, so
// the bent image agrees with the live engine behind the canvas.
import { SKY_WGSL } from "../sky/sky-gpu";
import { FORM_WGSL } from "./gpu-glass-form";

export const GLASS_SHADER = /* wgsl */`
struct U {
  a: vec4f,   // res.x, res.y, backgroundGap, ior
  b: vec4f,   // center.x, center.y, halfW, halfH   (device px)
  c: vec4f,   // cornerRadius, bezelRadius, slabThickness, glowX (0..1)
  top: vec4f, // sky top color (rgb 0..1), a = HDR ceiling
  hor: vec4f, // sky horizon color (rgb 0..1), a = glow intensity
  d: vec4f,   // gridSpacing, gridOpacity, gridHalfWidth, domeHeight (device px)
  e: vec4f,   // Beer–Lambert absorption k (rgb, device-px⁻¹), frost radius (px)
  f: vec4f,   // chromatic dispersion (nBlue − nRed), unused ×3
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

${FORM_WGSL}

// One channel's trace: Snell entry at the form's normal → march to the flat
// back face → Snell exit (TIR → genuine internal reflection) → landing point
// on the background plane. Returns (q.x, q.y, internal path length).
fn landing(p: vec2f, n: vec3f, ior: f32) -> vec3f {
  let I = vec3f(0.0, 0.0, -1.0);          // orthographic view ray
  let t1 = refract(I, n, 1.0 / ior);
  let path = (u.c.z + height(p)) / max(-t1.z, 1e-4);
  var q = p + t1.xy * path;
  var t2 = refract(t1, vec3f(0.0, 0.0, 1.0), ior);
  if (all(t2 == vec3f(0.0))) { t2 = reflect(t1, vec3f(0.0, 0.0, 1.0)); }
  q += t2.xy * (u.a.z / max(abs(t2.z), 1e-4));
  return vec3f(q, path);
}

// What the ray sees where it lands: the background, scattered if frosted.
fn shade(q: vec2f, seed: vec2f) -> vec3f {
  if (u.e.w > 0.25) { return frosted(q, seed); }
  return bg(q);
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

  let l = landing(p, n, ior);
  var col = shade(l.xy, p);
  // Chromatic dispersion: IOR is wavelength-dependent (u.f.x = nBlue − nRed
  // spread), so red and blue trace their own paths and land elsewhere — the
  // rim fringes into color exactly where the bending is strongest.
  if (u.f.x > 0.0004) {
    col.r = shade(landing(p, n, ior - u.f.x * 0.5).xy, p).r;
    col.b = shade(landing(p, n, ior + u.f.x * 0.5).xy, p).b;
  }
  // Beer–Lambert absorption over the internal path (tint = uniform k).
  col *= exp(-u.e.rgb * l.z);
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
