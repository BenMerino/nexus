import React from 'react';
import { tokens, SpacingToken, RadiusToken } from './tokens';

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

const sp = (key: SpacingToken | undefined) => key ? tokens.spacing[key] : undefined;

export type Density = 'tight' | 'normal' | 'loose';
const DENSITY: Record<Density, string> = {
  tight: 'var(--space-2)',
  normal: 'var(--space-4)',
  loose: 'var(--space-6)',
};

export const BaseBox = React.forwardRef<HTMLElement, BaseBoxProps>(({
  as: Component = 'div',
  display, direction, flexDirection: fdProp, justify, align, gap, density, pad,
  p, px, py, pt, pb, pl, pr, m, mx, my, mt, mb, ml, mr,
  bg, border, radius, itemRadius, surfaceRadius, nested, shadow, overflow, maxHeight, width, height, minWidth, minHeight,
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
    ...(nestR && nestPad && !nested && ({ '--_nest-r': nestR, '--_nest-pad': nestPad } as any)),
    ...(nested && { borderRadius: 'max(0px, calc(var(--_nest-r, 0px) - var(--_nest-pad, 0px) - 1px))' }),
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
