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

/** Band scale: maps categorical labels → { x, width } bands */
export function bandScale(labels: string[], range: [number, number], padding = 0.2) {
    const [r0, r1] = range;
    const total = r1 - r0;
    const step = total / labels.length;
    const bandW = step * (1 - padding);
    const offset = step * padding * 0.5;
    const map = new Map(labels.map((l, i) => [l, { x: r0 + i * step + offset, width: bandW }]));
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

/** SVG arc path from center, radius, start/end angles */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
    const s = { x: cx + r * Math.cos(start), y: cy + r * Math.sin(start) };
    const e = { x: cx + r * Math.cos(end), y: cy + r * Math.sin(end) };
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/** SVG donut arc (with inner radius) — returns closed path */
export function donutArc(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
    const os = { x: cx + outer * Math.cos(start), y: cy + outer * Math.sin(start) };
    const oe = { x: cx + outer * Math.cos(end), y: cy + outer * Math.sin(end) };
    const ie = { x: cx + inner * Math.cos(end), y: cy + inner * Math.sin(end) };
    const is_ = { x: cx + inner * Math.cos(start), y: cy + inner * Math.sin(start) };
    const large = end - start > Math.PI ? 1 : 0;
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
