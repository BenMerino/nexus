/**
 * Sample the perimeter the BROWSER actually paints for a rounded box — a
 * `corner-shape: superellipse(--corner-smooth)` squircle, not a circular arc.
 * The platform applies that corner-shape globally (theme.css), so the glow
 * must trace the SAME superellipse or it diverges at the corners.
 *
 * `roundedRectPath` (graph-engine) is circular-only and can't express this, so
 * we generate the squircle directly from the standard superellipse the CSS
 * spec uses: per corner, |x/r|^k + |y/r|^k = 1, with k = 2 (circle) at
 * smoothness 1 and rising with `--corner-smooth` (~1.5 ≈ Apple continuous).
 * Density scales with size so corners never starve; normals come from the
 * analytic gradient so the band stays smooth.
 */

/** One sampled perimeter point with its OUTWARD unit normal. */
export interface SampledPoint { x: number; y: number; nx: number; ny: number }

const POINT_SPACING_PX = 3;

/** CSS `corner-shape: superellipse(K)` → curve exponent `n` in
 *  |x/r|^n + |y/r|^n = 1, where the spec defines **n = 2^K** (K=1 → n=2
 *  circle, K=2 → n=4 squircle keyword). This is the EXACT browser mapping, so
 *  the glow traces the same curve the corner-shape paints. */
const expFor = (smooth: number) => Math.pow(2, smooth);

/** Push one superellipse corner, sweeping the angle from `a0` to `a1` (always
 *  in loop order, so the band never crosses itself). `cx,cy` = the rounded-
 *  rect corner center. A point at angle θ uses the superellipse warp
 *  |cosθ|^(2/k), |sinθ|^(2/k); the outward normal is the normalized implicit
 *  gradient. */
function corner(
    cx: number, cy: number, r: number, a0: number, a1: number,
    k: number, segs: number, out: SampledPoint[],
) {
    if (r <= 0.5) {
        /* Sharp corner: emit a SINGLE mitered vertex on the bisector. The
         * normal is the bisector direction, but its LENGTH is the miter factor
         * 1/cos(halfAngle) so the inward-offset band keeps its full thickness
         * around the turn instead of pinching to a point — otherwise the glow
         * necks (and dims) at sharp corners. For a 90° turn that's √2. */
        const a = (a0 + a1) / 2;
        const half = Math.abs(a1 - a0) / 2;             // half the corner's turn
        const miter = 1 / Math.max(0.2, Math.cos(half)); // clamp to avoid spikes
        out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, nx: Math.cos(a) * miter, ny: Math.sin(a) * miter });
        return;
    }
    const warp = (t: number) => Math.sign(t) * Math.pow(Math.abs(t), 2 / k);
    for (let i = 0; i <= segs; i++) {
        const a = a0 + (a1 - a0) * (i / segs);
        const ca = Math.cos(a), sa = Math.sin(a);
        const u = warp(ca), v = warp(sa);
        const x = cx + u * r, y = cy + v * r;
        // Outward normal = gradient of |u|^k+|v|^k = (k|u|^{k-1}sgn u, …).
        let gx = Math.sign(u) * Math.pow(Math.abs(u), k - 1);
        let gy = Math.sign(v) * Math.pow(Math.abs(v), k - 1);
        const gl = Math.hypot(gx, gy) || 1;
        out.push({ x, y, nx: gx / gl, ny: gy / gl });
    }
}

/** Sample a straight edge by spacing (excludes the end — the next corner owns
 *  it), with a constant outward normal. */
function line(
    x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, out: SampledPoint[],
) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / POINT_SPACING_PX));
    for (let i = 0; i < n; i++) {
        const f = i / n;
        out.push({ x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, nx, ny });
    }
}

/** Ordered points + outward normals around a squircle rect with separate
 *  top/bottom radii. `smooth` is the live `--corner-smooth` exponent (1 =
 *  circular). Winds clockwise from the top edge. */
export function sampleRoundedRect(
    w: number, h: number, topR: number, botR: number, smooth = 1,
): SampledPoint[] {
    if (w <= 0 || h <= 0) return [];
    const cap = Math.min(w / 2, h / 2);
    const rt = Math.max(0, Math.min(topR, cap));
    const rb = Math.max(0, Math.min(botR, cap));
    const k = expFor(smooth);
    const segs = Math.min(64, Math.max(8, Math.round((Math.PI / 2) * Math.max(rt, rb) / POINT_SPACING_PX)));
    const out: SampledPoint[] = [];
    const HP = Math.PI / 2;
    /* CW from the top edge. Corner angles are the OUTWARD-normal direction
     * sweeping clockwise: top −90° → right 0° → bottom +90° → left +180°.
     * Edges exclude their end point; the following corner owns the junction,
     * so there are no coincident points (the cause of the corner "snake"). */
    line(rt, 0, w - rt, 0, 0, -1, out);
    corner(w - rt, rt, rt, -HP, 0, k, segs, out);          // TR
    line(w, rt, w, h - rb, 1, 0, out);
    corner(w - rb, h - rb, rb, 0, HP, k, segs, out);       // BR
    line(w - rb, h, rb, h, 0, 1, out);
    corner(rb, h - rb, rb, HP, Math.PI, k, segs, out);     // BL
    line(0, h - rb, 0, rt, -1, 0, out);
    corner(rt, rt, rt, Math.PI, Math.PI * 1.5, k, segs, out); // TL
    return out;
}
