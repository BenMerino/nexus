import type React from 'react';
import { MOTION } from '../motion-presets.js';

/* ── glassReveal (animation, co-located) ──────────────────
 * The motion props every animated glass overlay spreads onto the SAME element
 * that carries `overlaySurface`. Co-location is mandatory: backdrop-filter
 * samples relative to its own element's clip, and opacity flattens it into a
 * group buffer — so the clip-reveal animation and `willChange:transform` must
 * sit on the glass element itself, never a parent. Spread BOTH `overlaySurface`
 * and `glassRevealProps` on one `motion.<el>` and the blur stays live + perfect
 * for every frame, by construction.
 *
 *   <motion.div {...glassRevealProps} style={{ ...overlaySurface, ...placement }}>
 */
export const glassRevealProps = {
    ...MOTION.glassReveal,
    style: { willChange: 'transform' as const },
};

/* ── overlaySurface ───────────────────────────────────────
 * THE one floating-surface definition. Every popover/dropdown/menu body
 * spreads this instead of re-declaring bg/blur/border/shadow inline — which
 * is how they drifted (some glass, some solid, three different radii).
 *
 * Frosted-glass surface, driven entirely by DNA `--overlay-*` tokens (defined
 * once in dna-defaults.css, light + dark). To restyle EVERY floating surface
 * — opacity, blur, shadow — retune those tokens; never touch call sites.
 *
 * Radius is the `--radius-card` role (the floating-card corner). Bodies add
 * their own size/padding/overflow on top; this owns only the surface. */
export const overlaySurface: React.CSSProperties = {
    background: 'var(--overlay-bg)',
    backdropFilter: 'blur(var(--overlay-blur))',
    WebkitBackdropFilter: 'blur(var(--overlay-blur))',
    border: 'var(--overlay-border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--overlay-shadow)',
};
/* NOTE: there is intentionally NO `overlayPanel` (surface + padding) export.
 * A list panel adds no padding — the row inset is owned by the ONE list primitive
 * (ListItem's `.nest-row` margin), so the same row sits at the same gutter in
 * every panel. Surface + scroll are grouped in <PanelSurface> (controlSize is
 * NOT — it's a cluster concern the caller passes); the inset stays on the list.
 * (DatePicker, a calendar GRID not a list, inlines its own padding +
 * --_nest-r/--_nest-pad for the nav-button concentric corner.) */
