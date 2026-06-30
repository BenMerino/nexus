// Injects the liquid-glass SVG refraction filter once per page. The filter is
// referenced by dna-liquid.css as `filter: url(#nexus-liquid-edge)` on each
// glass surface's ::before overlay, so the <filter> must exist in the DOM.
// feImage loads a procedural displacement map (a radial gradient: neutral grey
// #808080 = no shift at centre, R/G ramp at the rim = max edge-bend),
// feDisplacementMap bends the overlay sheen through it, then a small
// feGaussianBlur softens the bent rim so it reads as a glass lens edge.
//
// `filter: url()` is supported in EVERY browser (unlike backdrop-filter:url(),
// which is Chrome/Edge-flag-only — see dna-liquid.css header). Self-mounting +
// idempotent; cheap enough to always inject the inert <svg> (display:none).

const FILTER_ID = "nexus-liquid-edge";

// Displacement map: a radial gradient encoded so the centre is neutral (128,128
// → zero displacement) and the rim ramps the R (x) and G (y) channels apart →
// the sheen bends outward at the edges, like a lens. Inline SVG data-URI.
const DISPLACEMENT_MAP =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>` +
      `<defs>` +
      `<radialGradient id='x' cx='50%' cy='50%' r='50%'>` +
      `<stop offset='55%' stop-color='rgb(128,128,128)'/>` +
      `<stop offset='100%' stop-color='rgb(255,128,128)'/>` +
      `</radialGradient>` +
      `<radialGradient id='y' cx='50%' cy='50%' r='50%'>` +
      `<stop offset='55%' stop-color='rgb(128,128,128)'/>` +
      `<stop offset='100%' stop-color='rgb(128,255,128)'/>` +
      `</radialGradient>` +
      `</defs>` +
      // X-shift in R, Y-shift in G, screen-blended so both ramps coexist.
      `<rect width='200' height='200' fill='url(#x)'/>` +
      `<rect width='200' height='200' fill='url(#y)' style='mix-blend-mode:screen'/>` +
      `</svg>`,
  );

function injectFilter(): void {
  if (document.getElementById(`${FILTER_ID}-svg`)) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = `${FILTER_ID}-svg`;
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, { position: "fixed", width: "0", height: "0", pointerEvents: "none" });

  const filter = document.createElementNS(ns, "filter");
  filter.id = FILTER_ID;
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const feImage = document.createElementNS(ns, "feImage");
  feImage.setAttribute("href", DISPLACEMENT_MAP);
  feImage.setAttribute("x", "0");
  feImage.setAttribute("y", "0");
  feImage.setAttribute("width", "100%");
  feImage.setAttribute("height", "100%");
  feImage.setAttribute("result", "map");
  feImage.setAttribute("preserveAspectRatio", "none");

  const feDisp = document.createElementNS(ns, "feDisplacementMap");
  feDisp.setAttribute("in", "SourceGraphic");
  feDisp.setAttribute("in2", "map");
  // scale read from the CSS knob at inject time (default if unset).
  const scale = getComputedStyle(document.documentElement).getPropertyValue("--liquid-scale").trim();
  feDisp.setAttribute("scale", scale || "60");
  feDisp.setAttribute("xChannelSelector", "R");
  feDisp.setAttribute("yChannelSelector", "G");
  feDisp.setAttribute("result", "bent");

  // Soften the bent rim so the overlay reads as a glass lens edge, not a hard
  // displaced tint.
  const feBlur = document.createElementNS(ns, "feGaussianBlur");
  feBlur.setAttribute("in", "bent");
  feBlur.setAttribute("stdDeviation", "1.5");

  filter.appendChild(feImage);
  filter.appendChild(feDisp);
  filter.appendChild(feBlur);
  svg.appendChild(filter);
  document.body.appendChild(svg);
}

if (document.body) injectFilter();
else addEventListener("DOMContentLoaded", injectFilter, { once: true });
