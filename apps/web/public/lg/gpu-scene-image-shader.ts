// WGSL for the scene IMAGE pass: one textured quad per image node (a chart
// canvas blitted into the scene), so charts refract through the glass like
// every other layer. Position/size come from the per-node uniform; the source
// texture is sampled straight (already the chart's rendered pixels).
export const IMAGE_SHADER = /* wgsl */`
struct U {
  rect: vec4f,   // x, y, w, h (device px, viewport-relative)
  res: vec4f,    // viewport w, h, _, _
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var img: texture_2d<f32>;
@group(0) @binding(2) var imgSamp: sampler;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  var q = array<vec2f, 6>(vec2f(0.,0.), vec2f(1.,0.), vec2f(0.,1.),
                          vec2f(0.,1.), vec2f(1.,0.), vec2f(1.,1.));
  let c = q[vi];
  let px = u.rect.xy + c * u.rect.zw;
  let ndc = vec2f(px.x / u.res.x * 2.0 - 1.0, 1.0 - px.y / u.res.y * 2.0);
  var o: VOut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  o.uv = c;
  return o;
}

@fragment
fn fs(i: VOut) -> @location(0) vec4f {
  return textureSampleLevel(img, imgSamp, i.uv, 0.0);
}
`;
