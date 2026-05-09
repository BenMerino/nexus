export function parseHex(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function resolveStop(stop: string): string {
    const m = stop.match(/^var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)$/);
    if (!m) return stop;
    if (typeof window === 'undefined') return m[2]?.trim() || '#888';
    const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
    if (v && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
    return m[2]?.trim() || '#888';
}
export function rampColor(stops: string[], t: number): string {
    if (stops.length < 2) return stops[0] ?? '#888';
    const seg = Math.min(t, 0.999) * (stops.length - 1);
    const i = Math.floor(seg), f = seg - i;
    const [ar, ag, ab] = parseHex(resolveStop(stops[i])), [br, bg, bb] = parseHex(resolveStop(stops[i + 1]));
    return `rgb(${Math.round(ar + (br - ar) * f)},${Math.round(ag + (bg - ag) * f)},${Math.round(ab + (bb - ab) * f)})`;
}
