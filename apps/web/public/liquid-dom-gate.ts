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
  // HTML-in-Canvas: the drawElement SYMBOL exists in Chrome even with the flag
  // OFF — so presence ≠ enabled. Actually INVOKE it on a throwaway canvas; flag
  // off → it throws → caught → unsupported, so liquid-dom never loads and never
  // shows its "enable the HTML-in-Canvas flag" takeover screen.
  try {
    const ctx = document.createElement("canvas").getContext("2d") as
      (CanvasRenderingContext2D & { drawElement?: (el: Element, x: number, y: number) => void }) | null;
    if (!ctx || typeof ctx.drawElement !== "function") return false;
    ctx.drawElement(document.createElement("div"), 0, 0);
    return true;
  } catch { return false; }
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
