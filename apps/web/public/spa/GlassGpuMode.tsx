// Route-scoped GPU glass mode: while mounted, the page's chrome surfaces are
// rendered by the WebGPU ray-traced engine (lg/gpu-glass-page.ts) and
// <html data-glass="gpu"> turns the CSS glass off (app-chrome.css). Reverts
// fully on unmount; if WebGPU is unavailable the attribute is removed and
// the page keeps its normal CSS glass — no broken in-between state.
import { useEffect } from "react";

export function GlassGpuMode() {
  useEffect(() => {
    document.documentElement.setAttribute("data-glass", "gpu");
    let cleanup: (() => void) | null = null;
    let gone = false;
    import("../lg/gpu-glass-page").then(async (m) => {
      const c = await m.mountGpuGlassPage();
      if (!c) {
        if (!gone) document.documentElement.removeAttribute("data-glass");
        return;
      }
      if (gone) c(); else cleanup = c;
    });
    return () => {
      gone = true;
      document.documentElement.removeAttribute("data-glass");
      cleanup?.();
    };
  }, []);
  return null;
}
