// WGSL for the SCENE pass: draws the sky, then every card rect (squircle SDF,
// C² corners — same 4-norm as the glass form) on top, into the offscreen
// scene texture the glass refracts. Instanced: one quad per rect, positioned
// in page space then shifted by scroll. This is the "everything is GPU" layer;
// later slices add text/chart instances to the same pass.
import { SKY_WGSL } from "../sky/sky-gpu";

export const SCENE_SHADER = /* wgsl */`
struct U {
  res: vec4f,     // viewport w, h (device px), scrollY (px), rectCount
  top: vec4f,     // sky top rgb, a = HDR ceiling
  hor: vec4f,     // sky horizon rgb, a = glow intensity
};
@group(0) @binding(0) var<uniform> u: U;
// 8 floats/rect: (x,y,w,h) page px, (r, packedRGBA, _, _).
@group(0) @binding(1) var<storage, read> rects: array<vec4f>;
${SKY_WGSL}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f,   // px from rect center
  @location(1) half: vec2f,    // rect half-size px
  @location(2) rr: f32,        // corner radius px
  @location(3) color: vec4f,
};

fn unpack(c: f32) -> vec4f {
  let bits = bitcast<u32>(c);
  return vec4f(f32(bits & 0xffu), f32((bits >> 8u) & 0xffu),
    f32((bits >> 16u) & 0xffu), f32((bits >> 24u) & 0xffu)) / 255.0;
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  // Unit quad (two triangles) → rect box, in page px, minus scroll.
  var q = array<vec2f, 6>(vec2f(0.,0.), vec2f(1.,0.), vec2f(0.,1.),
                          vec2f(0.,1.), vec2f(1.,0.), vec2f(1.,1.));
  let a = rects[ii * 2u];        // x,y,w,h
  let b = rects[ii * 2u + 1u];   // r, packedColor, _, _
  let corner = q[vi];
  let px = a.xy + corner * a.zw - vec2f(0.0, u.res.z);
  let ndc = vec2f(px.x / u.res.x * 2.0 - 1.0, 1.0 - px.y / u.res.y * 2.0);
  var o: VOut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  o.half = a.zw * 0.5;
  o.local = (corner - vec2f(0.5)) * a.zw;
  o.rr = b.x;
  o.color = unpack(b.y);
  return o;
}

// Squircle SDF (4-norm corner) — matches the glass form's corners.
fn sdRR(p: vec2f, half: vec2f, r: f32) -> f32 {
  let q = abs(p) - half + vec2f(r);
  let m = max(q, vec2f(0.0));
  let m2 = m * m;
  return pow(dot(m2, m2), 0.25) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs(i: VOut) -> @location(0) vec4f {
  let d = sdRR(i.local, i.half, i.rr);
  let aa = 1.0 - smoothstep(-1.0, 1.0, d);   // 1px antialiased edge
  if (aa <= 0.0) { discard; }
  return vec4f(i.color.rgb, i.color.a * aa);
}
`;

// The sky base pass (fullscreen), so the scene texture starts as the sky and
// rects composite over it — one texture holds the whole background the glass
// samples. Separate tiny shader keeps the scene pass instanced-only.
export const SCENE_SKY_SHADER = /* wgsl */`
struct U { res: vec4f, top: vec4f, hor: vec4f };
@group(0) @binding(0) var<uniform> u: U;
${SKY_WGSL}
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f,3>(vec2f(-1.,-1.), vec2f(3.,-1.), vec2f(-1.,3.));
  return vec4f(p[i], 0., 1.);
}
@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  return vec4f(skyColor(frag.xy / u.res.xy, u.top.rgb, u.hor, 0.5, u.top.w), 1.0);
}
`;
