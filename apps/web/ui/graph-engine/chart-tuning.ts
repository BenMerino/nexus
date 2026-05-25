/**
 * Chart visual-identity tuning. Drives the GPU fragment shader's
 * non-data uniforms — glow, iridescence, edge softness, saturation.
 *
 * These knobs are independent of chart data; tweaking them changes how
 * every chart on the page renders (more bloom, more shimmer, etc.) but
 * not what each chart represents. Persisted per-tenant via the
 * TenantDNA `chartTuning` field; resolved at boot via
 * ChartTuningContext.
 */

import type { TenantDNA } from '../../calendar/tenant-dna.types.js';

export interface ChartTuning {
    /** HDR brightness boost on chart marks [0..2]. 0 = flat fill,
     *  1 = engine baseline (punchier), 2 = white-hot (channels clip
     *  to white). Applied AFTER iridescence and BEFORE saturation. */
    glow: number;
    /** Iridescence shimmer strength [0..1]. 0 = flat color, 1 = full
     *  rainbow modulation. Animates continuously when > 0 (rAF stays
     *  active to advance the shader's time uniform). */
    iridescence: number;
    /** Edge softness [0..2] — controls smoothstep band on antialiased
     *  shapes. 1 = engine baseline. Larger values feather edges more. */
    edgeSoftness: number;
    /** Color saturation multiplier [0..2]. 1 = neutral; 0 = greyscale. */
    saturation: number;
}

/** Engine defaults — match the hardcoded fallbacks in
 *  use-chart-canvas.ts. Editing these changes the engine baseline
 *  (rebuild required); editing per-tenant via DNA does not.
 *
 *  glow: 0.15 is intentionally restrained. The bloom composite is
 *  additive (intensity = glow * 4) over a 12-iteration half-res blur
 *  in an LDR pipeline; the previous default of 0.6 produced intensity
 *  2.4, which on dense / multi-series charts read as "blown out"
 *  because most pixels cleared the extract threshold and stacked into
 *  the halo. 0.15 keeps marks feeling alive without swamping them.
 *  Tenants who want more glow opt in via DNA chartTuning.glow.
 *
 *  saturation: 1.5 boosts chroma via the geometry shader's
 *  applySaturation pass (mix(luma, color, saturation)) so marks read
 *  with the same punch they had before glow was dialed back. At 1.0
 *  marks were perceptibly muted against the dark surface; 1.5 lands
 *  closer to the OKLCH-authored palette intent. */
export const DEFAULT_CHART_TUNING: ChartTuning = {
    glow: 0.15,
    iridescence: 0,
    edgeSoftness: 1,
    saturation: 1.5,
};

function clamp(v: number, min: number, max: number): number {
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
}

/** DNA-side override shape (every field optional). */
export type TenantDNAChartTuning = Partial<ChartTuning>;

/** Resolve a complete ChartTuning record from optional DNA overrides. */
export function resolveChartTuning(override?: TenantDNAChartTuning): ChartTuning {
    const base = DEFAULT_CHART_TUNING;
    if (!override) return { ...base };
    return {
        glow:         typeof override.glow         === 'number' ? clamp(override.glow,         0, 2) : base.glow,
        iridescence:  typeof override.iridescence  === 'number' ? clamp(override.iridescence,  0, 1) : base.iridescence,
        edgeSoftness: typeof override.edgeSoftness === 'number' ? clamp(override.edgeSoftness, 0, 2) : base.edgeSoftness,
        saturation:   typeof override.saturation   === 'number' ? clamp(override.saturation,   0, 2) : base.saturation,
    };
}

/** TenantDNA shape extension. The TenantDNA root type carries this
 *  optionally; if absent, defaults apply. */
export type TenantDNAWithChartTuning = TenantDNA & {
    chartTuning?: TenantDNAChartTuning;
};
