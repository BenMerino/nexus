import React from 'react';
import type { IconProps } from '../icons/index.js';

/* ── BaseIcon ──────────────────────────────────────────────
 * The single home for a glyph's SIZE and COLOR. Stops every call
 * site from spelling out `width: 14, height: 14` + an inline color
 * — the drift that makes the same glyph look different row to row.
 *
 * Size: defaults to `var(--_ctl-icon)` so a glyph dropped inside any
 * control / ListItem inherits that control's icon size by construction
 * (the same cascade BaseAction/BaseBox publish). Pass a `size` tier only
 * for standalone glyphs outside a control context.
 *
 * Color: defaults to `currentColor` so the glyph takes the row's text
 * color (muted at rest, main on hover, red in a danger row) — consistent
 * for free. Pass `color` only when a glyph must diverge (a primary check).
 *
 * Usage:
 *   <BaseIcon icon={User} />                     // inherits control size + color
 *   <BaseIcon icon={Check} color="var(--primary)" size="sm" />
 */

/** Maps onto the existing icon-size token cascade (dna-defaults.css). The
 *  control tiers (xs/sm/md) ride --icon-control-*; the larger standalone tiers
 *  ride the spacing scale (lg) and the icon-box token (xl). */
const SIZE_TOKEN: Record<string, string> = {
  xs: 'var(--icon-control-sm)',   // 0.75rem  / 12px — dense glyphs
  sm: 'var(--icon-control-md)',   // 0.875rem / 14px — list/control default
  md: 'var(--icon-control-lg)',   // 0.9375rem/ 15px — nearest tier to 16/18px
  lg: 'var(--space-5)',           // 1.25rem  / 20px — standalone glyphs (was size 20/24)
  xl: 'var(--icon-box-size)',     // 3rem     / 48px — empty-state / thumbnail glyphs
};

export interface BaseIconProps {
  /** Lucide icon component, e.g. `icon={User}`. */
  icon: React.ComponentType<IconProps>;
  /** Size tier. Omit to inherit the surrounding control's `--_ctl-icon`. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Glyph color. Defaults to `currentColor` (inherits row text color). */
  color?: string;
  className?: string;
  'aria-hidden'?: boolean;
  style?: React.CSSProperties;
  /** Standard SVG handlers/attrs (onClick, onMouseEnter, …) pass through to the
   *  glyph — e.g. a clickable trailing chevron. Width/height stay owned here. */
  onClick?: React.MouseEventHandler<SVGSVGElement>;
  onMouseEnter?: React.MouseEventHandler<SVGSVGElement>;
  onMouseLeave?: React.MouseEventHandler<SVGSVGElement>;
}

export function BaseIcon({ icon: Icon, size, color, className, style, ...rest }: BaseIconProps) {
  const dim = size ? SIZE_TOKEN[size] : 'var(--_ctl-icon, var(--icon-control-md))';
  return (
    <Icon
      className={className}
      aria-hidden
      style={{ width: dim, height: dim, color: color ?? 'currentColor', flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
