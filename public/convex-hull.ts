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

  let d = `M ${expanded[0].x} ${expanded[0].y}`;
  for (let i = 1; i < expanded.length; i++) {
    const prev = expanded[i - 1];
    const curr = expanded[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  const last = expanded[expanded.length - 1];
  const first = expanded[0];
  const mx = (last.x + first.x) / 2;
  const my = (last.y + first.y) / 2;
  d += ` Q ${last.x} ${last.y} ${mx} ${my} Z`;
  return d;
}
