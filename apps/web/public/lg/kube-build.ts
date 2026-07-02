// Builds one kube <filter> element for a given card geometry (split from
// kube-filter.ts — that file owns discovery/measurement/caching; this one owns
// the SVG primitive chain). The filter runs on a PADDED overlay (card + pad on
// every side, see kube-filter.ts PAD): textures are placed at exact px
// (pad, pad, w×h), the padding ring reads neutral gray (zero displacement),
// and the CSS clip-path crops the result back to the card shape.

const ns = "http://www.w3.org/2000/svg";

export function buildKubeFilter(
  id: string, w: number, h: number, pad: number, dispUrl: string, specUrl: string,
  scale = 32,
): SVGElement {
  const f = document.createElementNS(ns, "filter");
  f.id = id;
  // sRGB — REQUIRED, not a style choice (verified via telemetry probes): the
  // displacement texture encodes neutral as sRGB gray 128 (= channel 0.5).
  // Under linearRGB interpolation that gray reads as 0.216, so every pixel
  // gets a constant (0.216−0.5)×scale ≈ −9px shift — the bezel's variation is
  // drowned out (no visible bend) and the whole refracted backdrop copy sits
  // ~9px off its true position behind every surface: the ghost-edge artifact.
  f.setAttribute("color-interpolation-filters", "sRGB");
  f.setAttribute("filterUnits", "objectBoundingBox");
  f.setAttribute("primitiveUnits", "userSpaceOnUse");
  f.setAttribute("x", "0"); f.setAttribute("y", "0");
  f.setAttribute("width", "1"); f.setAttribute("height", "1");

  // Textures at EXACT px: the card box sits at (pad, pad) inside the overlay.
  const img = (href: string, result: string) => {
    const e = document.createElementNS(ns, "feImage");
    e.setAttribute("href", href);
    e.setAttribute("x", String(pad)); e.setAttribute("y", String(pad));
    e.setAttribute("width", String(w)); e.setAttribute("height", String(h));
    e.setAttribute("preserveAspectRatio", "none");
    e.setAttribute("result", result);
    return e;
  };
  // Neutral (128-gray = zero displacement) under the card-sized map so the
  // padding ring displaces nothing instead of reading transparent as -0.5.
  const flood = document.createElementNS(ns, "feFlood");
  flood.setAttribute("flood-color", "rgb(128,128,128)");
  flood.setAttribute("result", "neutral");
  const overNeutral = document.createElementNS(ns, "feComposite");
  overNeutral.setAttribute("in", "dispImg"); overNeutral.setAttribute("in2", "neutral");
  overNeutral.setAttribute("operator", "over"); overNeutral.setAttribute("result", "disp");

  const blur = document.createElementNS(ns, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "2");
  blur.setAttribute("result", "blurred");
  const dm = document.createElementNS(ns, "feDisplacementMap");
  dm.setAttribute("in", "blurred"); dm.setAttribute("in2", "disp");
  // px of full-range bend — the map encodes offset/(scale/2) around neutral
  // 128, so this reproduces TRUE px from the physics (gpu-glass-map.ts); the
  // padded capture has real pixels for up to scale/2 px of pull.
  dm.setAttribute("scale", String(scale));
  dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G");
  dm.setAttribute("result", "refracted");
  const blend = document.createElementNS(ns, "feBlend");
  blend.setAttribute("in", "spec"); blend.setAttribute("in2", "refracted");
  blend.setAttribute("mode", "screen");

  f.append(img(dispUrl, "dispImg"), flood, overNeutral, img(specUrl, "spec"), blur, dm, blend);
  return f;
}
