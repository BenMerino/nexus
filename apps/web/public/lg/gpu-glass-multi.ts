// WGSL for the MULTI-SLAB page glass (gpu-glass-page.ts): the app's chrome
// surfaces (header, sidebar, cards) as ray-traced slabs in ONE fullscreen
// pass. Slab rects stream in via a storage buffer (collected from live DOM
// rects each redraw); the material — form + optics — is the same FORM_WGSL
// the lab shader uses. Each pixel finds the slab it's deepest inside and
// runs the full trace against that slab's geometry. Outside every slab the
// canvas is transparent: the live #sky-bg engine below stays the one
// background, and SKY_WGSL is evaluated only for refracted/reflected samples.
// Known limit, stated on purpose: slabs refract the SKY, not DOM content
// passing beneath them (that would need the page rendered to a texture).
import { SKY_WGSL } from "../sky/sky-gpu";
import { FORM_WGSL } from "./gpu-glass-form";

export const MULTI_GLASS_SHADER = /* wgsl */`
struct U {
  a: vec4f,   // res.x, res.y, backgroundGap, ior
  b: vec4f,   // bezelRadius, slabThickness, dispersion, slabCount
  top: vec4f, // sky top color (rgb 0..1), a = HDR ceiling
  hor: vec4f, // sky horizon color (rgb 0..1), a = glow intensity
  e: vec4f,   // Beer–Lambert absorption k (rgb, device-px⁻¹), frost radius (px)
};
@group(0) @binding(0) var<uniform> u: U;
// Two vec4f per slab: (center.x, center.y, halfW, halfH), (cornerRadius, …).
@group(0) @binding(1) var<storage, read> slabs: array<vec4f>;
${SKY_WGSL}

fn bg(p: vec2f) -> vec3f {
  return skyColor(p / u.a.xy, u.top.rgb, u.hor, 0.5, u.top.w);
}

${FORM_WGSL}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1., -1.), vec2f(3., -1.), vec2f(-1., 3.));
  return vec4f(pos[i], 0., 1.);
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let p = frag.xy;

  // The slab this pixel is deepest inside (min signed distance).
  let count = u32(u.b.w);
  var best = 1e9;
  var bi = 0u;
  for (var i = 0u; i < count; i++) {
    let d = sdRR(p, slabs[2u * i].xy, slabs[2u * i].zw, slabs[2u * i + 1u].x);
    if (d < best) { best = d; bi = i; }
  }
  if (count == 0u || best >= 0.0) { return vec4f(0.0); }  // transparent
  let c = slabs[2u * bi].xy;
  let hb = slabs[2u * bi].zw;
  let r = slabs[2u * bi + 1u].x;

  // Surface normal from this slab's height field (central differences).
  let eps = 1.0;
  let hx = formHeight(p + vec2f(eps, 0.), c, hb, r, u.b.x, 0.0)
         - formHeight(p - vec2f(eps, 0.), c, hb, r, u.b.x, 0.0);
  let hy = formHeight(p + vec2f(0., eps), c, hb, r, u.b.x, 0.0)
         - formHeight(p - vec2f(0., eps), c, hb, r, u.b.x, 0.0);
  let n = normalize(vec3f(-hx / (2.0 * eps), -hy / (2.0 * eps), 1.0));

  let I = vec3f(0.0, 0.0, -1.0);          // orthographic view ray
  let ior = u.a.w;
  let h0 = formHeight(p, c, hb, r, u.b.x, 0.0);

  let l = landing(p, n, ior, h0, u.b.y, u.a.z);
  var col = shade(l.xy, p, u.e.w);
  // Chromatic dispersion: red/blue trace their own IOR (u.b.z spread).
  if (u.b.z > 0.0004) {
    col.r = shade(landing(p, n, ior - u.b.z * 0.5, h0, u.b.y, u.a.z).xy, p, u.e.w).r;
    col.b = shade(landing(p, n, ior + u.b.z * 0.5, h0, u.b.y, u.a.z).xy, p, u.e.w).b;
  }
  // Beer–Lambert absorption over the internal path (tint = uniform k).
  col *= exp(-u.e.rgb * l.z);
  // Schlick-Fresnel: reflectance rises at grazing incidence on the bezel.
  let f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let f = f0 + (1.0 - f0) * pow(1.0 - max(dot(-I, n), 0.0), 5.0);
  let rf = reflect(I, n);
  col = mix(col, shade(p + rf.xy * 200.0, p + vec2f(17.0, 9.0), u.e.w), f);
  return vec4f(col, 1.0);
}
`;
