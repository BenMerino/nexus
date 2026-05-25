/* Shader sources for the molecule-grid primitive — WebGPU/WGSL.
 *
 * Direct translation of molecule-grid-shaders.ts (GLSL ES 3.00 → WGSL).
 * Same vocabulary: superellipse cell SDF (Minkowski exp 6) + bloom +
 * iridescence + dormant grey + ±2 cell windowed loop + active region gate.
 *
 * Conventions preserved verbatim:
 *   - gy=0 = bottom row of the cell texture (matches WebGL's bottom-up
 *     convention; charts and emitters all author against this).
 *   - vUv y is flipped vs. clip-space y so UV (0,0) is bottom-left, same as
 *     the GLSL source.
 *   - Active rect/annulus coordinates arrive in CSS top-down pixels; the
 *     CPU-side flip in molecule-grid.ts already converts to bottom-up
 *     fragCoord-style pixels before binding, so the shader treats them
 *     directly.
 *
 * One module, two entry points: vs_main + fs_main. WebGPU requires a
 * single render pipeline per program, so both stages live here. */

export const MOLECULE_GRID_WGSL = /* wgsl */ `
struct Uniforms {
    /* Floats. */
    moleculeTime: f32,
    density: f32,
    glow: f32,
    iridescence: f32,
    cols: f32,
    rows: f32,
    overflow: f32,
    aaWidth: f32,
    /* uResolution split + activeKind packed alongside (vec4 alignment). */
    resolution: vec2<f32>,
    activeKind: u32,
    _pad0: f32,
    /* Active region — annulus. */
    activeCenter: vec2<f32>,
    activeROuter: f32,
    activeRInner: f32,
    activeStartAngle: f32,
    activeEndAngle: f32,
    /* Active region — rect. */
    activeRectMin: vec2<f32>,
    activeRectMax: vec2<f32>,
    /* Dormant body knobs. */
    dormant: f32,
    dormantGrey: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var cellTex: texture_2d<f32>;
@group(0) @binding(2) var cellSampler: sampler;

struct VsOut {
    @builtin(position) clipPos: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VsOut {
    /* Fullscreen triangle-strip: 4 verts → two triangles covering NDC. */
    var positions = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0),
    );
    var out: VsOut;
    let p = positions[vid];
    out.clipPos = vec4<f32>(p, 0.0, 1.0);
    /* Match GLSL: vUv = aPosition * 0.5 + 0.5 — bottom-left = (0,0). WebGPU
     * NDC y points up just like WebGL clip-space, so this maps the same way. */
    out.uv = p * 0.5 + vec2<f32>(0.5, 0.5);
    return out;
}

fn pow6(x: f32) -> f32 {
    let x2 = x * x;
    return x2 * x2 * x2;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let cols = u.cols;
    let rows = u.rows;
    let gridCenter = vec2<f32>(cols, rows) * 0.5;
    let sq = (in.uv - vec2<f32>(0.5)) * vec2<f32>(cols, rows) * u.overflow + gridCenter;

    /* Cell pixel aspect compensation — same as GLSL. */
    let cellAspect = (u.resolution.x / cols) / (u.resolution.y / rows);
    var dScale: vec2<f32>;
    if (cellAspect > 1.0) {
        dScale = vec2<f32>(cellAspect, 1.0);
    } else {
        dScale = vec2<f32>(1.0, 1.0 / cellAspect);
    }

    var fragColor = vec4<f32>(0.0);
    var maxBody: f32 = 0.0;

    let colsI = i32(cols);
    let rowsI = i32(rows);
    let cgx = i32(floor(sq.x));
    let cgy = i32(floor(sq.y));

    for (var dy: i32 = -2; dy <= 2; dy = dy + 1) {
        let gy = cgy + dy;
        if (gy < 0 || gy >= rowsI) { continue; }
        for (var dx: i32 = -2; dx <= 2; dx = dx + 1) {
            let gx = cgx + dx;
            if (gx < 0 || gx >= colsI) { continue; }

            let cx = f32(gx) + 0.5;
            let cy = f32(gy) + 0.5;

            /* Cell texture lookup — UV uses (gx+0.5, gy+0.5)/(cols, rows).
             * Same mapping as the GLSL implementation: JS cellArr row gy
             * lands at texture v = (gy+0.5)/rows, which both backends
             * sample identically — writeTexture puts JS row 0 at the
             * row read when v=0, matching GL's texImage2D default. The
             * "gy=0 = visual bottom" convention falls out because cell-
             * space sq.y=0 is also the bottom of the canvas in both
             * backends' clip-space. No flip needed. */
            let texU = (f32(gx) + 0.5) / cols;
            let texV = (f32(gy) + 0.5) / rows;
            let cb = textureSampleLevel(cellTex, cellSampler, vec2<f32>(texU, texV), 0.0);
            var lit = cb.a;
            var color = cb.rgb;

            /* Active region gate — same logic as GLSL, branchless-ish. */
            var outOfRegion: bool = false;
            if (u.activeKind != 0u) {
                /* cellPxCenter in physical pixels (fragCoord style). */
                let cellPxCenter = (vec2<f32>(cx, cy) - vec2<f32>(cols, rows) * 0.5)
                    / (vec2<f32>(cols, rows) * u.overflow) * u.resolution
                    + u.resolution * 0.5;
                if (u.activeKind == 1u) {
                    let dPx = cellPxCenter - u.activeCenter;
                    let rPx = length(dPx);
                    outOfRegion = (rPx > u.activeROuter || rPx < u.activeRInner);
                    if (u.activeStartAngle != u.activeEndAngle && !outOfRegion) {
                        let ang = atan2(dPx.y, dPx.x);
                        var inSweep: bool = false;
                        for (var k: i32 = -1; k <= 1; k = k + 1) {
                            let a = ang + f32(k) * 6.28318530718;
                            if (a >= u.activeStartAngle && a < u.activeEndAngle) {
                                inSweep = true;
                                break;
                            }
                        }
                        if (!inSweep) { outOfRegion = true; }
                    }
                } else if (u.activeKind == 2u) {
                    outOfRegion = (cellPxCenter.x < u.activeRectMin.x
                                || cellPxCenter.y < u.activeRectMin.y
                                || cellPxCenter.x > u.activeRectMax.x
                                || cellPxCenter.y > u.activeRectMax.y);
                }
                if (outOfRegion) {
                    lit = 0.0;
                    color = vec3<f32>(0.0);
                }
            }

            let dShape = (sq - vec2<f32>(cx, cy)) * dScale;
            /* GLSL: pow(pow(|x|,6) + pow(|y|,6), 1/6).  Use pow6() for the
             * inner two and a fractional pow for the outer root. */
            let cellD = pow(pow6(abs(dShape.x)) + pow6(abs(dShape.y)), 1.0 / 6.0);
            let halfCellInactive = mix(0.12, 0.46, smoothstep(0.0, 1.0, 0.0));

            if (outOfRegion) {
                let inCellFast = 1.0 - smoothstep(halfCellInactive - u.aaWidth,
                                                   halfCellInactive + u.aaWidth, cellD);
                let dormantAlphaFast = inCellFast * u.dormantGrey;
                let bodyContrib = vec3<f32>(u.dormant) * inCellFast;
                let greyContrib = vec3<f32>(0.3) * dormantAlphaFast;
                fragColor = vec4<f32>(
                    fragColor.rgb + bodyContrib + greyContrib,
                    max(fragColor.a, dormantAlphaFast),
                );
                continue;
            }

            let renderLit = max(lit, u.dormant);
            let rawScale = clamp(lit, 0.0, 1.0);
            let scaleAmt = smoothstep(0.0, 1.0, rawScale);
            let halfCell = mix(0.12, 0.46, scaleAmt);
            let inCell = 1.0 - smoothstep(halfCell - u.aaWidth, halfCell + u.aaWidth, cellD);

            let bloomD = length(dShape);
            let bloomR = 0.7 + u.glow * 0.6;
            let bloom = exp(-bloomD * (3.5 / bloomR)) * u.glow * scaleAmt * (1.0 - inCell);

            let bodyAlpha = renderLit * inCell;

            var hue: vec3<f32>;
            if (lit > 0.01) {
                hue = color / max(lit, 0.01);
            } else {
                hue = vec3<f32>(1.0);
            }
            let baseColor = mix(vec3<f32>(1.0), hue, clamp(lit * 3.0, 0.0, 1.0));

            let holoPhase = (cx * 0.7 - cy * 0.7) + u.moleculeTime * 1.5;
            let iridescence = vec3<f32>(0.5) + vec3<f32>(0.5) *
                cos(vec3<f32>(holoPhase) + vec3<f32>(0.0, 2.0, 4.0));
            let iridBase = mix(baseColor, iridescence * baseColor * 2.0, scaleAmt * 0.85 * u.iridescence);

            let col = iridBase * (bodyAlpha + bloom * 0.7);
            let dormantWeight = inCell * (1.0 - clamp(lit, 0.0, 1.0));
            let dormantAlpha = dormantWeight * u.dormantGrey;
            let dormantRgb = vec3<f32>(0.3) * dormantAlpha;
            fragColor = vec4<f32>(
                fragColor.rgb + col + dormantRgb,
                max(fragColor.a, dormantAlpha),
            );
            maxBody = max(maxBody, inCell * clamp(lit, 0.0, 1.0));
        }
    }

    /* Highlight blowout — boost when peak channel exceeds threshold, with
     * "rays" (per-channel multiply) decreasing as cell body fills more
     * of the pixel's window. Same math as GLSL. */
    let maxCol = max(fragColor.r, max(fragColor.g, fragColor.b));
    let blowoutThreshold = 0.4;
    var rgb = fragColor.rgb;
    if (maxCol > blowoutThreshold) {
        let excess = maxCol - blowoutThreshold;
        let rayMultiplier = (1.0 - maxBody) * 2.5;
        rgb = rgb + rgb * (excess * rayMultiplier);
    }
    rgb = min(rgb, vec3<f32>(1.0));
    let finalMax = max(rgb.r, max(rgb.g, rgb.b));
    return vec4<f32>(rgb, max(fragColor.a, finalMax));
}
`;
