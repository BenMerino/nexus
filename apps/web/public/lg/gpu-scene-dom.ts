// Build the GPU scene from the live DOM: card surfaces as rect nodes + their
// visible TEXT as text nodes, at true page positions. The scene renderer draws
// these into the texture the glass refracts — so glass over content refracts
// the actual cards AND their text, naturally, no scroll hacks. Charts (canvas/
// svg) are handled separately (gpu-scene-charts). DOM stays for layout + hit-
// testing; the GPU scene is what's seen.
import { cornerRadius } from "./gpu-glass-surfaces";
import type { Scene, SceneNode, TextNode } from "./gpu-scene-model";
import { harvestText } from "./gpu-scene-text-dom";

const CONTENT_HOSTS = ".card, .panel, .kpi, .stat, .surface, .glass-surface, .profile-hero, .profile-panel";

function parseColor(css: string): [number, number, number, number] | null {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((s) => parseFloat(s));
  if (p.length < 3) return null;
  return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] ?? 1];
}

// Read the AUTHOR fill once, before the GPU-mode CSS zeroes the DOM background.
export function captureAuthorColor(el: HTMLElement): void {
  if (el.dataset.gpuColor) return;
  const c = parseColor(getComputedStyle(el).backgroundColor);
  el.dataset.gpuColor = c ? c.join(",") : "1,1,1,0.06";
}

export function buildSceneFromDOM(scrollY: number): Scene {
  const nodes: SceneNode[] = [];
  let contentHeight = 0;
  for (const el of document.querySelectorAll<HTMLElement>(CONTENT_HOSTS)) {
    if (el.parentElement?.closest(CONTENT_HOSTS)) continue;   // top-level surface
    const b = el.getBoundingClientRect();
    if (b.width < 8 || b.height < 8) continue;
    const cached = el.dataset.gpuColor?.split(",").map(Number);
    const color = (cached && cached.length === 4 ? cached
      : parseColor(getComputedStyle(el).backgroundColor)) as [number, number, number, number]
      ?? [1, 1, 1, 0.06];
    nodes.push({ kind: "rect", x: b.left, y: b.top + scrollY, w: b.width, h: b.height,
      r: cornerRadius(el), color });
    // Harvest this surface's text runs into text nodes (page coords).
    for (const t of harvestText(el, scrollY)) nodes.push(t);
    contentHeight = Math.max(contentHeight, b.bottom + scrollY);
  }
  return { nodes, contentHeight };
}

export type { TextNode };
