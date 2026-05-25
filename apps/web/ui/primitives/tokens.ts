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

export const typography: Record<string, React.CSSProperties> = {
  display: { fontSize: 'var(--text-display)', fontWeight: 'var(--weight-display)' as React.CSSProperties['fontWeight'], letterSpacing: 'var(--tracking-display)' },
  h1: { fontSize: 'var(--text-h1)', fontWeight: 'var(--weight-h1)' as React.CSSProperties['fontWeight'], lineHeight: 'var(--leading-h1)' },
  h2: { fontSize: 'var(--text-h2)', fontWeight: 'var(--weight-h2)' as React.CSSProperties['fontWeight'], lineHeight: 'var(--leading-h2)' },
  h3: { fontSize: 'var(--text-h3)', fontWeight: 'var(--weight-h3)' as React.CSSProperties['fontWeight'] },
  body: { fontSize: 'var(--text-body)', fontWeight: 'var(--weight-body)' as React.CSSProperties['fontWeight'] },
  detail: { fontSize: 'var(--text-detail)', fontWeight: 'var(--weight-detail)' as React.CSSProperties['fontWeight'] },
  /* Sentence-style helper text — section descriptions, hint copy under inputs.
   * Sentence-case, normal letter-spacing, slightly relaxed line-height. Use
   * this instead of `label` whenever the content is a sentence. */
  caption: { fontSize: 'var(--text-caption, var(--text-detail))', fontWeight: 'var(--weight-caption, var(--weight-detail))' as React.CSSProperties['fontWeight'], lineHeight: 'var(--leading-caption, 1.5)' },
  /* Tag-style microcopy — single words above a value, badge text, "DETAILS"
   * "TOTAL", "PAID". Uppercase + tracked. Don't use for sentences. */
  label: { fontSize: 'var(--text-label)', fontWeight: 'var(--weight-label)' as React.CSSProperties['fontWeight'], textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)' },
};

export type SpacingToken = keyof typeof tokens.spacing;
export type ColorToken = string;
export type RadiusToken = keyof typeof tokens.radii;
export type TypographyVariant = keyof typeof typography;
