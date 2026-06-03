/* ── Scale Engine ─────────────────────────────────────────────
 * Pure math: maps data domains to pixel ranges.
 * Zero dependencies. Three scale types cover all chart families.
 * ──────────────────────────────────────────────────────────── */

/** Linear scale: maps [min, max] → [px0, px1] */
export function linearScale(domain: [number, number], range: [number, number]) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const span = d1 - d0 || 1;
    return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Point scale: maps i ∈ [0, n-1] → x ∈ [r0, r1]. First point AT r0,
 * last point AT r1 — so curve geometry (line/area/stacked-area) spans
 * wall-to-wall in the plot area and external chrome (slider tracks,
 * surrounding card) can align flush with the data extents. Bars use
 * `bandScale` instead since they need width as well as position. */
export function pointScale(n: number, range: [number, number]) {
    const [r0, r1] = range;
    if (n <= 1) return (_i: number) => r0;
    const step = (r1 - r0) / (n - 1);
    return (i: number) => r0 + i * step;
}

/** Band scale: maps categorical labels → { x, width } bands. Inner gap
 * between bands is `padding` × bandWidth; the first band's left edge
 * sits at r0 and the last band's right edge at r1 (no outer padding),
 * so bars touch the plot-area walls. */
export function bandScale(labels: string[], range: [number, number], padding = 0.2) {
    const [r0, r1] = range;
    const n = labels.length;
    if (n === 0) return (_label: string) => ({ x: r0, width: 0 });
    const total = r1 - r0;
    const innerCount = Math.max(0, n - 1);
    const bandW = total / (n + innerCount * padding);
    const gap = bandW * padding;
    const map = new Map(labels.map((l, i) => [l, { x: r0 + i * (bandW + gap), width: bandW }]));
    return (label: string) => map.get(label) ?? { x: r0, width: bandW };
}


/** Arc scale: maps values[] → { startAngle, endAngle } in radians */
export function arcScale(values: number[], startAngle = 0, endAngle = Math.PI * 2) {
    const total = values.reduce((s, v) => s + v, 0) || 1;
    const span = endAngle - startAngle;
    let cursor = startAngle;
    return values.map(v => {
        const sweep = (v / total) * span;
        const arc = { startAngle: cursor, endAngle: cursor + sweep };
        cursor += sweep;
        return arc;
    });
}

/** Nice domain: rounds min/max to clean tick values */
export function niceDomain(min: number, max: number, ticks = 5): { min: number; max: number; step: number } {
    if (min === max) return { min: 0, max: max || 1, step: (max || 1) / ticks };
    const rawStep = (max - min) / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / mag;
    const niceStep = residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10;
    const step = niceStep * mag;
    return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

/** Generate tick values from nice domain */
export function ticks(domain: { min: number; max: number; step: number }): number[] {
    const result: number[] = [];
    for (let v = domain.min; v <= domain.max + domain.step * 0.001; v += domain.step) {
        result.push(Math.round(v * 1e6) / 1e6);
    }
    return result;
}

/** Sample a multi-stop color ramp at `t ∈ [0,1]` via CSS color-mix in oklch.
 * Token-format-agnostic — works with hex, rgb(), and var(--token).
 * Theme-aware by construction since CSS vars resolve in the browser. */
export function rampColor(stops: string[], t: number): string {
    if (stops.length < 2) return stops[0] ?? 'var(--text-muted)';
    const seg = Math.min(Math.max(t, 0), 0.9999) * (stops.length - 1);
    const i = Math.floor(seg);
    const f = seg - i;
    const pct = (f * 100).toFixed(2);
    return `color-mix(in oklch, ${stops[i + 1]} ${pct}%, ${stops[i]})`;
}

/** SVG arc path from center, radius, start/end angles */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
    const s = { x: cx + r * Math.cos(start), y: cy + r * Math.sin(start) };
    const e = { x: cx + r * Math.cos(end), y: cy + r * Math.sin(end) };
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** SVG donut arc (with inner radius) — returns closed path */
export function donutArc(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
    const span = end - start;
    // Full-circle case: a single A command with start==end is degenerate.
    // Stitch two 180° arcs into a complete annulus (or disc, when inner=0).
    if (span >= Math.PI * 2 - 1e-4) {
        const top = { x: cx, y: cy - outer };
        const bot = { x: cx, y: cy + outer };
        const itop = { x: cx, y: cy - inner };
        const ibot = { x: cx, y: cy + inner };
        if (inner <= 0) {
            return `M ${top.x} ${top.y} A ${outer} ${outer} 0 1 1 ${bot.x} ${bot.y} A ${outer} ${outer} 0 1 1 ${top.x} ${top.y} Z`;
        }
        return `M ${top.x} ${top.y} A ${outer} ${outer} 0 1 1 ${bot.x} ${bot.y} A ${outer} ${outer} 0 1 1 ${top.x} ${top.y} Z `
            + `M ${itop.x} ${itop.y} A ${inner} ${inner} 0 1 0 ${ibot.x} ${ibot.y} A ${inner} ${inner} 0 1 0 ${itop.x} ${itop.y} Z`;
    }
    const os = { x: cx + outer * Math.cos(start), y: cy + outer * Math.sin(start) };
    const oe = { x: cx + outer * Math.cos(end), y: cy + outer * Math.sin(end) };
    const ie = { x: cx + inner * Math.cos(end), y: cy + inner * Math.sin(end) };
    const is_ = { x: cx + inner * Math.cos(start), y: cy + inner * Math.sin(start) };
    const large = span > Math.PI ? 1 : 0;
    return `M ${os.x} ${os.y} A ${outer} ${outer} 0 ${large} 1 ${oe.x} ${oe.y} L ${ie.x} ${ie.y} A ${inner} ${inner} 0 ${large} 0 ${is_.x} ${is_.y} Z`;
}

/** Monotone cubic spline — prevents overshoot on linear/plateau segments */
export function linePath(points: { x: number; y: number }[]): string {
    const n = points.length;
    if (n === 0) return '';
    if (n === 1) return `M ${points[0].x} ${points[0].y}`;
    if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    const ms = monotoneSlopes(points);
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < n - 1; i++) {
        const dx = (points[i + 1].x - points[i].x) / 3;
        d += ` C ${points[i].x + dx} ${points[i].y + ms[i] * dx}, ${points[i + 1].x - dx} ${points[i + 1].y - ms[i + 1] * dx}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
    return d;
}

/** Compute monotone tangent slopes (Fritsch-Carlson) */
function monotoneSlopes(pts: { x: number; y: number }[]): number[] {
    const n = pts.length;
    const d: number[] = []; const m: number[] = [];
    for (let i = 0; i < n - 1; i++) { const dx = pts[i + 1].x - pts[i].x; d.push(dx === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx); }
    m.push(d[0]);
    for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    for (let i = 0; i < n - 1; i++) {
        if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
        const a = m[i] / d[i], b = m[i + 1] / d[i];
        const s = a * a + b * b;
        if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return m;
}

/** Closed area path: smooth top + straight baseline return */
export function areaPath(points: { x: number; y: number }[], baseline: number): string {
    if (!points.length) return '';
    const last = points[points.length - 1], first = points[0];
    return `${linePath(points)} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
}

/** Rect path with selectable rounded corners. SVG <rect rx> rounds all four —
 * use this when only top or bottom corners should curve (e.g. stacked-bar segments).
 * Optional `topR` / `botR` override the boolean flags with explicit radii — useful
 * when corner radius is being tweened (e.g. as a stacked segment's neighbour fades). */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number, roundTop: boolean, roundBot: boolean, topR?: number, botR?: number): string {
    if (h <= 0 || w <= 0) return '';
    const cap = Math.min(w / 2, h / 2);
    const rt = Math.max(0, Math.min(topR ?? (roundTop ? r : 0), cap));
    const rb = Math.max(0, Math.min(botR ?? (roundBot ? r : 0), cap));
    return [
        `M ${x + rt} ${y}`,
        `H ${x + w - rt}`,
        rt > 0 ? `Q ${x + w} ${y} ${x + w} ${y + rt}` : '',
        `V ${y + h - rb}`,
        rb > 0 ? `Q ${x + w} ${y + h} ${x + w - rb} ${y + h}` : '',
        `H ${x + rb}`,
        rb > 0 ? `Q ${x} ${y + h} ${x} ${y + h - rb}` : '',
        `V ${y + rt}`,
        rt > 0 ? `Q ${x} ${y} ${x + rt} ${y}` : '',
        'Z',
    ].filter(Boolean).join(' ');
}
