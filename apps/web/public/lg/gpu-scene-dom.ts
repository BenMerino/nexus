// Build the GPU scene from the live DOM (slice 1): read each CONTENT surface's
// box (page coords), corner radius and background color, and emit a rect node.
// The scene renderer draws these into the texture the glass refracts, so the
// glass bends the real card layout at 60fps. Fixed chrome (header/sidebar) is
// excluded — it IS the glass, not content behind it. Later slices add text and
// chart nodes read from the same DOM.
import { cornerRadius } from "./gpu-glass-surfaces";
import type { Scene, SceneNode } from "./gpu-scene-model";

// Content hosts = the glass surfaces MINUS fixed chrome (that's the glass).
const CONTENT_HOSTS = ".card, .panel, .kpi, .stat, .surface, .glass-surface, .profile-hero, .profile-panel";

function parseColor(css: string): [number, number, number, number] | null {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((s) => parseFloat(s));
  if (p.length < 3) return null;
  return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] ?? 1];
}

// The GPU-mode CSS zeroes each host's own background (it's drawn on the GPU
// now), so getComputedStyle would read transparent. Capture the AUTHOR color
// once, before the host is marked, and cache it on the element.
export function captureAuthorColor(el: HTMLElement): void {
  if (el.dataset.gpuColor) return;
  const c = parseColor(getComputedStyle(el).backgroundColor);
  el.dataset.gpuColor = c ? c.join(",") : "1,1,1,0.06";
}

export function buildSceneFromDOM(scrollY: number): Scene {
  const nodes: SceneNode[] = [];
  let contentHeight = 0;
  for (const el of document.querySelectorAll<HTMLElement>(CONTENT_HOSTS)) {
    if (el.parentElement?.closest(CONTENT_HOSTS)) continue;   // top-level only
    const b = el.getBoundingClientRect();
    if (b.width < 8 || b.height < 8) continue;
    const cached = el.dataset.gpuColor?.split(",").map(Number);
    const color = (cached && cached.length === 4 ? cached
      : parseColor(getComputedStyle(el).backgroundColor)) as [number, number, number, number] ?? [1, 1, 1, 0.06];
    // b.top is viewport-relative; scene model wants page coords (add scroll).
    nodes.push({
      kind: "rect", x: b.left, y: b.top + scrollY, w: b.width, h: b.height,
      r: cornerRadius(el), color,
    });
    contentHeight = Math.max(contentHeight, b.bottom + scrollY);
  }
  return { nodes, contentHeight };
}
