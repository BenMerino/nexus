export type Point = { x: number; y: number };

/** Andrew's monotone chain convex hull. Returns hull in CCW order. */
export function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Build a smooth rounded SVG path around a hull, padded outward by `pad` pixels. */
export function paddedHullPath(hull: Point[], pad: number): string {
  if (hull.length < 2) return '';
  if (hull.length === 2) {
    const [a, b] = hull;
    return `M ${a.x - pad} ${a.y - pad} L ${b.x + pad} ${b.y - pad} L ${b.x + pad} ${b.y + pad} L ${a.x - pad} ${a.y + pad} Z`;
  }
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  const expanded = hull.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / dist) * pad, y: p.y + (dy / dist) * pad };
  });

  return smoothClosedPath(expanded, 0.5);
}

/** Draw a smooth closed path through `pts` using cubic Béziers with
 *  Catmull-Rom-like control points. `tension` controls how tight the curves
 *  hug the polygon (0 = straight lines, 1 = very loose). */
function smoothClosedPath(pts: Point[], tension: number): string {
  const n = pts.length;
  if (n < 2) return '';
  const k = tension / 6;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  d += ' Z';
  return d;
}
