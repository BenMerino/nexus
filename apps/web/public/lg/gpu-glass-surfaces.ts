// Which DOM elements become GPU glass slabs (gpu-glass-page.ts), and how
// their live rects stream to the shader's storage buffer. Two layers, split
// by stacking reality: scrolled content passes UNDER the fixed chrome, so
// the header/sidebar slabs render on a separate canvas above content.
// Host lists mirror kube-filter.ts LIQUID_HOSTS (the CSS liquid surfaces).

export const CHROME_HOSTS = ".public-header, .sidebar";
export const CONTENT_HOSTS = [
  ".card", ".panel", ".kpi", ".stat", ".surface", ".glass-surface",
  ".profile-hero", ".profile-panel",
].join(",");
const ALL_HOSTS = `${CHROME_HOSTS},${CONTENT_HOSTS}`;

export const MAX_SLABS = 64;
const MARGIN = 64;              // offscreen cull margin (CSS px)

// Corner radius per element, cached — token-driven, effectively static.
const radiusCache = new WeakMap<Element, number>();
function cornerRadius(el: Element): number {
  let r = radiusCache.get(el);
  if (r === undefined) {
    r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    radiusCache.set(el, r);
  }
  return r;
}

// Fill `out` (2 vec4s per slab, device px) from the visible, TOP-LEVEL hosts
// matching `hosts`; returns the slab count. Nested glass hosts are skipped —
// one slab per top-level surface (an inner slab would lose the min-distance
// pick everywhere but its own rim and render as a broken ring). minRadius is
// the material bezel: a rim roll can't wrap a tighter corner without a
// curvature crease, so the corner grows to fit.
export function collectSlabs(
  hosts: string, dpr: number, out: Float32Array, minRadius: number,
): number {
  let n = 0;
  for (const el of document.querySelectorAll<HTMLElement>(hosts)) {
    if (n >= MAX_SLABS) break;
    if (el.parentElement?.closest(ALL_HOSTS)) continue;
    const b = el.getBoundingClientRect();
    if (b.width < 24 || b.height < 24) continue;
    if (b.bottom < -MARGIN || b.top > innerHeight + MARGIN) continue;
    if (b.right < -MARGIN || b.left > innerWidth + MARGIN) continue;
    const r = Math.min(
      Math.max(cornerRadius(el), minRadius), b.width / 2, b.height / 2,
    );
    const o = n * 8;
    out[o] = (b.left + b.width / 2) * dpr;
    out[o + 1] = (b.top + b.height / 2) * dpr;
    out[o + 2] = (b.width / 2) * dpr;
    out[o + 3] = (b.height / 2) * dpr;
    out[o + 4] = r * dpr;
    out[o + 5] = 0; out[o + 6] = 0; out[o + 7] = 0;
    n++;
  }
  return n;
}
