import React from 'react';
import { tokens, sp, SpacingToken, RadiusToken } from './tokens';

export interface BaseBoxProps extends Omit<React.AllHTMLAttributes<HTMLElement>, 'as'> {
  as?: React.ElementType;
  display?: 'flex' | 'grid' | 'block' | 'inline-flex' | 'none';
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  flexDirection?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  justify?: 'start' | 'center' | 'between' | 'end' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'baseline' | 'stretch' | 'end';
  gap?: SpacingToken;
  density?: Density;
  pad?: Density;
  p?: SpacingToken; px?: SpacingToken; py?: SpacingToken; pt?: SpacingToken; pb?: SpacingToken; pl?: SpacingToken; pr?: SpacingToken;
  m?: SpacingToken; mx?: SpacingToken; my?: SpacingToken; mt?: SpacingToken; mb?: SpacingToken; ml?: SpacingToken; mr?: SpacingToken;
  bg?: string; border?: string; radius?: RadiusToken; itemRadius?: 'sm' | 'md' | 'lg'; surfaceRadius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Concentric auto-nesting: derive border-radius from the nearest radius+pad
   *  ancestor (parent − pad − border). For a box that sits flush inside a
   *  rounded, uniformly-padded parent. Uniform-pad, direct-child, 1 level. */
  nested?: boolean;
  /** Control-size cascade: publish a uniform height/padding/font for the
   *  controls (buttons, toggles, tiles) hosted inside, so they all conform
   *  by construction. The sizing twin of `nested` (radius). Set on the
   *  cluster wrapper; hosted controls derive from it. */
  controlSize?: ControlSize;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  width?: string; height?: string; minWidth?: string; minHeight?: string; maxHeight?: string;
  flex?: string; shrink?: string;
  textAlign?: 'left' | 'center' | 'right';
  className?: string;
  children?: React.ReactNode;
  layout?: boolean | string;
  transition?: any;
  [key: string]: any;
}

const flexMap: Record<string, string> = {
  start: 'flex-start', center: 'center', between: 'space-between',
  around: 'space-around', evenly: 'space-evenly', end: 'flex-end',
  baseline: 'baseline', stretch: 'stretch',
};

const sizeMap: Record<string, string> = {
  full: '100%', screen: '100vw', 'screen-80': '80vh',
};

const dirMap: Record<string, string> = {
  row: 'row', col: 'column', 'row-reverse': 'row-reverse', 'col-reverse': 'column-reverse',
};

export type Density = 'tight' | 'normal' | 'loose' | 'row';
const DENSITY: Record<Density, string> = {
  tight: 'var(--space-2)',
  normal: 'var(--space-4)',
  loose: 'var(--space-6)',
  // The list-row gutter (= --space-1), now a first-class pad tier. Makes the
  // concentric-inset cascade reachable by prop, so a surface hosting rows/cells
  // publishes the --_nest-* triple via `radius + pad="row"` instead of hand-
  // rolling it inline (the loose horse 3 surfaces re-derived).
  row: 'var(--row-inset)',
};

/* Control-size cascade — the sizing twin of the concentric-radius
 * cascade (--_nest-*). A box with `controlSize` publishes the height,
 * paddings, and font role for the controls it hosts as inherited CSS
 * vars; every nested button/toggle/tile reads them and resolves to the
 * SAME geometry by construction. Declare once on the cluster; children
 * conform — no per-control height. Height is published explicitly (not
 * a literal at the call site) so it tracks the chosen tier, and every
 * control uses `height: var(--_ctl-h)` + box-sizing:border-box so they
 * are equal regardless of icon/text content. */
/* THE control sizing table — the single source for every control's geometry at
 * each tier. A `controlSize` cluster publishes the WHOLE row as --_ctl-* vars;
 * children read only those (height, padding-x, font-size, font-weight, border,
 * radius, icon). Nothing a control needs to size itself lives outside this row,
 * so two controls in one cluster cannot drift. The :root defaults in theme.css
 * mirror the `md` row, so an UNWRAPPED control matches a wrapped-md one. */
export type ControlSize = 'sm' | 'md' | 'lg';
const CONTROL_SIZE: Record<ControlSize, { h: string; px: string; font: string; weight: string; icon: string; border: string; radius: string }> = {
  sm: { h: 'var(--space-8)',  px: 'var(--space-3)', font: 'var(--text-detail)', weight: 'var(--weight-control)', icon: 'var(--icon-control-sm)', border: '1px', radius: 'var(--radius-control)' },
  md: { h: 'var(--space-10)', px: 'var(--space-4)', font: 'var(--text-control)', weight: 'var(--weight-control)', icon: 'var(--icon-control-md)', border: '1px', radius: 'var(--radius-control)' },
  lg: { h: 'var(--space-12)', px: 'var(--space-5)', font: 'var(--text-body)',   weight: 'var(--weight-control)', icon: 'var(--icon-control-lg)', border: '1px', radius: 'var(--radius-control)' },
};

export const BaseBox = React.forwardRef<HTMLElement, BaseBoxProps>(({
  as: Component = 'div',
  display, direction, flexDirection: fdProp, justify, align, gap, density, pad,
  p, px, py, pt, pb, pl, pr, m, mx, my, mt, mb, ml, mr,
  bg, border, radius, itemRadius, surfaceRadius, nested, controlSize, shadow, overflow, maxHeight, width, height, minWidth, minHeight,
  flex, shrink, textAlign, style, className, children, ...props
}, ref) => {
  const fd = fdProp || direction;
  /* Concentric nesting: a box with a radius + uniform pad publishes both as
   * inherited CSS vars; a `nested` child derives its own corner from the
   * nearest such ancestor (parent − pad − border, clamped at 0). 1-level. */
  const nestR = radius ? tokens.radii[radius] : itemRadius ? tokens.itemRadii[itemRadius] : surfaceRadius ? tokens.surfaceRadii[surfaceRadius] : undefined;
  const nestPad = (pad && !p) ? DENSITY[pad] : p ? sp(p) : undefined;
  const s: React.CSSProperties = {
    ...(display && { display }), ...(fd && { flexDirection: dirMap[fd] as any }),
    ...(justify && { justifyContent: flexMap[justify] }),
    ...(align && { alignItems: flexMap[align] }),
    ...(gap && { gap: sp(gap) }),
    ...(density && !gap && { gap: DENSITY[density] }),
    ...(pad && !p && { padding: DENSITY[pad] }),
    ...(p && { padding: sp(p) }),
    ...(px && { paddingLeft: sp(px), paddingRight: sp(px) }),
    ...(py && { paddingTop: sp(py), paddingBottom: sp(py) }),
    ...(pt && { paddingTop: sp(pt) }), ...(pb && { paddingBottom: sp(pb) }),
    ...(pl && { paddingLeft: sp(pl) }), ...(pr && { paddingRight: sp(pr) }),
    ...(m && { margin: sp(m) }),
    ...(mx && { marginLeft: sp(mx), marginRight: sp(mx) }),
    ...(my && { marginTop: sp(my), marginBottom: sp(my) }),
    ...(mt && { marginTop: sp(mt) }), ...(mb && { marginBottom: sp(mb) }),
    ...(ml && { marginLeft: sp(ml) }), ...(mr && { marginRight: sp(mr) }),
    ...(bg && { backgroundColor: bg }),
    ...(border && { border: border.includes(' ') ? border : `1px solid ${border}` }),
    ...(radius && { borderRadius: tokens.radii[radius] }),
    ...(itemRadius && { borderRadius: tokens.itemRadii[itemRadius] }),
    ...(surfaceRadius && { borderRadius: tokens.surfaceRadii[surfaceRadius] }),
    /* A surface that opts into the nesting contract publishes the concentric
     * CORNER too (radius − pad − border), so nested CONTROLS (BaseAction, inputs)
     * read it via var(--_nest-corner, --_ctl-radius) and curve PARALLEL to the
     * surface — the same by-construction concentricity ListItem (.nest-row) gets.
     * Surfaces that don't publish --_nest-r leave it unset → controls stay flat. */
    ...(nestR && nestPad && !nested && ({
      '--_nest-r': nestR, '--_nest-pad': nestPad,
      '--_nest-corner': `max(0px, calc(${nestR} - ${nestPad} - 1px))`,
    } as any)),
    ...(nested && { borderRadius: 'max(0px, calc(var(--_nest-r, 0px) - var(--_nest-pad, 0px) - 1px))' }),
    ...(controlSize && ({
      '--_ctl-h': CONTROL_SIZE[controlSize].h,
      '--_ctl-px': CONTROL_SIZE[controlSize].px,
      '--_ctl-font': CONTROL_SIZE[controlSize].font,
      '--_ctl-weight': CONTROL_SIZE[controlSize].weight,
      '--_ctl-icon': CONTROL_SIZE[controlSize].icon,
      '--_ctl-border': CONTROL_SIZE[controlSize].border,
      '--_ctl-radius': CONTROL_SIZE[controlSize].radius,
      /* Hosted controls have a fixed height; vertical padding collapses
       * to 0 and flex-centering positions the content. */
      '--_ctl-pad-block': '0px',
    } as any)),
    ...(shadow && shadow !== 'none' && { boxShadow: tokens.shadows[shadow] }),
    ...(overflow && { overflow }), ...(textAlign && { textAlign }),
    ...(width && { width: sizeMap[width] || width }),
    ...(height && { height: sizeMap[height] || height }),
    ...(minWidth && { minWidth: sizeMap[minWidth] || minWidth }),
    ...(minHeight && { minHeight: sizeMap[minHeight] || minHeight }),
    ...(maxHeight && { maxHeight: sizeMap[maxHeight] || maxHeight }),
    ...(flex && { flex }), ...(shrink && { flexShrink: Number(shrink) }),
    ...style,
  };

  return <Component ref={ref} className={className} style={s} {...props}>{children}</Component>;
});
