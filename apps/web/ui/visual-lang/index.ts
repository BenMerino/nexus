/**
 * Visual language — foundation primitives shared by molecule-style visual
 * surfaces (LoaderMolecule, chart molecules, MoleculeBackdrop). Pure,
 * geometry-agnostic.
 *
 * Public surface:
 *   - `acquireSharedRenderer` — single page-wide renderer (WebGPU
 *     primary, WebGL2 fallback). Backend-agnostic `renderFrame()` API.
 *   - `useMoleculeCanvas` — React hook that drives the renderer with a
 *     consumer-supplied `buildCells` function and tau-eased transitions.
 *   - Color, envelope, sharpness-gate, field-pass — small pure helpers
 *     used by emitter/field math.
 *   - `MoleculeBackdrop`, `useCardScene` — composed surfaces built on the
 *     same substrate.
 */

export { compileShader, linkProgram } from './gl-boot.js';
export { GLSL_NOISE } from './glsl-noise.js';
export { resolveColor, hslToRgb } from './color.js';
export {
    adsrEnvelope,
    ENVELOPE_ATTACK_SECONDS,
    ENVELOPE_HOLD_SECONDS,
} from './envelope.js';
export {
    gateByNeighborMax,
    buildGrid4NeighborGraph,
    type NeighborGraph,
} from './sharpness-gate.js';
export {
    computeGatedFieldPass,
    type FieldPassResult,
    type FieldSampler,
} from './field-pass.js';
export { prepareSquareFrame, MAX_DPR } from './canvas-frame.js';
export { CELL_PITCH_PX } from './molecule-grid.js';
export {
    acquireSharedRenderer,
    type SharedRenderer,
    type DrawParams,
    type ActiveRegion,
    type ChartDrawParams,
} from './shared-renderer.js';
export {
    useChartCanvas,
    type UseChartCanvasOpts,
} from './use-chart-canvas.js';
/* Vertex-packing helpers (writeRect, writePolygon, writePolylineStroke,
 * writeVertex, polylineStrokeTriangles, allocVertexBuffer, RGBA, the
 * FLOATS_PER_* constants) are deliberately NOT re-exported from this
 * barrel. They're the implementation detail of one consumer
 * (`tessellate-primitives.ts`); deep-imported there to keep the public
 * visual-lang API focused on the high-level entry points. */
export { MoleculeBackdrop } from './MoleculeBackdrop.js';
export { useCardScene, type CardSceneProps } from './CardScene.js';
export {
    useMoleculeCanvas,
    type BuildCells,
    type UseMoleculeCanvasOpts,
} from './use-molecule-canvas.js';
export {
    useAiGlowEdge,
    type UseAiGlowEdgeOpts,
} from './use-ai-glow-edge.js';
export {
    useAiGlowHost,
    type UseAiGlowHostOpts,
} from './use-ai-glow-host.js';
export {
    DEFAULT_GLOW_COLORS,
    AI_GLOW_COLORS,
    DEFAULT_GLOW_PROFILE,
    type GlowColors,
    type GlowProfile,
} from './ai-glow-ring.js';
export {
    useAiGlowText,
    type UseAiGlowTextOpts,
} from './use-ai-glow-text.js';
export {
    ACCENT_THEMES,
    ACCENT_ORDER,
    DEFAULT_ACCENT,
    resolveAccent,
    type AccentId,
    type AccentTheme,
} from './accent-themes.js';
export { accentVars, writeAccentVars } from './apply-accent.js';
export { ThemeAccentProvider, useAiGlowColors } from './ThemeAccentContext.js';
