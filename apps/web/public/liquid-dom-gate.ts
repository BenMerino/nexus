// Liquid-dom capability gate — ships to ALL pages, activates only where the
// environment actually supports liquid-dom's requirements; otherwise our own
// glass (data-liquid, the SVG/blur recipe) stays untouched. Progressive
// enhancement: never breaks the baseline.
//
// liquid-dom needs: (1) WebGPU, and (2) the experimental HTML-in-Canvas API
// (<canvas layoutsubtree> / element draw) — available only behind a Chrome flag
// today. We detect BOTH before loading the 1.2 MB core, so unsupported users
// never download or run it and keep the standard glass.

function supportsLiquidDom(): boolean {
  if (typeof window === "undefined") return false;
  // WebGPU present?
  if (!("gpu" in navigator)) return false;
  // HTML-in-Canvas: the canvas must accept the `layoutsubtree` attribute AND the
  // 2D/GPU context must expose element-drawing. Feature-detect the attribute path
  // liquid-dom uses (setAttribute("layoutsubtree")) by probing for the API that
  // backs it — `CanvasRenderingContext2D.prototype.drawElement` (HTML-in-Canvas).
  const proto = (window as { CanvasRenderingContext2D?: { prototype?: object } })
    .CanvasRenderingContext2D?.prototype;
  const hasDrawElement = !!proto && "drawElement" in proto;
  return hasDrawElement;
}

export async function initLiquidDom(): Promise<void> {
  if (!supportsLiquidDom()) return; // → keep our glass (data-liquid stays)

  document.documentElement.setAttribute("data-liquid-dom", "");
  try {
    // Lazy — the 1.2 MB core only loads on a supporting browser. mountLiquidGlass
    // builds the liquid-dom scene over the page surfaces.
    const { mountLiquidGlass } = await import("./liquid-dom-mount");
    await mountLiquidGlass();
  } catch {
    // Any failure (device lost, API quirk) → fall back: drop the marker so our
    // glass governs again. Never leaves a broken half-state.
    document.documentElement.removeAttribute("data-liquid-dom");
  }
}

initLiquidDom();
