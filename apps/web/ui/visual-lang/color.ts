/**
 * Visual language — color resolution.
 *
 * Resolve any CSS color string into a normalized RGB tuple, and convert
 * HSL → RGB. Generic; no molecule-specific assumptions.
 */

/** Resolve any CSS color string ("red", "var(--primary)", "#0af", "hsl(...)",
 *  "oklch(...)", etc.) into a normalized [r, g, b] tuple in [0..1].
 *
 *  Strategy: render the color into a 1×1 canvas via fillStyle/fillRect and
 *  read it back via getImageData. The canvas API natively understands every
 *  CSS color format the browser does, including oklch/lab/color() and
 *  CSS variables (when the canvas's owning document has the variable in
 *  scope). Returns white on SSR or unresolvable input.
 *
 *  We use a probe span to resolve CSS variables (the canvas itself doesn't
 *  inherit cascade), then push the resolved color through the canvas. */
let _probe: HTMLSpanElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
export function resolveColor(value: string): [number, number, number] {
    if (typeof window === 'undefined') return [1, 1, 1];
    if (!_probe) {
        _probe = document.createElement('span');
        _probe.style.display = 'none';
        document.body.appendChild(_probe);
    }
    if (!_ctx) {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        _ctx = c.getContext('2d', { willReadFrequently: true });
    }
    if (!_ctx) return [1, 1, 1];
    // Resolve CSS variables and any computed color via the probe. The
    // probe inherits cascade from document.body, so `var(--token)` resolves
    // against the document's :root.
    _probe.style.color = '';
    _probe.style.color = value;
    const resolved = getComputedStyle(_probe).color || value;
    // Render through canvas to normalize any color format → RGB pixel.
    _ctx.clearRect(0, 0, 1, 1);
    _ctx.fillStyle = '#000';     // baseline so an invalid fillStyle leaves [0,0,0,0]
    _ctx.fillStyle = resolved;
    _ctx.fillRect(0, 0, 1, 1);
    const px = _ctx.getImageData(0, 0, 1, 1).data;
    return [px[0] / 255, px[1] / 255, px[2] / 255];
}

/** HSL → linear RGB. h in [0,1), s in [0,1], l in [0,1]. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h * 12) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
}
