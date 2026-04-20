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

/** Build an organic blob outline around `points` that contains every point.
 *  Instead of hugging the convex hull (which has sharp vertices when the point
 *  set is sparse), sample the enclosing shape as a smooth ring of control
 *  points — for each of N evenly-spaced angles, the radius is the distance to
 *  the furthest point in that angular slice. Curves drawn through that ring
 *  are always smooth, and padding expands the ring outward so every input
 *  point sits comfortably inside. */
export function paddedHullPath(hull: Point[], pad: number): string {
  if (hull.length === 0) return '';
  if (hull.length === 1) {
    const p = hull[0];
    return `M ${p.x - pad} ${p.y} A ${pad} ${pad} 0 1 0 ${p.x + pad} ${p.y} A ${pad} ${pad} 0 1 0 ${p.x - pad} ${p.y} Z`;
  }
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  const ring = sampleEnclosingRing(hull, cx, cy, pad);
  return smoothClosedPath(ring, 0.5);
}

/** Produce 24 control points arranged radially around (cx, cy). Each sits at
 *  the distance of the furthest input point that falls within a small arc
 *  around that angle, plus `pad`. Radii are smoothed by a 3-point rolling
 *  average so sparse input points don't create spikes. */
function sampleEnclosingRing(points: Point[], cx: number, cy: number, pad: number): Point[] {
  const SAMPLES = 72;
  const SPREAD = 6;          // each point raises radii across ±SPREAD slots
  const SMOOTH_WINDOW = 9;   // rolling-average window size (must be odd)

  const radii: number[] = new Array(SAMPLES).fill(0);
  for (const p of points) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);
    const center = ((Math.round((angle / (Math.PI * 2)) * SAMPLES) % SAMPLES) + SAMPLES) % SAMPLES;
    for (let k = -SPREAD; k <= SPREAD; k++) {
      const falloff = 1 - Math.abs(k) / (SPREAD + 1);
      const i = ((center + k) % SAMPLES + SAMPLES) % SAMPLES;
      const contribution = dist * falloff;
      if (contribution > radii[i]) radii[i] = contribution;
    }
  }

  const half = Math.floor(SMOOTH_WINDOW / 2);
  const smoothed = radii.map((_, i) => {
    let sum = 0;
    for (let k = -half; k <= half; k++) {
      sum += radii[((i + k) % SAMPLES + SAMPLES) % SAMPLES];
    }
    return sum / SMOOTH_WINDOW;
  });

  return smoothed.map((r, i) => {
    const angle = (i / SAMPLES) * Math.PI * 2;
    const radius = r + pad;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
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
