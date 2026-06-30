/**
 * type-scale.js — THE single source of truth for nexus typography.
 *
 * One object describes every type ROLE (family + size + weight + leading +
 * tracking). Two artifacts are GENERATED from it, never hand-edited:
 *   1. the `:root` type block in apps/web/public/dna.css   (CSS custom props)
 *   2. the `typography` map in ui/primitives/tokens.ts      (React primitive)
 *
 * Edit a value HERE, run `npm run gen:type`, and BOTH regenerate — CSS vars and
 * the primitive can never drift, because they are two renders of this one
 * object. Nothing else may define type: the arch-audit N3 type guard blocks raw
 * font-size/weight/family outside var(--…).
 *
 * Plain ESM + JSDoc (not .ts) so the same file is imported by BOTH the Node
 * generator (scripts/gen-type-scale.mjs) and the TS primitive (tokens.ts) with
 * zero build step or extra dependency. This is the "one place, no loose horses."
 *
 * Adapted from Zincro's emitTypographyScale() — restructured so the SAME source
 * also drives the primitive map, closing the CSS↔tokens.ts drift hole Zincro
 * left open. No per-tenant input by design: type is global (nexus per-tenant
 * theming is the 7 surface colors via the N6 theme handler, not type).
 */

/** Font families — the Apple/Google model: ONE sans for all UI text + ONE mono
 *  for technical microcopy. No serif in the product UI (Apple keeps New York
 *  serif for editorial only; Material uses Roboto + Roboto Mono). Raw stacks
 *  live in shared.css :root; bound to role tokens here. `display` keeps its own
 *  token (a future editorial serif is a one-line swap) but points at the sans. */
export const FAMILIES = {
  display: { token: '--font-display', value: 'var(--sans)', note: 'sans — hero/stat/section titles (one-family model)' },
  body:    { token: '--font-body',    value: 'var(--sans)', note: 'sans — body, headings, UI' },
  mono:    { token: '--font-mono',    value: 'var(--mono)', note: 'mono — labels, codes, micro (technical only)' },
};

/**
 * @typedef {Object} TypeRole
 * @property {'display'|'body'|'mono'} family
 * @property {string} size      rem/px CSS value → --text-<role>
 * @property {number} px        documented rendered size (at 14px root)
 * @property {number} weight    → --weight-<role>
 * @property {number} leading   → --leading-<role>
 * @property {string} tracking  CSS letter-spacing → --tracking-<role> ('inherit' = skip)
 * @property {boolean} [uppercase]
 * @property {string} note
 */

/** THE roles — the whole type system. Order = catalog/emit order.
 *  @type {Record<string, TypeRole>} */
export const TYPE_ROLES = {
  display: { family: 'display', size: '2.75rem',   px: 44, weight: 600, leading: 1.05, tracking: '-0.02em', note: 'stat values, hero titles (sans, semibold for presence)' },
  h1:      { family: 'body',    size: '2.25rem',   px: 36, weight: 600, leading: 1.1,  tracking: '-0.005em', note: 'page title' },
  h2:      { family: 'body',    size: '1.375rem',  px: 22, weight: 600, leading: 1.2,  tracking: '-0.005em', note: 'section titles' },
  h3:      { family: 'body',    size: '1.125rem',  px: 18, weight: 600, leading: 1.3,  tracking: 'inherit',  note: 'card headings' },
  body:    { family: 'body',    size: '0.875rem',  px: 14, weight: 400, leading: 1.5,  tracking: '0',        note: 'base copy' },
  detail:  { family: 'body',    size: '0.8125rem', px: 13, weight: 400, leading: 1.5,  tracking: 'inherit',  note: 'secondary / table text' },
  caption: { family: 'body',    size: '0.8125rem', px: 13, weight: 400, leading: 1.5,  tracking: 'inherit',  note: 'sentence helper / hint copy' },
  label:   { family: 'mono',    size: '0.75rem',   px: 12, weight: 500, leading: 1.25, tracking: '0.12em', uppercase: true, note: 'uppercase mono labels' },
  micro:   { family: 'mono',    size: '0.6875rem', px: 11, weight: 500, leading: 1.25, tracking: 'inherit',  note: 'dense chips, nav, meta' },
};

/** General leading/tracking escape hatches (not role-bound). */
export const GENERAL = {
  leading: { tight: 1.1, snug: 1.25, base: 1.5 },
  tracking: { tight: '-0.015em' },
};
