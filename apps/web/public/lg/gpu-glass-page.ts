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
import { GLASS_HOSTS } from "./gpu-glass-surfaces";
import { attachSurface, detachSurface, drawSurface } from "./gpu-glass-element";
import type { Surface, Frame } from "./gpu-glass-element";
import { createSceneRenderer } from "./gpu-scene-render";
import { buildSceneFromDOM, captureAuthorColor } from "./gpu-scene-dom";
import { captureTextStyles } from "./gpu-scene-text-dom";
import { bootGlassDevice } from "./gpu-glass-device";

const dprNow = () => Math.min(window.devicePixelRatio || 1, 2);

export async function mountGpuGlassPage(): Promise<(() => void) | false> {
  const boot = await bootGlassDevice();
  if (!boot) return false;
  const { device, sh, hdr } = boot;

  // The GPU SCENE: sky + card content drawn into an offscreen texture the
  // glass refracts — "everything is GPU", 60fps, no DOM capture. The scene is
  // built each frame from the live DOM rects (slice 1: colored card bodies;
  // later slices add text/chart geometry). Content scrolls inside .main.
  const scene = createSceneRenderer(device, Math.round(innerWidth * dprNow()),
    Math.round(innerHeight * dprNow()));
  const scrollY = () => {
    const m = document.querySelector<HTMLElement>(".main, .public-content");
    return m ? m.scrollTop : window.scrollY;
  };

  const surfaces = new Map<HTMLElement, Surface>();
  const ro = new ResizeObserver(() => schedule());

  const scan = () => {
    for (const el of document.querySelectorAll<HTMLElement>(GLASS_HOSTS)) {
      if (surfaces.has(el)) continue;
      captureAuthorColor(el);      // read the fill BEFORE the CSS zeroes it
      captureTextStyles(el);       // read text color/size BEFORE it's zeroed
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
    const skyFrame = {
      top: sky.top.map((v: number) => v / 255), hor: sky.hor.map((v: number) => v / 255),
      ceil, glow: 1.0 + gold * (ceil - 1.0),
    };

    // Render the GPU scene (sky + card content) at the current scroll, then let
    // the glass sample it. This is the whole "everything is GPU" pass.
    scene.resize(Math.round(innerWidth * dpr), Math.round(innerHeight * dpr));
    scene.render(buildSceneFromDOM(scrollY()), scrollY() * dpr, skyFrame, dpr);

    const f: Frame = {
      dpr, vw: innerWidth * dpr, vh: innerHeight * dpr,
      top: skyFrame.top, hor: skyFrame.hor, ceil, glow: skyFrame.glow,
      sceneTex: scene.texture,
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
    scene.destroy();
    fallbackTex.destroy();
    device.destroy();
  };
}
