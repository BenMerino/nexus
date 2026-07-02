// WGSL for the scene TEXT + CHART passes (split from gpu-scene-shader.ts for
// the 150-line cap). Both write the scene texture the glass refracts, after
// the sky + rect passes: text as atlas-sampled glyph quads, charts as
// expanded polyline segments.

// The TEXT pass: one instanced quad per glyph, sampling the glyph atlas
// (coverage in .a). So text refracts through the glass exactly like the cards.
export const SCENE_TEXT_SHADER = /* wgsl */`
struct U { res: vec4f, top: vec4f, hor: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> glyphs: array<vec4f>;  // 3 vec4/glyph
@group(0) @binding(2) var atlas: texture_2d<f32>;
@group(0) @binding(3) var atlasSamp: sampler;

struct GOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> GOut {
  var q = array<vec2f, 6>(vec2f(0.,0.), vec2f(1.,0.), vec2f(0.,1.),
                          vec2f(0.,1.), vec2f(1.,0.), vec2f(1.,1.));
  let dest = glyphs[ii * 3u];        // x,y,w,h page px
  let auv = glyphs[ii * 3u + 1u];    // u0,v0,u1,v1
  let col = glyphs[ii * 3u + 2u];
  let corner = q[vi];
  let px = dest.xy + corner * dest.zw - vec2f(0.0, u.res.z);
  let ndc = vec2f(px.x / u.res.x * 2.0 - 1.0, 1.0 - px.y / u.res.y * 2.0);
  var o: GOut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  o.uv = mix(auv.xy, auv.zw, corner);
  o.color = col;
  return o;
}

@fragment
fn fs(i: GOut) -> @location(0) vec4f {
  let cov = textureSampleLevel(atlas, atlasSamp, i.uv, 0.0).a;
  if (cov <= 0.01) { discard; }
  return vec4f(i.color.rgb, i.color.a * cov);
}
`;

// The CHART pass: expanded polyline segments (series strokes) as triangle
// pairs. Each instance is one segment (p0→p1) offset by the half-width normal.
export const SCENE_POLY_SHADER = /* wgsl */`
struct U { res: vec4f, top: vec4f, hor: vec4f };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> segs: array<vec4f>;  // 2 vec4/segment

struct POut { @builtin(position) pos: vec4f, @location(0) color: vec4f };

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> POut {
  let a = segs[ii * 2u];        // x0,y0,x1,y1 page px
  let b = segs[ii * 2u + 1u];   // halfWidth, packedColor(rgba8 in bits), _, _
  let p0 = a.xy; let p1 = a.zw;
  var dir = p1 - p0;
  let len = max(length(dir), 1e-3);
  dir = dir / len;
  let nrm = vec2f(-dir.y, dir.x) * b.x;
  var q = array<vec2f, 6>(vec2f(0.,-1.), vec2f(1.,-1.), vec2f(0.,1.),
                          vec2f(0.,1.), vec2f(1.,-1.), vec2f(1.,1.));
  let c = q[vi];
  let base = mix(p0, p1, c.x);
  let px = base + nrm * c.y - vec2f(0.0, u.res.z);
  let ndc = vec2f(px.x / u.res.x * 2.0 - 1.0, 1.0 - px.y / u.res.y * 2.0);
  let bits = bitcast<u32>(b.y);
  var o: POut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  o.color = vec4f(f32(bits & 0xffu), f32((bits>>8u)&0xffu), f32((bits>>16u)&0xffu),
    f32((bits>>24u)&0xffu)) / 255.0;
  return o;
}

@fragment
fn fs(i: POut) -> @location(0) vec4f { return vec4f(i.color.rgb, i.color.a); }
`;
