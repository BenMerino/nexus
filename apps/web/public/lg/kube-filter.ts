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

import { generateDisplacementTexture } from "./kube/displacementTexture";
import { generateSpecularTexture } from "./kube/specularTexture";
import "./kube-debug"; // console harness: window.__kubeDebug (list/outline/mode/showMap)

const LIQUID_HOSTS = [
  ".public-header", ".sidebar", ".card", ".panel", ".kpi", ".stat",
  ".surface", ".glass-surface", ".profile-hero", ".profile-panel",
].join(",");

const MIN_W = 120, MIN_H = 56;   // size gate — below this: frost only
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

// One filter per geometry bucket: textures rendered at (possibly downscaled)
// element proportions; feImage 100% stretches them back — geometry preserved.
function ensureFilter(w: number, h: number, r: number): string | null {
  const key = `${w}x${h}r${r}`;
  const hit = filterCache.get(key);
  if (hit) return hit;

  const s = Math.min(1, MAX_TEX / Math.max(w, h));
  const bez = Math.min(BEZEL, w * 0.25, h * 0.25) * s;
  const opt = { width: w * s, height: h * s, bezel: bez, profile: "convex-circle" as const,
    borderRadius: r * s };
  const disp = generateDisplacementTexture({ ...opt, thickness: 120, samples: 128 });
  const spec = generateSpecularTexture({ ...opt, lightAngle: -150, shininess: 40 });
  if (!disp || !spec) return null;

  const id = `lgk-${filterCache.size}-${w}x${h}`;
  const f = document.createElementNS(ns, "filter");
  f.id = id;
  // linearRGB (spec default): sRGB filter math quantizes visibly in Safari's
  // software SVG pipeline. Region = exactly the element box so the bezel and
  // specular rim sit ON the edges (an oversized region floats them outside —
  // that was the ghost-edge artifact).
  f.setAttribute("color-interpolation-filters", "linearRGB");
  f.setAttribute("filterUnits", "objectBoundingBox");
  f.setAttribute("primitiveUnits", "userSpaceOnUse");
  f.setAttribute("x", "0"); f.setAttribute("y", "0");
  f.setAttribute("width", "1"); f.setAttribute("height", "1");

  const img = (href: string, result: string) => {
    const e = document.createElementNS(ns, "feImage");
    e.setAttribute("href", href);
    e.setAttribute("x", "0"); e.setAttribute("y", "0");
    e.setAttribute("width", "100%"); e.setAttribute("height", "100%");
    e.setAttribute("preserveAspectRatio", "none");
    e.setAttribute("result", result);
    return e;
  };
  const blur = document.createElementNS(ns, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "2");
  blur.setAttribute("result", "blurred");
  const dm = document.createElementNS(ns, "feDisplacementMap");
  dm.setAttribute("in", "blurred"); dm.setAttribute("in2", "disp");
  dm.setAttribute("scale", "32"); // px of max bend — stays inside the capture
  dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G");
  dm.setAttribute("result", "refracted");
  const blend = document.createElementNS(ns, "feBlend");
  blend.setAttribute("in", "spec"); blend.setAttribute("in2", "refracted");
  blend.setAttribute("mode", "screen");

  f.append(img(disp.url, "disp"), img(spec, "spec"), blur, dm, blend);
  defsRoot().appendChild(f);
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
