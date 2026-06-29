/* ── aurora tuning ─────────────────────────────────────────
 * Configurable parameters of the living mesh-gradient button fill. Colors
 * default to the DNA --primary / --secondary tokens (so it stays on-brand
 * per tenant) but every stop is overridable per instance. */

export interface AuroraTuning {
    /** Blob colors (2..5). Any CSS color. Defaults pull from DNA tokens. */
    colors: string[];
    /** Drift speed of the mesh. */
    speed: number;
    /** Blob falloff — higher = softer, broader blends. */
    softness: number;
}

/** Colors default to EMPTY — the shader then uses the sun-pipeline stops
 *  (sunStops, sky-driven :root tokens). A caller can still pass an explicit
 *  `colors` array to override entirely. */
export const DEFAULT_AURORA_TUNING: AuroraTuning = {
    colors: [],
    speed: 0.5,
    softness: 0.12,
};

/** A single tunable knob's UI metadata — drives the workbench sliders. */
export interface AuroraKnob {
    key: 'speed' | 'softness';
    label: string;
    min: number;
    max: number;
    step: number;
}

export const AURORA_KNOBS: AuroraKnob[] = [
    { key: 'speed',    label: 'speed',    min: 0.0, max: 2.0, step: 0.05 },
    { key: 'softness', label: 'softness', min: 0.02, max: 0.4, step: 0.01 },
];
