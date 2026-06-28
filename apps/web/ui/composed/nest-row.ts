import type React from 'react';

/* Shared nest-row reads — the JS side of the `.nest-row` mechanism (theme.css).
 * The VALUES live in `.nest-row` CSS vars; this is the one place components read
 * them inline when a CSS class can't win (BaseText injects its variant fontSize
 * inline, so a title must pass the role inline to override it). */

/* A nest-row TITLE's typography (list option, search input, disclosure header):
 * one size + weight so titles stacked in a panel share a baseline. */
export const NEST_LABEL: React.CSSProperties = {
    fontSize: 'var(--nest-label-font)',
    fontWeight: 'var(--nest-label-weight)' as React.CSSProperties['fontWeight'],
};
