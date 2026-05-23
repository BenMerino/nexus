// Nexus DNA — semantic token dictionary (Phase 1).
//
// Mirrors Zincro's ui/primitives/tokens.ts: maps semantic names to the
// CSS custom properties defined in dna.css + shared.css, so TS/TSX code
// references tokens by meaning instead of repeating `var(--…)` strings or
// hardcoding values. Phase 2 primitives (BaseBox/BaseText/BaseAction)
// consume the typed scales below.
//
// This is a late-binding map: every value is a `var(--…)` string, so it
// resolves through the live theme (incl. the /theme editor and light mode).

export const tokens = {
  color: {
    // Surfaces
    bg: 'var(--bg)',
    bgElev: 'var(--bg-elev)',
    bgCard: 'var(--bg-card)',
    bgInset: 'var(--bg-inset)',
    border: 'var(--border)',
    borderSoft: 'var(--border-soft)',
    // Text
    fg: 'var(--fg)',
    fgMuted: 'var(--fg-muted)',
    fgDim: 'var(--fg-dim)',
    // Brand
    primary: 'var(--primary)',
    secondary: 'var(--secondary)',
    accent: 'var(--accent)',
    accentDim: 'var(--accent-dim)',
    // Status
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    err: 'var(--err)',
  },
  space: {
    0: 'var(--space-0)', 1: 'var(--space-1)', 2: 'var(--space-2)',
    3: 'var(--space-3)', 4: 'var(--space-4)', 5: 'var(--space-5)',
    6: 'var(--space-6)', 8: 'var(--space-8)', 10: 'var(--space-10)',
    12: 'var(--space-12)', 16: 'var(--space-16)',
  },
  radius: {
    control: 'var(--radius-control)',
    card: 'var(--radius-card)',
    pill: 'var(--radius-pill)',
  },
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  },
  z: {
    base: 'var(--z-base)',
    overlay: 'var(--z-overlay)',
    panel: 'var(--z-panel)',
    modal: 'var(--z-modal)',
  },
  motion: {
    fast: 'var(--motion-fast)',
    normal: 'var(--motion-normal)',
    slow: 'var(--motion-slow)',
    easeOut: 'var(--ease-out)',
  },
  font: {
    display: 'var(--display)',
    sans: 'var(--sans)',
    mono: 'var(--mono)',
  },
  text: {
    display: 'var(--text-display)',
    h1: 'var(--text-h1)',
    h2: 'var(--text-h2)',
    h3: 'var(--text-h3)',
    body: 'var(--text-body)',
    detail: 'var(--text-detail)',
    label: 'var(--text-label)',
  },
} as const;

export type SpaceToken = keyof typeof tokens.space;
export type RadiusToken = keyof typeof tokens.radius;
export type ColorToken = keyof typeof tokens.color;
