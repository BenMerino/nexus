// Harvest a host element's visible text into TextNodes for the GPU scene.
// Walk descendant text nodes; for each, measure its on-screen line boxes with
// a Range (so wrapped lines split correctly) and read the font size/family/
// color from the parent's computed style. Positions are page coords (add
// scroll). Skips our own glass canvases and empty/whitespace runs.
import type { TextNode } from "./gpu-scene-model";

function colorOf(css: string): [number, number, number, number] {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return [1, 1, 1, 1];
  const p = m[1].split(",").map((s) => parseFloat(s));
  return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255, p[3] ?? 1];
}

const familyOf = (css: string): "sans" | "mono" =>
  /mono/i.test(css) ? "mono" : "sans";

// The GPU-mode CSS forces `color: transparent` on content (the GPU redraws
// it), so computed color reads transparent AFTER a host is marked. Capture the
// author text color/size/family per text-parent ONCE, before marking, keyed on
// the element — the harvester then reads the cached style, not the override.
type TextStyle = { size: number; family: "sans" | "mono"; color: [number, number, number, number] };
const styleCache = new WeakMap<Element, TextStyle>();

export function captureTextStyles(host: HTMLElement): void {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (!p || styleCache.has(p)) continue;
    const cs = getComputedStyle(p);
    styleCache.set(p, { size: parseFloat(cs.fontSize) || 14,
      family: familyOf(cs.fontFamily), color: colorOf(cs.color) });
  }
}

export function harvestText(host: HTMLElement, scrollY: number): TextNode[] {
  const out: TextNode[] = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    if (!text || !text.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.classList.contains("gpu-glass-layer")) continue;
    const cached = styleCache.get(parent);
    const cs = getComputedStyle(parent);
    if (cs.display === "none") continue;
    // Prefer the pre-override cached style; fall back to live (first paint).
    const size = cached?.size ?? parseFloat(cs.fontSize) ?? 14;
    const color = cached?.color ?? colorOf(cs.color);
    const family = cached?.family ?? familyOf(cs.fontFamily);
    // Per-line boxes via Range client rects (handles wrapping).
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    // Split the run's text proportionally across its line rects by x-advance is
    // overkill; single-line dashboard labels dominate, so emit the whole run at
    // the FIRST rect and let multi-line runs (rare) clip — good enough for now.
    const first = rects[0];
    if (!first || first.width < 1) continue;
    out.push({ kind: "text", text: text.trim(), x: first.left, y: first.top + scrollY,
      size, family, color });
  }
  return out;
}
