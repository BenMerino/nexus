// Console diagnosis harness for the per-element liquid engine (kube-filter.ts).
// Zero coupling: operates purely on the DOM the engine produced (hosts carry an
// inline --_kube; filters are <filter id="lgk-…">). Usage from the devtools
// console on any page:
//
//   __kubeDebug.list()      table of every refracting host (class, size, radius,
//                           assigned filter) — verifies scoping + the size gate.
//   __kubeDebug.outline()   magenta outline on every refracting host (pass false
//                           to clear) — SEE which elements refract.
//   __kubeDebug.mode(m)     isolate the pipeline stage that draws an artifact:
//                             'frost' → refraction fully off (just blur+sheen).
//                                       Artifact gone? It's filter-side.
//                             'bend'  → displacement only, specular hidden.
//                             'spec'  → specular only, displacement zeroed.
//                             'full'  → restore everything.
//   __kubeDebug.showMap(el?) paint the raw displacement texture over a host
//                           (first host if omitted) — check geometry alignment
//                           of the bezel against the element's real corners.
//   __kubeDebug.snap()      TELEMETRY (dev): render every live filter against a
//                           checkerboard probe and POST the PNGs to the local
//                           sink (apps/web/.lg-telemetry/) for offline review.
//   __kubeDebug.report()    TELEMETRY (dev): POST env + host/filter diagnostics.

import { snap, report } from "./kube-snap";

const hosts = () =>
  [...document.querySelectorAll<HTMLElement>("*")].filter(
    (e) => e.style.getPropertyValue("--_kube"),
  );
const filters = () => [...document.querySelectorAll<SVGElement>('[id^="lgk-"]')];

const hostRows = () => hosts().map((h) => {
  const r = h.getBoundingClientRect();
  return {
    el: h.className.split(" ")[0] || h.tagName,
    size: `${Math.round(r.width)}×${Math.round(r.height)}`,
    radius: getComputedStyle(h).borderTopLeftRadius,
    filter: h.style.getPropertyValue("--_kube"),
  };
});

function list(): void {
  console.table(hostRows());
}

function outline(on = true): void {
  hosts().forEach((h) => { h.style.outline = on ? "1px solid magenta" : ""; });
}

function mode(m: "full" | "frost" | "bend" | "spec"): string {
  // Restore 'full' first (from SAVED attribute values — spec width / bend
  // scale are exact px since the padded-capture refactor, never hardcode),
  // then subtract the requested stage.
  const stash = ((mode as unknown as { s?: Map<Element, string> }).s ??= new Map());
  filters().forEach((f) => {
    for (const [el, v] of stash) if (f.contains(el)) {
      el.setAttribute(el.tagName === "feImage" ? "width" : "scale", v);
      stash.delete(el);
    }
  });
  hosts().forEach((h) => {
    const saved = h.dataset.kubeSaved;
    if (saved) { h.style.setProperty("--_kube", saved); delete h.dataset.kubeSaved; }
  });
  if (m === "frost") hosts().forEach((h) => {
    h.dataset.kubeSaved = h.style.getPropertyValue("--_kube");
    h.style.setProperty("--_kube", "none");
  });
  if (m === "bend") filters().forEach((f) => {
    const s = f.querySelector('feImage[result="spec"]');
    if (s) { stash.set(s, s.getAttribute("width") ?? ""); s.setAttribute("width", "0"); }
  });
  if (m === "spec") filters().forEach((f) => {
    const d = f.querySelector("feDisplacementMap");
    if (d) { stash.set(d, d.getAttribute("scale") ?? ""); d.setAttribute("scale", "0"); }
  });
  return m;
}

function showMap(el?: HTMLElement): void {
  const h = el ?? hosts()[0];
  if (!h) { console.warn("no refracting hosts"); return; }
  const id = /url\("?#([^")]+)"?\)/.exec(h.style.getPropertyValue("--_kube"))?.[1];
  // The displacement feImage is result="dispImg" (result="disp" is the
  // neutral-composited output, not an image).
  const href = id && document.getElementById(id)
    ?.querySelector('feImage[result="dispImg"]')?.getAttribute("href");
  if (!href) { console.warn("no displacement texture for", h, id); return; }
  h.style.setProperty("--_kube", "none");
  Object.assign(h.style, { backgroundImage: `url(${href})`, backgroundSize: "100% 100%" });
}

(window as unknown as { __kubeDebug: object }).__kubeDebug = {
  list, outline, mode, showMap, snap, report: () => report(hostRows()),
};
export {};
