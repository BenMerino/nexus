import type React from 'react';

export const tokens = {
  colors: {
    brand: {
      primary: 'var(--primary)', primaryBright: 'var(--primary-bright)',
      secondary: 'var(--secondary)', secondaryDim: 'var(--secondary-dim)', accent: 'var(--accent)',
    },
    status: {
      success: 'var(--status-success)', warning: 'var(--status-warning)',
      error: 'var(--status-error)', info: 'var(--status-info)', muted: 'var(--text-muted)',
    },
    surface: {
      main: 'var(--bg-main)', card: 'var(--bg-card)', elevated: 'var(--bg-elevated)',
      highest: 'var(--bg-highest)', input: 'var(--bg-input)', overlay: 'rgba(255,255,255,0.1)',
    },
    tonal: {
      base: 'var(--surface)', low: 'var(--surface-low)',
      high: 'var(--surface-high)', highest: 'var(--surface-highest)',
    },
    text: {
      heading: 'var(--text-main)', body: 'var(--text-main)',
      muted: 'var(--text-muted)', inverse: 'var(--text-inverse)',
      success: 'var(--status-success)', error: 'var(--status-error)', warning: 'var(--status-warning)',
    },
    border: {
      subtle: 'var(--border-subtle)', standard: 'var(--border-main)', ghost: 'var(--border-ghost)',
    },
    input: { bg: 'var(--input-bg)', border: 'var(--input-border)', focusBg: 'var(--input-focus-bg)' },
    effects: { glowBrand: 'var(--glow-brand)', glowAmbient: 'var(--glow-ambient)', glassBg: 'var(--glass-bg)' },
  },
  spacing: {
    '0': 'var(--space-0)', '0.5': 'var(--space-0-5)', '1': 'var(--space-1)', '1.5': 'var(--space-1-5)',
    '2': 'var(--space-2)', '3': 'var(--space-3)', '4': 'var(--space-4)', '5': 'var(--space-5)',
    '6': 'var(--space-6)', '8': 'var(--space-8)', '10': 'var(--space-10)', '12': 'var(--space-12)', '16': 'var(--space-16)',
    page: 'var(--space-page)', section: 'var(--space-section)', component: 'var(--space-component)', element: 'var(--space-element)',
  },
  radii: {
    none: 'var(--radius-none)', sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)', '2xl': 'var(--radius-2xl)', '3xl': 'var(--radius-3xl)', full: 'var(--radius-full)',
    /* Surface roles — the curated radius vocabulary (declare what a thing
     * IS; the raw scale above stays as escape-hatch). See docs/handoffs/
     * surface-roles-2026-05-20.md. chrome/chrome-popover are superseded by
     * control/card and retired in Phase 4. */
    control: 'var(--radius-control)',
    card: 'var(--radius-card)',
    section: 'var(--radius-section)',
    pill: 'var(--radius-pill)',
  },
  itemRadii: {
    sm: 'var(--radius-item-sm)', md: 'var(--radius-item)', lg: 'var(--radius-item-lg)',
  },
  surfaceRadii: {
    sm: 'var(--radius-surface-sm)', md: 'var(--radius-surface-md)', lg: 'var(--radius-surface-lg)',
    xl: 'var(--radius-surface-xl)', '2xl': 'var(--radius-surface-2xl)',
  },
  shadows: {
    none: 'none', sm: 'var(--shadow-sm)', md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)', xl: 'var(--shadow-xl)', '2xl': 'var(--shadow-2xl)',
  },
} as const;

/* The canonical type roles. Each binds family + size + weight + leading +
 * tracking from the dna.css contract — so picking a variant is picking a
 * complete role, never assembling properties by hand. The map below is
 * GENERATED from ui/dna/type-scale.js (the single source) — DO NOT EDIT it;
 * edit the source and run `npm run gen:type`. Role docs live in the source. */
const w = (v: string) => v as React.CSSProperties['fontWeight'];
/* @generated:type-scale tokens — DO NOT EDIT. Source: ui/dna/type-scale.js. Run: npm run gen:type */
export const typography: Record<string, React.CSSProperties> = {
  display: { fontFamily: 'var(--font-display)', fontSize: 'var(--text-display)', fontWeight: w('var(--weight-display)'), lineHeight: 'var(--leading-display)', letterSpacing: 'var(--tracking-display)' },
  h1: { fontFamily: 'var(--font-body)', fontSize: 'var(--text-h1)', fontWeight: w('var(--weight-h1)'), lineHeight: 'var(--leading-h1)', letterSpacing: 'var(--tracking-h)' },
  h2: { fontFamily: 'var(--font-body)', fontSize: 'var(--text-h2)', fontWeight: w('var(--weight-h2)'), lineHeight: 'var(--leading-h2)', letterSpacing: 'var(--tracking-h)' },
  h3: { fontFamily: 'var(--font-body)', fontSize: 'var(--text-h3)', fontWeight: w('var(--weight-h3)'), lineHeight: 'var(--leading-h3)' },
  body: { fontFamily: 'var(--font-body)', fontSize: 'var(--text-body)', fontWeight: w('var(--weight-body)'), lineHeight: 'var(--leading-body)', letterSpacing: 'var(--tracking-body)' },
  detail: { fontFamily: 'var(--font-body)', fontSize: 'var(--text-detail)', fontWeight: w('var(--weight-detail)'), lineHeight: 'var(--leading-detail)' },
  caption: { fontFamily: 'var(--font-body)', fontSize: 'var(--text-caption)', fontWeight: w('var(--weight-caption)'), lineHeight: 'var(--leading-caption)' },
  label: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-label)', fontWeight: w('var(--weight-label)'), lineHeight: 'var(--leading-label)', letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase' },
  micro: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', fontWeight: w('var(--weight-micro)'), lineHeight: 'var(--leading-micro)' },
};
  /* @end:type-scale tokens */

export type SpacingToken = keyof typeof tokens.spacing;
export type ColorToken = string;
export type RadiusToken = keyof typeof tokens.radii;
export type TypographyVariant = keyof typeof typography;

/** Map a spacing token to its CSS var (or undefined). Shared by the
 *  spacing/margin/padding props on BaseBox and BaseText. */
export const sp = (key: SpacingToken | undefined) => key ? tokens.spacing[key] : undefined;

/** Named font-weight → numeric value. Shared by BaseText and MetaChip. */
export const WEIGHT_MAP: Record<string, number> = {
  light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, black: 900,
};
