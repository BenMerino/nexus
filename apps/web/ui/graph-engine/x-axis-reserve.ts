/**
 * Single authority for how much vertical space the BASE x-axis label row
 * needs. Both the margin builder (`buildCartesianLayout`) and the renderer
 * (`ChromeXAxisBand`) must agree on whether the base row rotates and how
 * far rotated glyphs drop below the axis — otherwise the margin reserves a
 * flat 14px strip while the renderer swings 12-char labels to -40° and they
 * punch through the bottom of the SVG (clipped by the container's
 * overflow:hidden). This module is the shared prediction so they can't drift.
 *
 * The renderer's rotation trigger (ChromeXAxisBand.xAxisLabelLayout) needs
 * the final plot width, which depends on the margin — a cycle. But the
 * TRIGGER condition (does the widest label exceed its per-slot char budget?)
 * only needs an ESTIMATE of the available width, which the margin builder
 * has before it allocates. We reproduce the trigger here against that
 * estimate; a conservative over-reserve is harmless (a little extra bottom
 * gutter), an under-reserve clips.
 */

/** Must match ChromeXAxisBand's TICK_FONT_AVG_CHAR_PX. */
const TICK_FONT_AVG_CHAR_PX = 5;
/** Rotation angle in ChromeXAxisBand (`rotate(-40deg)`). */
const ROTATE_DEG = 40;
/** Baseline offset of the label anchor below the axis line (`y + 14`). */
const LABEL_BASELINE_OFFSET = 14;
/** Flat (non-rotated) base row height — one 9px line + a little clearance.
 *  Matches the legacy `20` base reserve in buildCartesianLayout. */
const FLAT_BASE_RESERVE = 20;
/** Truncated-label floor (matches ChromeXAxisBand.X_LABEL_MIN_CHARS): a
 *  rotated label is abbreviated to at most this many glyphs when crowded,
 *  so the reserved diagonal drop is bounded even for very long source
 *  labels. We reserve for the widest label up to this cap — rotation only
 *  fires when labels don't fit, and when they don't fit they get truncated
 *  to ~maxChars, so reserving the full untruncated width would over-pad. */
const ROTATED_CHARS_CAP = 12;

/** Will the base x-axis row rotate? Mirrors xAxisLabelLayout's `rotate`:
 *  rotation fires when, at full density (a label per bucket), the widest
 *  label is wider than the per-bucket slot. `plotWidthEstimate` is the
 *  pre-margin plot width estimate; `n` the bucket count. */
function basRowRotates(labels: string[], plotWidthEstimate: number, n: number): boolean {
    if (n <= 1) return false;
    const slotPx = plotWidthEstimate / n;
    const maxChars = Math.floor(slotPx / TICK_FONT_AVG_CHAR_PX);
    return labels.some(l => l.length > maxChars);
}

/** Per-line height + max lines for wrapped categorical labels. Must match
 *  ChromeXAxisBand's LINE_H and label-wrap's MAX_LINES. */
const WRAP_LINE_H = 10;
const WRAP_MAX_LINES = 3;

/** Words-to-lines count for a label at the given per-line char budget —
 *  the same greedy pack `wrapLabel` does, but we only need the LINE COUNT
 *  to size the reserve (not the strings). Capped at WRAP_MAX_LINES. */
function wrappedLineCount(label: string, budget: number): number {
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 1;
    let lines = 1;
    let curLen = 0;
    for (const w of words) {
        if (curLen === 0) { curLen = w.length; }
        else if (curLen + 1 + w.length <= budget) { curLen += 1 + w.length; }
        else { lines++; curLen = w.length; }
    }
    return Math.min(WRAP_MAX_LINES, lines);
}

/** Bottom-margin px the BASE label row needs. Three modes:
 *   • categorical (institutions/journals) → labels WRAP onto upright lines
 *     (ChromeXAxisBand keepAll path); reserve baseline + N·lineHeight for the
 *     worst label's line count. The margin must match or the lowest line
 *     clips under the container's overflow:hidden.
 *   • temporal that would rotate → reserve the -40° diagonal drop.
 *   • otherwise → flat single line.
 *  Tier rows are added on top by the caller (always short, never wrap). */
export function baseXAxisReserve(labels: string[], plotWidthEstimate: number, categorical = false): number {
    const n = labels.length;
    if (n === 0) return FLAT_BASE_RESERVE;
    if (categorical) {
        const budget = Math.max(1, Math.floor((plotWidthEstimate / n) / TICK_FONT_AVG_CHAR_PX));
        const maxLines = labels.reduce((m, l) => Math.max(m, wrappedLineCount(l, budget)), 1);
        return Math.ceil(LABEL_BASELINE_OFFSET + maxLines * WRAP_LINE_H);
    }
    if (!basRowRotates(labels, plotWidthEstimate, n)) return FLAT_BASE_RESERVE;
    const widestChars = Math.min(ROTATED_CHARS_CAP, labels.reduce((m, l) => Math.max(m, l.length), 0));
    const widestPx = widestChars * TICK_FONT_AVG_CHAR_PX;
    const drop = Math.sin((ROTATE_DEG * Math.PI) / 180) * widestPx;
    /* Anchor sits at baseline `y + 14`; rotated glyphs extend `drop` below
     *  it. Add a couple px so descenders clear the SVG edge. */
    return Math.ceil(LABEL_BASELINE_OFFSET + drop + 2);
}
