// WGSL for ONE element-owned glass surface (gpu-glass-element.ts): the canvas
// lives INSIDE the element (absolute, inset 0, z:-1 — the slot the CSS liquid
// ::before uses), so the slab is simply the whole canvas in LOCAL coordinates.
// The DOM provides stacking/scrolling/occlusion; the only global input is the
// element's viewport offset (u.a.zw), because the refraction bends the page's
// fixed sky — SKY_WGSL is the live engine's own function, so the bent image
// agrees with the background behind the element. Material = FORM_WGSL.
import { SKY_WGSL } from "../sky/sky-gpu";
import { FORM_WGSL } from "./gpu-glass-form";

export const ELEMENT_GLASS_SHADER = /* wgsl */`
struct U {
  a: vec4f,   // canvas w, h, viewport offset x, y            (device px)
  b: vec4f,   // viewport res x, y, backgroundGap, ior
  c: vec4f,   // cornerRadius, bezelRadius, slabThickness, dispersion
  top: vec4f, // sky top color (rgb 0..1), a = HDR ceiling
  hor: vec4f, // sky horizon color (rgb 0..1), a = glow intensity
  e: vec4f,   // Beer–Lambert absorption k (rgb, device-px⁻¹), frost radius (px)
  g: vec4f,   // backdrop tex w, h (device px), hasBackdrop (0/1), pageScrollY(px)
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var sceneTex: texture_2d<f32>;
@group(0) @binding(2) var sceneSamp: sampler;
${SKY_WGSL}

// p is element-local (device px). Its position on the viewport = p + element
// offset. bg() samples the GPU SCENE texture (sky + all card content, already
// scroll-composited by the scene renderer) at that viewport position — so the
// glass refracts EVERYTHING under it (cards, and later text/charts), live, at
// 60fps with no DOM capture. u.g.z = hasScene; else fall back to the sky.
fn bg(p: vec2f) -> vec3f {
  let viewPx = p + u.a.zw;
  if (u.g.z < 0.5) {
    return skyColor(viewPx / u.b.xy, u.top.rgb, u.hor, 0.5, u.top.w);
  }
  let uv = clamp(viewPx / u.b.xy, vec2f(0.0), vec2f(1.0));
  return textureSampleLevel(sceneTex, sceneSamp, uv, 0.0).rgb;
}

${FORM_WGSL}

// This element's slab: centered in, and filling, its own canvas.
fn height(p: vec2f) -> f32 {
  return formHeight(p, u.a.xy * 0.5, u.a.xy * 0.5, u.c.x, u.c.y, 0.0);
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1., -1.), vec2f(3., -1.), vec2f(-1., 3.));
  return vec4f(pos[i], 0., 1.);
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let p = frag.xy;
  if (sdRR(p, u.a.xy * 0.5, u.a.xy * 0.5, u.c.x) >= 0.0) {
    return vec4f(0.0);                    // outside the rounded corner
  }

  // Surface normal from the form's height field (central differences).
  let eps = 1.0;
  let hx = height(p + vec2f(eps, 0.)) - height(p - vec2f(eps, 0.));
  let hy = height(p + vec2f(0., eps)) - height(p - vec2f(0., eps));
  let n = normalize(vec3f(-hx / (2.0 * eps), -hy / (2.0 * eps), 1.0));

  let I = vec3f(0.0, 0.0, -1.0);          // orthographic view ray
  let ior = u.b.w;
  let h0 = height(p);

  let l = landing(p, n, ior, h0, u.c.z, u.b.z);
  var col = shade(l.xy, p, u.e.w);
  // Chromatic dispersion: red/blue trace their own IOR (u.c.w spread).
  if (u.c.w > 0.0004) {
    col.r = shade(landing(p, n, ior - u.c.w * 0.5, h0, u.c.z, u.b.z).xy, p, u.e.w).r;
    col.b = shade(landing(p, n, ior + u.c.w * 0.5, h0, u.c.z, u.b.z).xy, p, u.e.w).b;
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
