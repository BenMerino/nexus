// Builds one kube <filter> element for a given card geometry (split from
// kube-filter.ts — that file owns discovery/measurement/caching; this one owns
// the SVG primitive chain). The filter runs on a PADDED overlay (card + pad on
// every side, see kube-filter.ts PAD): textures are placed at exact px
// (pad, pad, w×h), the padding ring reads neutral gray (zero displacement),
// and the CSS clip-path crops the result back to the card shape.

const ns = "http://www.w3.org/2000/svg";

export function buildKubeFilter(
  id: string, w: number, h: number, pad: number, dispUrl: string, specUrl: string,
): SVGElement {
  const f = document.createElementNS(ns, "filter");
  f.id = id;
  // linearRGB (spec default): sRGB filter math quantizes visibly in Safari's
  // software SVG pipeline.
  f.setAttribute("color-interpolation-filters", "linearRGB");
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
  dm.setAttribute("scale", "32"); // px of max bend — the padded capture has real pixels for it
  dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G");
  dm.setAttribute("result", "refracted");
  const blend = document.createElementNS(ns, "feBlend");
  blend.setAttribute("in", "spec"); blend.setAttribute("in2", "refracted");
  blend.setAttribute("mode", "screen");

  f.append(img(dispUrl, "dispImg"), flood, overNeutral, img(specUrl, "spec"), blur, dm, blend);
  return f;
}
