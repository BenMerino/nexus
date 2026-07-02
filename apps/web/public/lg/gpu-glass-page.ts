// Orchestrator for the per-element GPU glass mode (route-scoped — see
// spa/GlassGpuMode.tsx). One device + one pipeline; every glass host gets a
// small WebGPU canvas INSIDE itself (gpu-glass-element.ts), so each element
// contains its own glass and its own content — the DOM provides stacking,
// scrolling and occlusion. New hosts attach as React mounts them
// (MutationObserver); size changes redraw via ResizeObserver; scroll only
// refreshes the sky-sample offsets, since the canvases move with their
// elements. Unmount detaches everything and restores the CSS glass.
import { skyFor } from "../sky/sky-palette";
import { getSkyMode, forcedAltitude } from "../sky/sky-mode";
import { displayHeadroom } from "../sky/sky-gpu";
import { ELEMENT_GLASS_SHADER } from "./gpu-glass-element-shader";
import { GLASS_HOSTS } from "./gpu-glass-surfaces";
import { attachSurface, detachSurface, drawSurface } from "./gpu-glass-element";
import type { Shared, Surface, Frame } from "./gpu-glass-element";

export async function mountGpuGlassPage(): Promise<(() => void) | false> {
  if (!navigator.gpu) return false;
  let device: GPUDevice;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
  } catch { return false; }

  // Decide the canvas format ONCE on a probe context (the pipeline's target
  // format must match every canvas): float16/P3/extended when available.
  let format: GPUTextureFormat = "rgba16float";
  let extended = true;
  const probe = document.createElement("canvas").getContext("webgpu");
  if (!probe) return false;
  const configure = (ctx: GPUCanvasContext) => {
    if (extended) {
      ctx.configure({ device, format, colorSpace: "display-p3", alphaMode: "premultiplied",
        toneMapping: { mode: "extended" } } as GPUCanvasConfiguration);
    } else {
      ctx.configure({ device, format, alphaMode: "premultiplied" });
    }
  };
  try { configure(probe); } catch {
    extended = false;
    format = navigator.gpu.getPreferredCanvasFormat();
    try { configure(probe); } catch { return false; }
  }
  const hdr = extended && displayHeadroom() > 1;

  const mod = device.createShaderModule({ code: ELEMENT_GLASS_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: mod, entryPoint: "vs" },
    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const sh: Shared = { device, pipeline, configure };

  const surfaces = new Map<HTMLElement, Surface>();
  const ro = new ResizeObserver(() => schedule());

  const scan = () => {
    for (const el of document.querySelectorAll<HTMLElement>(GLASS_HOSTS)) {
      if (surfaces.has(el)) continue;
      const s = attachSurface(sh, el);
      if (!s) continue;
      surfaces.set(el, s);
      el.dataset.gpuGlass = "1";   // CSS drops this host's own glass (app-chrome.css)
      ro.observe(el);
    }
  };

  const draw = () => {
    for (const [el, s] of surfaces) {
      if (el.isConnected) continue;
      ro.unobserve(el);
      detachSurface(s);
      surfaces.delete(el);
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const alt = forcedAltitude(getSkyMode());
    const sky = skyFor(alt);
    const gold = Math.max(0, Math.min(1, 1 - Math.abs(alt) / 8));
    const ceil = hdr ? displayHeadroom() : 1.0;
    const f: Frame = {
      dpr, vw: innerWidth * dpr, vh: innerHeight * dpr,
      top: sky.top.map((v: number) => v / 255), hor: sky.hor.map((v: number) => v / 255),
      ceil, glow: 1.0 + gold * (ceil - 1.0),
    };
    const enc = device.createCommandEncoder();
    let any = false;
    for (const s of surfaces.values()) if (drawSurface(sh, s, enc, f)) any = true;
    if (any) device.queue.submit([enc.finish()]);
  };

  // rAF-coalesced: scan for new hosts, then redraw everything visible.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); draw(); });
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["style", "class"] });
  document.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("nexus:sky-mode", schedule);
  window.addEventListener("nexus:theme-tokens", schedule);
  document.fonts?.ready.then(schedule);

  scan();
  draw();
  return () => {
    mo.disconnect();
    ro.disconnect();
    document.removeEventListener("scroll", schedule, { capture: true } as EventListenerOptions);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("nexus:sky-mode", schedule);
    window.removeEventListener("nexus:theme-tokens", schedule);
    for (const [el, s] of surfaces) {
      delete el.dataset.gpuGlass;
      detachSurface(s);
    }
    surfaces.clear();
    device.destroy();
  };
}
