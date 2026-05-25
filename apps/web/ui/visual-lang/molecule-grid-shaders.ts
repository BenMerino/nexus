/* Shader sources for the molecule-grid primitive.
 *
 * Extracted from molecule-grid.ts to keep the runtime/program file under
 * the file-length ceiling. The fragment shader docstring (originally inline
 * in molecule-grid.ts) is preserved here next to the GLSL it documents. */

export const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/* Fragment shader — parameterized cell renderer.
 *
 * Cells are arranged in a uCols × uRows grid covering the canvas. Each cell
 * is a superellipse SDF (Minkowski exponent 6) with bloom halo, dormant
 * grey at low brightness, iridescence shimmer phased by position + time,
 * and a highlight-blowout post effect when peak brightness exceeds threshold.
 *
 * Cell brightness data is sampled from a 2D RGBA texture:
 *   .rgb = cell color pre-multiplied by brightness (matches molecule encoding)
 *   .a   = cell brightness 0..1+ (drives cell body size + bloom intensity)
 *
 * uOverflow controls cell-grid overflow into the canvas margins (1.5 in the
 * original molecule lets bloom extend past the grid edges). Independent of
 * cols/rows — works the same for square molecule and wide chart.
 *
 * Iteration: every pixel iterates a fixed 5×5 cell window (±2 cells)
 * centered on its grid floor position. At bloom radius ≈ 1, contributions
 * beyond distance 2 are exp(-7) ≈ 0.0009, mathematically invisible at
 * 8-bit color depth. Two earlier obstacles to a windowed loop are
 * resolved here:
 *   1. fwidth(cellD)'s derivative discontinuity across windows is gone —
 *      replaced by a constant uAaWidth uniform passed by the CPU,
 *      identical for every pixel. Same AA quality, no seams.
 *   2. Margin bloom cutoff is gone — out-of-bounds window indices are
 *      skipped (those cells don't exist), but the *window itself* is
 *      not pinched. Edge cells bloom into margin pixels naturally.
 * Result: O(canvas_area × 25) regardless of grid size. ~130× cheaper
 * than the old full-loop at 90×36 grids; identical visual output. */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform float uMoleculeTime;
uniform float uDensity;
uniform float uGlow;
uniform float uIridescence;

uniform float uCols;
uniform float uRows;
uniform float uOverflow;
uniform float uAaWidth;     // anti-aliasing width in cell-units; replaces fwidth(cellD)
uniform vec2 uResolution;   // canvas physical pixel dimensions
uniform sampler2D uCells;

/* Active region: where data is allowed to light cells. Cells outside
 * the region still render their structural identity (dormant grey +
 * AA + cell SDF) but their lit value is force-zeroed — so the
 * molecule grid covers the entire canvas uniformly while data only
 * appears inside the declared region. One canvas per card; no layering.
 *
 * uActiveKind:
 *   0 = full canvas (no-op — every cell may activate)
 *   1 = annulus: cells inside [rInner, rOuter] disc around uActiveCenter,
 *       optionally restricted to angular range [start, end).
 *   2 = rect: cells whose centers fall inside the (uActiveRectMin,
 *       uActiveRectMax) bounding box (physical pixels). */
uniform int uActiveKind;
uniform vec2 uActiveCenter;     // physical pixels
uniform float uActiveROuter;    // physical pixels
uniform float uActiveRInner;    // physical pixels
uniform float uActiveStartAngle;
uniform float uActiveEndAngle;
uniform vec2 uActiveRectMin;    // physical pixels (top-left)
uniform vec2 uActiveRectMax;    // physical pixels (bottom-right)

/* Dormant cell tuning — uDormant is the white-body contribution;
 * uDormantGrey is the alpha multiplier on the cool-grey overlay. Total
 * dormant cell brightness ≈ uDormant + 0.3 * uDormantGrey. */
uniform float uDormant;
uniform float uDormantGrey;

void main() {
    vec2 gridCenter = vec2(uCols, uRows) * 0.5;
    vec2 sq = (vUv - 0.5) * vec2(uCols, uRows) * uOverflow + gridCenter;

    /* Cell pixel aspect: (cellWidthPx / cellHeightPx). When != 1, cells
     * are rectangular pixels and the SDF would render as squashed
     * superellipses. Compensate by multiplying grid-space delta by
     * (cellAspect, 1) when cells are wider than tall, or (1, 1/cellAspect)
     * when taller — yields a visually-square lit body of side
     * min(cellWidthPx, cellHeightPx). The molecule loader (square canvas,
     * square grid) has cellAspect = 1 so this is a no-op for it. */
    float cellAspect = (uResolution.x / uCols) / (uResolution.y / uRows);
    vec2 dScale = cellAspect > 1.0
        ? vec2(cellAspect, 1.0)            // wide cells: scale d.x → narrower lit region
        : vec2(1.0, 1.0 / cellAspect);     // tall cells: scale d.y → shorter lit region

    fragColor = vec4(0.0);
    float maxBody = 0.0;

    int colsI = int(uCols);
    int rowsI = int(uRows);
    /* Per-pixel grid floor: the cell column/row this pixel sits inside.
     * Iterate ±2 cells around it; out-of-bounds indices are skipped but
     * the window itself isn't pinched (margin pixels still get bloom from
     * edge cells via this same window).  */
    int cgx = int(floor(sq.x));
    int cgy = int(floor(sq.y));
    for (int dy = -2; dy <= 2; dy++) {
        int gy = cgy + dy;
        if (gy < 0 || gy >= rowsI) continue;
        for (int dx = -2; dx <= 2; dx++) {
            int gx = cgx + dx;
            if (gx < 0 || gx >= colsI) continue;

            float cx = float(gx) + 0.5;
            float cy = float(gy) + 0.5;

            /* Texture UV: cellArr is uploaded row-major and combined with
             * WebGL's bottom-up texture convention, gy=0 in the cellArr
             * maps to the visual BOTTOM of the canvas. The molecule's
             * path constants and field functions are all authored against
             * this convention (gy=0 = bottom). New consumers (charts)
             * must follow the same convention when writing their cellArr.
             */
            vec2 texUv = (vec2(float(gx), float(gy)) + 0.5) / vec2(uCols, uRows);
            vec4 cb = texture(uCells, texUv);
            float lit = cb.a;
            vec3 color = cb.rgb;

            /* Active region gate: cells outside the region force their
             * lit value to zero — they still render structurally
             * (dormant grey, AA, SDF) so the molecule grid covers the
             * entire canvas, but no data can appear outside the region. */
            bool outOfRegion = false;
            if (uActiveKind != 0) {
                vec2 cellPxCenter = (vec2(cx, cy) - vec2(uCols, uRows) * 0.5)
                    / (vec2(uCols, uRows) * uOverflow) * uResolution
                    + uResolution * 0.5;
                if (uActiveKind == 1) {
                    vec2 dPx = cellPxCenter - uActiveCenter;
                    float rPx = length(dPx);
                    outOfRegion = (rPx > uActiveROuter || rPx < uActiveRInner);
                    if (uActiveStartAngle != uActiveEndAngle && !outOfRegion) {
                        float ang = atan(dPx.y, dPx.x);
                        bool inSweep = false;
                        for (int k = -1; k <= 1; k++) {
                            float a = ang + float(k) * 6.28318530718;
                            if (a >= uActiveStartAngle && a < uActiveEndAngle) {
                                inSweep = true;
                                break;
                            }
                        }
                        if (!inSweep) outOfRegion = true;
                    }
                } else if (uActiveKind == 2) {
                    outOfRegion = (cellPxCenter.x < uActiveRectMin.x
                                || cellPxCenter.y < uActiveRectMin.y
                                || cellPxCenter.x > uActiveRectMax.x
                                || cellPxCenter.y > uActiveRectMax.y);
                }
                if (outOfRegion) {
                    lit = 0.0;
                    color = vec3(0.0);
                }
            }

            /* Aspect-corrected delta drives the SDF + bloom geometry. */
            vec2 dShape = (sq - vec2(cx, cy)) * dScale;
            float cellD = pow(pow(abs(dShape.x), 6.0) + pow(abs(dShape.y), 6.0), 1.0 / 6.0);
            float halfCellInactive = mix(0.12, 0.46, smoothstep(0.0, 1.0, 0.0));
            /* Fast path for outside-region cells: render exactly what
             * an inside-region cell with lit=0 would render. Skip data
             * math (color mix, iridescence cos, bloom exp) — all those
             * multiply by lit/scaleAmt which are 0 here. But MUST paint
             * the same dormant body + dormant grey contributions or
             * inside vs. outside cells render at different brightnesses
             * (visible color seam at the active-region boundary).
             *
             * Equivalent to the full path with lit=0:
             *   renderLit = DORMANT
             *   scaleAmt = 0  →  halfCell = 0.12 (inactive size)
             *   bodyAlpha = DORMANT * inCell  →  paint white * bodyAlpha
             *   dormantWeight = inCell * (1 - 0) = inCell
             *   dormantAlpha = inCell * 0.25  →  paint vec3(0.3) * dormantAlpha
             * Sum: vec3(DORMANT + 0.3 * 0.25) * inCell = vec3(0.095) * inCell. */
            if (outOfRegion) {
                float inCellFast = 1.0 - smoothstep(halfCellInactive - uAaWidth, halfCellInactive + uAaWidth, cellD);
                float dormantAlphaFast = inCellFast * uDormantGrey;
                fragColor.rgb += vec3(uDormant) * inCellFast;          // body at lit=uDormant, color=white
                fragColor.rgb += vec3(0.3) * dormantAlphaFast;        // dormant grey overlay
                fragColor.a = max(fragColor.a, dormantAlphaFast);
                continue;
            }

            float renderLit = max(lit, uDormant);
            float rawScale = clamp(lit, 0.0, 1.0);
            float scaleAmt = smoothstep(0.0, 1.0, rawScale);
            float halfCell = mix(0.12, 0.46, scaleAmt);
            float inCell = 1.0 - smoothstep(halfCell - uAaWidth, halfCell + uAaWidth, cellD);

            float bloomD = length(dShape);
            float bloomR = 0.7 + uGlow * 0.6;
            float bloom = exp(-bloomD * (3.5 / bloomR)) * uGlow * scaleAmt * (1.0 - inCell);

            float bodyAlpha = renderLit * inCell;

            vec3 hue = lit > 0.01 ? color / max(lit, 0.01) : vec3(1.0);
            vec3 baseColor = mix(vec3(1.0), hue, clamp(lit * 3.0, 0.0, 1.0));

            float holoPhase = (cx * 0.7 - cy * 0.7) + uMoleculeTime * 1.5;
            vec3 iridescence = 0.5 + 0.5 * cos(holoPhase + vec3(0.0, 2.0, 4.0));
            vec3 iridBase = mix(baseColor, iridescence * baseColor * 2.0, scaleAmt * 0.85 * uIridescence);

            vec3 col = iridBase * (bodyAlpha + bloom * 0.7);
            fragColor.rgb += col;

            float dormantWeight = inCell * (1.0 - clamp(lit, 0.0, 1.0));
            float dormantAlpha = dormantWeight * uDormantGrey;
            vec3 dormantRgb = vec3(0.3) * dormantAlpha;
            fragColor.rgb += dormantRgb;
            fragColor.a = max(fragColor.a, dormantAlpha);
            maxBody = max(maxBody, inCell * clamp(lit, 0.0, 1.0));
        }
    }

    float maxCol = max(fragColor.r, max(fragColor.g, fragColor.b));
    float blowoutThreshold = 0.4;
    if (maxCol > blowoutThreshold) {
        float excess = maxCol - blowoutThreshold;
        float rayMultiplier = (1.0 - maxBody) * 2.5;
        fragColor.rgb += fragColor.rgb * (excess * rayMultiplier);
    }
    fragColor.rgb = min(fragColor.rgb, vec3(1.0));
    float finalMax = max(fragColor.r, max(fragColor.g, fragColor.b));
    fragColor.a = max(fragColor.a, finalMax);
}
`;
