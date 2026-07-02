// WGSL for the physically-based glass element (gpu-glass.ts). One fullscreen
// pass: the background is our sky gradient (same palette as sky-gpu); the
// element is a real 3D form — a glass slab whose edge is a quarter-circle
// bezel — and every pixel inside it is RAY-TRACED:
//   entry refraction (Snell, air→glass at the surface normal derived from the
//   form's height field) → march the internal ray to the flat back face →
//   exit refraction (Snell, glass→air; total internal reflection falls back
//   to a real reflection) → sample the background where the ray lands.
//   Beer–Lambert absorption over the internal path length; Schlick-Fresnel
//   mixes in the reflected environment. No textures, no displacement maps —
//   the optics follow from the geometry.
export const GLASS_SHADER = /* wgsl */`
struct U {
  a: vec4f,   // res.x, res.y, backgroundGap, ior
  b: vec4f,   // center.x, center.y, halfW, halfH   (device px)
  c: vec4f,   // cornerRadius, bezelRadius, slabThickness, unused
  top: vec4f, // sky top color (rgb 0..1)
  hor: vec4f, // sky horizon color (rgb 0..1)
};
@group(0) @binding(0) var<uniform> u: U;

fn sky(p: vec2f) -> vec3f {
  let v = clamp((p.y / u.a.y - 0.35) / 0.65, 0.0, 1.0);
  return mix(u.top.rgb, u.hor.rgb, v);
}

// Signed distance to the element's rounded-rect footprint (device px).
fn sdRR(p: vec2f) -> f32 {
  let q = abs(p - u.b.xy) - u.b.zw + vec2f(u.c.x);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - u.c.x;
}

// The element's physical form: a flat-topped slab whose rim is a quarter-
// circle of radius = bezel. h is height ABOVE the flat back face's top.
fn height(p: vec2f) -> f32 {
  let e = -sdRR(p);                       // distance in from the edge
  if (e <= 0.0) { return 0.0; }
  let x = min(e / u.c.y, 1.0);
  return u.c.y * sqrt(max(0.0, 1.0 - (1.0 - x) * (1.0 - x)));
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1., -1.), vec2f(3., -1.), vec2f(-1., 3.));
  return vec4f(pos[i], 0., 1.);
}

@fragment
fn fs(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let p = frag.xy;
  if (sdRR(p) >= 0.0) { return vec4f(sky(p), 1.0); }

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

  var col = sky(q);
  // Beer–Lambert absorption over the internal path (faint cool glass tint).
  col *= exp(-vec3f(0.0035, 0.0028, 0.0018) * path);
  // Schlick-Fresnel: reflectance rises at grazing incidence on the bezel.
  let f0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let f = f0 + (1.0 - f0) * pow(1.0 - max(dot(-I, n), 0.0), 5.0);
  let r = reflect(I, n);
  col = mix(col, sky(p + r.xy * 200.0), f);
  return vec4f(col, 1.0);
}
`;
