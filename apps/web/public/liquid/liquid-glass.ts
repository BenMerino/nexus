// Per-element liquid-glass host: gives each glass surface its OWN physically
// derived displacement map (geometry-specific — corner radius, size, bezel),
// regenerated on resize. The faithful kube.io math (refraction-math.ts) instead
// of the radial approximation. Applied via filter:url() on the ::before overlay
// that dna-liquid.css already establishes — universal, no Chrome flag.
//
// Each surface gets a unique <filter id> in a shared <svg defs>; the element
// carries its id via --liquid-filter (the overlay reads filter:var(--liquid-...)).

import { buildMap } from "./refraction-map";
import type { Profile } from "./refraction-math";

const DEFS_ID = "nexus-liquid-defs";
const SELECTOR = ".surface, .glass-surface, .card, .panel, .kpi, .tenant-rail";
const PROFILE: Profile = "squircle"; // matches our concentric-squircle corners
const THICKNESS = 12;
const BEZEL = 18; // px of bevel inset where refraction happens

let seq = 0;
const ids = new WeakMap<Element, string>();

function defs(): SVGSVGElement {
  let svg = document.getElementById(DEFS_ID) as SVGSVGElement | null;
  if (!svg) {
    const ns = "http://www.w3.org/2000/svg";
    svg = document.createElementNS(ns, "svg");
    svg.id = DEFS_ID;
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "fixed", width: "0", height: "0", pointerEvents: "none" });
    document.body.appendChild(svg);
  }
  return svg;
}

function setFilter(id: string, mapUrl: string, scale: number): void {
  const ns = "http://www.w3.org/2000/svg";
  const root = defs();
  let filter = document.getElementById(id) as unknown as SVGFilterElement | null;
  if (!filter) {
    filter = document.createElementNS(ns, "filter");
    filter.id = id;
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const feImage = document.createElementNS(ns, "feImage");
    feImage.setAttribute("result", "map");
    feImage.setAttribute("preserveAspectRatio", "none");
    const feDisp = document.createElementNS(ns, "feDisplacementMap");
    feDisp.setAttribute("in", "SourceGraphic");
    feDisp.setAttribute("in2", "map");
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
    filter.append(feImage, feDisp);
    root.appendChild(filter);
  }
  (filter.querySelector("feImage") as SVGFEImageElement).setAttribute("href", mapUrl);
  (filter.querySelector("feDisplacementMap") as SVGFEDisplacementMapElement)
    .setAttribute("scale", String(scale));
}

function update(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const cs = getComputedStyle(el);
  const radius = parseFloat(cs.borderTopLeftRadius) || 0;
  const map = buildMap(rect.width, rect.height, radius, PROFILE, THICKNESS, BEZEL);
  if (!map) return;
  let id = ids.get(el);
  if (!id) {
    id = `nexus-liquid-el-${seq++}`;
    ids.set(el, id);
  }
  setFilter(id, map.url, map.scale);
  el.style.setProperty("--liquid-filter", `url(#${id})`);
}

const ro = new ResizeObserver((entries) => {
  for (const e of entries) update(e.target as HTMLElement);
});

function attach(el: HTMLElement): void {
  if (ids.has(el)) return;
  update(el);
  ro.observe(el);
}

function scan(): void {
  if (!document.documentElement.hasAttribute("data-liquid")) return;
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach(attach);
}

// Re-scan when surfaces mount (SPA renders) — debounced via rAF.
let scheduled = false;
const mo = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
});

export function startLiquidGlass(): void {
  scan();
  mo.observe(document.body, { childList: true, subtree: true });
}

if (document.body) startLiquidGlass();
else addEventListener("DOMContentLoaded", startLiquidGlass, { once: true });
