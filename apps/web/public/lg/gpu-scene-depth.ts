// Depth assignment for the layered scene. Each glass host gets a stacking
// rank: a glass surface refracts only nodes with a STRICTLY SMALLER depth
// (behind it), so it never refracts its own body/text. Order, back to front:
//   0..N-1  content surfaces (cards/panels/kpis) in document order
//   N       fixed chrome (header/sidebar) — floats over all scrolled content,
//           so it sits shallowest and refracts the entire content scene.
// The map is rebuilt each frame from the live DOM (cheap: a WeakMap write per
// host) so newly-mounted cards slot in without special-casing.
const CONTENT_HOSTS = ".card, .panel, .kpi, .stat, .surface, .glass-surface, .profile-hero, .profile-panel";
const CHROME_HOSTS = ".public-header, .sidebar";

export type DepthMap = { depthOf: (el: Element) => number; chromeDepth: number };

export function computeDepths(): DepthMap {
  const depth = new WeakMap<Element, number>();
  let d = 0;
  // Content surfaces in DOM order (document order ≈ paint order for the flow).
  for (const el of document.querySelectorAll(CONTENT_HOSTS)) {
    if (el.parentElement?.closest(CONTENT_HOSTS)) {
      // Nested surface: one level in front of its parent so it refracts the
      // parent behind it, not itself.
      const parent = el.parentElement.closest(CONTENT_HOSTS)!;
      depth.set(el, (depth.get(parent) ?? 0) + 0.5);
      continue;
    }
    depth.set(el, d++);
  }
  const chromeDepth = d;            // above every content surface
  for (const el of document.querySelectorAll(CHROME_HOSTS)) depth.set(el, chromeDepth);
  return { depthOf: (el) => depth.get(el) ?? chromeDepth, chromeDepth };
}
