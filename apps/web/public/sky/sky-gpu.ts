// WebGPU sky renderer: float16 / display-p3 / extended (HDR) canvas. The shader
// draws a vertical gradient (dome→horizon) + an azimuth-positioned horizon glow,
// in GAMMA-ENCODED display-p3 (a p3 float canvas wants encoded values, NOT
// linear), pushing the glow core above 1.0 for HDR bloom where the display has
// headroom. Hue-preserving knee compresses only the >1.0 part so warm tones
// never clip to white. Returns null if WebGPU/context is unavailable (→ CSS).

type RGB = [number, number, number];

const SHADER = /* wgsl */`
struct U {
  topc : vec4f,    // sky-top color (rgb), a unused
  horc : vec4f,    // horizon color (rgb), a = glow intensity (HDR, >1 on core)
  res  : vec2f,    // canvas px (vec2f → 8-byte aligned on a 16B boundary)
  glowX: f32,      // horizon-glow center, 0..1 across the width
  ceil : f32,      // display headroom ceiling (1.0 SDR, >1 HDR)
};
@group(0) @binding(0) var<uniform> u : U;

@vertex
fn vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4f {
  var p = array<vec2f,3>(vec2f(-1.,-1.), vec2f(3.,-1.), vec2f(-1.,3.));
  return vec4f(p[i], 0., 1.);
}

@fragment
fn fs(@builtin(position) frag : vec4f) -> @location(0) vec4f {
  let uv = frag.xy / u.res;                 // 0..1, y down
  let v = clamp((uv.y - 0.35) / 0.65, 0., 1.);
  var col = mix(u.topc.rgb, u.horc.rgb, v);

  let d = vec2f((uv.x - u.glowX) / 0.6, (uv.y - 1.0) / 0.42);
  let g = clamp(1.0 - length(d), 0., 1.);
  col = col + u.horc.rgb * (g * g) * u.horc.a;

  // Hue-preserving rolloff for the over-range (HDR) part only. Values in [0,1]
  // pass through untouched; above 1.0 we knee luminance toward the ceiling,
  // scaling the whole RGB vector so the warm glow keeps its hue.
  let lum = dot(col, vec3f(0.2126, 0.7152, 0.0722));
  if (lum > 1.0 && u.ceil > 1.0) {
    let over = lum - 1.0;
    let knee = 1.0 + (u.ceil - 1.0) * (over / (over + (u.ceil - 1.0)));
    col = col * (knee / lum);
  }
  return vec4f(col, 1.0);
}
`;

// SDR → 1.0 (no headroom); HDR → conservative ceiling. No exact-nits API today.
const displayHeadroom = () =>
  (window.matchMedia && matchMedia("(dynamic-range: high)").matches) ? 2.0 : 1.0;

export interface SkyGPU {
  hdr: boolean;
  resize(): void;
  draw(top: RGB, hor: RGB, glowX: number, glowHDR: number): void;
}

export async function initSkyGPU(canvas: HTMLCanvasElement): Promise<SkyGPU | null> {
  if (!navigator.gpu) return null;
  let device: GPUDevice;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    device = await adapter.requestDevice();
  } catch { return null; }

  const ctx = canvas.getContext("webgpu");
  if (!ctx) return null;

  const format: GPUTextureFormat = "rgba16float";
  const headroom = displayHeadroom();
  let hdr = false;
  const base: GPUCanvasConfiguration = { device, format, colorSpace: "display-p3", alphaMode: "opaque" };
  try {
    ctx.configure({ ...base, toneMapping: { mode: "extended" } } as GPUCanvasConfiguration);
    hdr = headroom > 1.0;
  } catch {
    try { ctx.configure(base); } catch { return null; }
  }
  const ceil = hdr ? headroom : 1.0;

  const mod = device.createShaderModule({ code: SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const ubuf = device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: ubuf } }],
  });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  };
  resize();

  const enc = (c: RGB) => c.map(v => v / 255);
  const draw = (top: RGB, hor: RGB, glowX: number, glowHDR: number) => {
    const lt = enc(top), lh = enc(hor);
    device.queue.writeBuffer(ubuf, 0, new Float32Array([
      lt[0], lt[1], lt[2], 0,
      lh[0], lh[1], lh[2], glowHDR,
      canvas.width, canvas.height, glowX, ceil,
    ]));
    const cmd = device.createCommandEncoder();
    const pass = cmd.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store",
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([cmd.finish()]);
  };

  return { hdr, resize, draw };
}
