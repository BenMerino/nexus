import type { StatusType } from './calendar.types.js';

/* ── Tenant DNA — Layer 1: Identity ────────────────────────── */

export interface TenantDNABrand {
  primary: string;
  secondary: string;
  accent: string;
}

export interface TenantDNAGradients {
  brandAction: { angle: number; stops: string[] };
  chartFill?: { angle: number; stops: string[] };
}

/* ── Layer 2: Surfaces & Color System ──────────────────────── */

export interface TenantDNASurfaces {
  main: string;
  card: string;
  elevated: string;
  darkBase?: string;
}

export interface TenantDNADarkTokens {
  textMain?: string;
  textMuted?: string;
  borderMain?: string;
  borderSubtle?: string;
}

export interface TenantDNAStatusOverride {
  fill: string;
  stroke: string;
  dot: string;
}

export interface TenantDNASemanticColors {
  success: string;
  error: string;
  warning: string;
  info: string;
}

/** Sequential 5-stop ramps for continuous-color charts (heatmap, choropleth,
 *  density). Six canonical hue-spaced ramps share the same luminance curve so
 *  magnitude reads as darkness across encodings. Triadic 120° spacing on the
 *  oklch wheel guarantees that any two ramps mix cleanly via `color-mix(in
 *  oklch, …)` — no muddy interpolations through the achromatic axis. */
export interface TenantDNARamps {
  azure: string[];   // h=250 (primary)
  crimson: string[]; // h=10  (primary)
  amber: string[];   // h=130 (primary, yellow-green)
  violet: string[];  // h=310 (secondary: azure + crimson)
  orange: string[];  // h=70  (secondary: crimson + amber)
  teal: string[];    // h=190 (secondary: amber + azure)
}

export interface TenantDNAChartPalette {
  series: string[];
  ramps?: TenantDNARamps;
}

/* ── Layer 3: Effects & Depth ──────────────────────────────── */

export interface TenantDNAOpacity {
  glass: number;
  chartFill: number;
  gridLine: number;
  disabled: number;
}

export interface TenantDNAShadow {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  brandGlow: string;
  /** Uniform halo around an active/selected tile (no gravity). Used
   *  by L-chrome surfaces — rail active link, header buttons when
   *  selected, etc. Equal blur in all directions. */
  halo: string;
}

/* ── Layer 4: Motion ───────────────────────────────────────── */

export interface TenantDNAMotion {
  preference: 'full' | 'reduced' | 'minimal';
  durations: { fast: number; normal: number; slow: number; emphasis: number };
  easing: string;
}

/* ── Layer 5: Interaction ──────────────────────────────────── */

export interface TenantDNAFocus {
  ringWidth: number;
  ringOpacity: number;
  strategy: 'brand' | 'semantic';
}

/* ── Layer 6: Typography & Shape ───────────────────────────── */

export interface TenantDNATypography {
  fontFamily?: string;
  headingWeight?: 'semibold' | 'bold' | 'black';
}

export interface TenantDNAShape {
  borderRadius: 'sharp' | 'rounded' | 'pill';
  surfaceRadius?: 'sharp' | 'rounded' | 'soft';
}

/* ── Layer 7: Scheduling ───────────────────────────────── */

export interface TenantDNAScheduling {
  /** Minute step for time pickers (5, 10, 15, 30). Default: 15. */
  timeStep: number;
}

/* ── Layer 8: Loader Tuning (Molecule shaders) ─────────── */

/** Per-animation override for the molecule shader. Any subset of these
 *  fields wins over the registry's `defaultUniforms` and `defaultColor`.
 *  Keys are LoaderAnimationId values; we don't import that type here to
 *  avoid a UI/calendar circular dep — the consumer narrows it. */
/* Per-state overrides for the platform Molecule. Keys mirror StateTuning;
 * any subset can be overridden. The string keys match MoleculeStateId. */
export interface TenantDNALoaderOverride {
  color?: string;
  period?: number;
  magnitude?: number;
  decayRate?: number;
  lifetime?: number;
  pathStepDelay?: number;
  propagationSpeed?: number;
  sharpness?: number;
}

export type TenantDNALoaders = Partial<Record<string, TenantDNALoaderOverride>>;

/* ── Assembled Profile ─────────────────────────────────────── */

type TenantDNAShells = unknown;

export interface TenantDNA {
  tenantId: string;
  brand: TenantDNABrand;
  gradients?: TenantDNAGradients;
  surfaces?: TenantDNASurfaces;
  darkTokens?: TenantDNADarkTokens;
  statuses?: Partial<Record<StatusType, TenantDNAStatusOverride>>;
  semanticColors?: TenantDNASemanticColors;
  chartPalette?: TenantDNAChartPalette;
  opacity?: Partial<TenantDNAOpacity>;
  shadows?: Partial<TenantDNAShadow>;
  motion?: Partial<TenantDNAMotion>;
  focus?: Partial<TenantDNAFocus>;
  typography?: TenantDNATypography;
  shape?: TenantDNAShape;
  scheduling?: TenantDNAScheduling;
  darkMode?: 'auto' | 'light-only' | 'dark-only';
  shells?: TenantDNAShells;
  loaders?: TenantDNALoaders;
  /** Chart visual-identity overrides — glow, iridescence, edge
   *  softness, saturation. Drives the GPU shader uniforms across every
   *  chart in the dashboard. Schema in
   *  packages/shared/src/ui/graph-engine/chart-tuning.ts. */
  chartTuning?: { glow?: number; iridescence?: number; edgeSoftness?: number; saturation?: number };
}
