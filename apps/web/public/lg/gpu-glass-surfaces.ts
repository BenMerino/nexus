// Which DOM elements own a GPU glass layer (gpu-glass-page.ts), plus cached
// per-element geometry. Mirrors kube-filter.ts LIQUID_HOSTS — the same
// surfaces that carry CSS liquid glass carry the ray-traced layer. Nested
// hosts are fine: each element owns its own canvas, so glass-in-glass stacks
// naturally through DOM order (concentric glass).
export const GLASS_HOSTS = [
  ".public-header", ".sidebar", ".card", ".panel", ".kpi", ".stat",
  ".surface", ".glass-surface", ".profile-hero", ".profile-panel",
].join(",");

// Corner radius per element, cached — token-driven, effectively static.
const radiusCache = new WeakMap<Element, number>();
export function cornerRadius(el: Element): number {
  let r = radiusCache.get(el);
  if (r === undefined) {
    r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    radiusCache.set(el, r);
  }
  return r;
}
