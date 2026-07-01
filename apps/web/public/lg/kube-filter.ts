// Injects the kube liquid-glass SVG filter (ported from ObaidQatan/liquid-glass-
// component-library KubeFilter.tsx) once per page, in NORMALIZED mode so one
// filter serves every surface. lg-glass.css applies `filter: url(#lg-kube)` to
// each glass surface under :root[data-lg-liquid].
//
// LIQUID GLASS defaults (as specified): profile convex-circle, bezel 9,
// refraction 90, thickness 120, light angle -150, specular 10, blur 10, sat 100,
// transparency 20 (transparency/sat/blur handled by the CSS layer).
//
// Refraction = feDisplacementMap on the element's OWN content (SourceGraphic).
// The displacement map itself renders in every browser; the visible bend is the
// library's real behavior.

import { generateDisplacementTexture } from "./kube/displacementTexture";
import { generateSpecularTexture } from "./kube/specularTexture";

const ID = "lg-kube";
// Normalized unit-square texture resolution (matches the library's normalized path).
const RES = 256;

function inject(): void {
  if (document.getElementById(`${ID}-svg`)) return;

  const disp = generateDisplacementTexture({
    width: RES, height: RES, bezel: (9 / 100) * RES, // bezel as fraction of dim
    profile: "convex-circle", thickness: 120, samples: 128, borderRadius: 24,
  });
  const spec = generateSpecularTexture({
    width: RES, height: RES, bezel: (9 / 100) * RES,
    profile: "convex-circle", lightAngle: -150, shininess: 40, borderRadius: 24,
  });
  if (!disp || !spec) return;

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = `${ID}-svg`;
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, { position: "fixed", width: "0", height: "0", pointerEvents: "none" });

  // USER-SPACE units, not objectBoundingBox. In bbox units the feImage stretches
  // to a 1×1 unit square and the displacement map samples nearly flat → no visible
  // bend (measured: 0.27% pixel change). userSpaceOnUse + a pixel-sized feImage +
  // a pixel scale gives a real, size-independent-enough refraction. The region is
  // oversized (-20%..120%) so the bezel gradient at the card edges isn't clipped.
  const filter = document.createElementNS(ns, "filter");
  filter.id = ID;
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.setAttribute("filterUnits", "objectBoundingBox");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  filter.setAttribute("x", "-0.2");
  filter.setAttribute("y", "-0.2");
  filter.setAttribute("width", "1.4");
  filter.setAttribute("height", "1.4");

  // feImage sized in px to the texture resolution; preserveAspectRatio none lets
  // the browser scale the RES×RES map across each surface it's applied to.
  const feImg = (href: string, result: string) => {
    const e = document.createElementNS(ns, "feImage");
    e.setAttribute("href", href);
    e.setAttribute("x", "0"); e.setAttribute("y", "0");
    // 100% → the feImage fills the whole filter region regardless of card size, so
    // the bezel gradient reaches every edge (a fixed px size only refracted a corner).
    e.setAttribute("width", "100%"); e.setAttribute("height", "100%");
    e.setAttribute("preserveAspectRatio", "none");
    e.setAttribute("result", result);
    return e;
  };
  const blur = document.createElementNS(ns, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "2"); // px, gentle pre-blur before displacement
  blur.setAttribute("result", "blurred");

  const dispMap = document.createElementNS(ns, "feDisplacementMap");
  dispMap.setAttribute("in", "blurred");
  dispMap.setAttribute("in2", "displacementMap");
  dispMap.setAttribute("scale", "80"); // px of max refraction (was 0.09 bbox ≈ 0)
  dispMap.setAttribute("xChannelSelector", "R");
  dispMap.setAttribute("yChannelSelector", "G");
  dispMap.setAttribute("result", "refracted");

  const specTrans = document.createElementNS(ns, "feComponentTransfer");
  specTrans.setAttribute("in", "specularMap");
  specTrans.setAttribute("result", "specularAlpha");
  const funcA = document.createElementNS(ns, "feFuncA");
  funcA.setAttribute("type", "linear");
  funcA.setAttribute("slope", String(10 / 10)); // specular 10 → opacity 1.0
  specTrans.appendChild(funcA);

  const blend = document.createElementNS(ns, "feBlend");
  blend.setAttribute("in", "specularAlpha");
  blend.setAttribute("in2", "refracted");
  blend.setAttribute("mode", "screen");

  filter.append(feImg(disp.url, "displacementMap"), feImg(spec.url, "specularMap"),
    blur, dispMap, specTrans, blend);
  svg.appendChild(filter);
  document.body.appendChild(svg);
}

if (document.body) inject();
else addEventListener("DOMContentLoaded", inject, { once: true });
