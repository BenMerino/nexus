// Depth assignment for the layered scene. Depth = NESTING level, not DOM
// order: a glass surface refracts only nodes with a STRICTLY SMALLER depth,
// so surfaces on the SAME layer never refract each other. Bands, back→front:
//   0       all top-level content surfaces (a row/column of sibling cards) —
//           same depth, so siblings do NOT refract one another
//   1,2…    nested surfaces (a chip inside a card): one band per nesting level
//           in front of their container, so they refract the container behind
//           them but not their own siblings
//   CHROME  fixed header/sidebar — floats over all scrolled content, so it
//           sits shallowest and refracts the entire content scene under it.
// Rebuilt each frame from the live DOM (cheap WeakMap writes).
const CONTENT_HOSTS = ".card, .panel, .kpi, .stat, .surface, .glass-surface, .profile-hero, .profile-panel";
const CHROME_HOSTS = ".public-header, .sidebar";

export type DepthMap = { depthOf: (el: Element) => number; chromeDepth: number };

// How many content hosts enclose el (its nesting level among glass surfaces).
function nestingLevel(el: Element): number {
  let level = 0;
  let p = el.parentElement;
  while (p) {
    const host = p.closest(CONTENT_HOSTS);
    if (!host) break;
    level++;
    p = host.parentElement;
  }
  return level;
}

export function computeDepths(): DepthMap {
  const depth = new WeakMap<Element, number>();
  let maxLevel = 0;
  for (const el of document.querySelectorAll(CONTENT_HOSTS)) {
    const level = nestingLevel(el);
    depth.set(el, level);
    if (level > maxLevel) maxLevel = level;
  }
  const chromeDepth = maxLevel + 1;   // above every content nesting level
  for (const el of document.querySelectorAll(CHROME_HOSTS)) depth.set(el, chromeDepth);
  return { depthOf: (el) => depth.get(el) ?? chromeDepth, chromeDepth };
}
