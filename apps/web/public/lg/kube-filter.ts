// PER-ELEMENT kube liquid-glass filters (the upstream library's real approach:
// ObaidQatan/liquid-glass-component-library generates a size-matched filter per
// component). The old port stretched ONE normalized 256px texture over every
// surface — geometrically wrong for anything non-square (ghost edges on bars/
// chips) — and refracted EVERY glass element (severe Safari cost; its SVG
// filters are CPU-rasterized per frame).
//
// This engine instead:
//  · watches the liquid surfaces (LIQUID_HOSTS — keep in sync with the ::before
//    overlay selector lists in dna-bridge.css / app-chrome.css),
//  · measures each element's box + real border-radius,
//  · builds a filter with textures generated AT that geometry (bucketed +
//    cached, so identical cards share one filter; capped render resolution),
//  · assigns it via the host's `--_kube` custom property — the overlay CSS
//    reads `filter: var(--_kube, none)`, so unassigned/small surfaces
//    gracefully keep plain frost.
//  · SIZE GATE: nothing smaller than a real card refracts (chips/pills stay
//    frosted) — small geometry is where lens artifacts live.

// Textures come from OUR ray-traced physics (gpu-glass-map.ts — the model the
// GPU lab proved), not the vendored kube/ heuristics; kube keeps only the
// delivery mechanism (per-element size-matched filters over backdrop-filter).
import { generateGlassMaps, DISP_SCALE } from "./gpu-glass-map";
import { buildKubeFilter } from "./kube-build";
import "./kube-debug"; // console harness: window.__kubeDebug (list/outline/mode/showMap)

const LIQUID_HOSTS = [
  ".public-header", ".sidebar", ".card", ".panel", ".kpi", ".stat",
  ".surface", ".glass-surface", ".profile-hero", ".profile-panel",
].join(",");

const MIN_W = 120, MIN_H = 56;   // size gate — below this: frost only
// Capture padding: the overlay extends PAD px past the card on every side so
// the bezel has real backdrop pixels beyond the edge to bend inward. MUST
// match the overlay's `inset: -24px` + `clip-path: inset(24px …)` in
// dna-bridge.css and app-chrome.css.
const PAD = 24;
const MAX_TEX = 384;             // cap texture render resolution (px, long side)
// Geometry bucket (px). 8 keeps texture stretch ≤4px/axis (a 48 bucket offset
// the bezel/specular rim up to 24px from the real edge — visible ghosting);
// repeated components (grid cards, kpis) share exact sizes so the filter
// cache still collapses them to one entry each.
const BUCKET = 8;
const BEZEL = 18;                // lens rim width in element px
const ns = "http://www.w3.org/2000/svg";

let defsSvg: SVGSVGElement | null = null;
const filterCache = new Map<string, string>(); // bucket key -> filter id

function defsRoot(): SVGSVGElement {
  if (defsSvg && defsSvg.isConnected) return defsSvg;
  defsSvg = document.createElementNS(ns, "svg");
  defsSvg.setAttribute("width", "0"); defsSvg.setAttribute("height", "0");
  defsSvg.setAttribute("aria-hidden", "true");
  Object.assign(defsSvg.style, { position: "fixed", width: "0", height: "0", pointerEvents: "none" });
  document.body.appendChild(defsSvg);
  return defsSvg;
}

// One filter per geometry bucket. The OVERLAY the filter runs on is PAD px
// bigger than the card on every side (CSS inset: -PAD), so the capture holds
// real backdrop pixels BEYOND the card edge — a lens bezel pulls from outside
// the shape; with an exact-size capture the rim had nothing to sample and
// smeared the boundary (the residual edge artifact). The textures are placed
// at exact px (PAD, PAD, card w×h) inside that padded region, the padding
// ring is neutral-gray (no displacement), and CSS clip-path crops the result
// back to the card shape.
function ensureFilter(w: number, h: number, r: number): string | null {
  const key = `${w}x${h}r${r}`;
  const hit = filterCache.get(key);
  if (hit) return hit;

  const s = Math.min(1, MAX_TEX / Math.max(w, h));
  const maps = generateGlassMaps({
    w, h, texW: Math.max(1, Math.round(w * s)), texH: Math.max(1, Math.round(h * s)),
    radius: r, bezel: Math.min(BEZEL, w * 0.25, h * 0.25),
  });
  if (!maps) return null;

  const id = `lgk-${filterCache.size}-${w}x${h}`;
  defsRoot().appendChild(buildKubeFilter(id, w, h, PAD, maps.dispUrl, maps.specUrl, DISP_SCALE));
  filterCache.set(key, id);
  return id;
}

const bucket = (v: number) => Math.max(BUCKET, Math.round(v / BUCKET) * BUCKET);

function assign(el: HTMLElement): void {
  const { width, height } = el.getBoundingClientRect();
  if (width < MIN_W || height < MIN_H) { el.style.removeProperty("--_kube"); return; }
  const r = Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
  const id = ensureFilter(bucket(width), bucket(height), r);
  if (id) el.style.setProperty("--_kube", `url(#${id})`);
}

const seen = new WeakSet<Element>();
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    if (!(e.target as HTMLElement).isConnected) { ro.unobserve(e.target); continue; }
    assign(e.target as HTMLElement);
  }
});

let scanQueued = false;
function scan(): void {
  scanQueued = false;
  document.querySelectorAll<HTMLElement>(LIQUID_HOSTS).forEach((el) => {
    if (seen.has(el)) return;
    seen.add(el);
    ro.observe(el);  // fires immediately with the initial size → assign()
  });
}
function queueScan(): void {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(scan);
}

function boot(): void {
  scan();
  // React mounts surfaces long after load — rescan on DOM changes (rAF-coalesced).
  new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
}
if (document.body) boot();
else addEventListener("DOMContentLoaded", boot, { once: true });
