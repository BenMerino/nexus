// BaseBox — the layout primitive (Phase 2). A token-driven <div> that
// replaces the ad-hoc `style={{ display:'flex', gap:N, padding:N }}`
// patterns scattered through the graph/panel components. Props map to the
// Phase 1 scales in tokens.ts so spacing/radius/shadow stay on the system.
//
// Leaner than Zincro's BaseBox by design (Nexus is smaller): just the
// layout + surface props the inventory showed we actually use.

import React from 'react';
import { tokens, SpaceToken, RadiusToken, ColorToken } from './tokens';

type Justify = 'start' | 'center' | 'between' | 'end';
type Align = 'start' | 'center' | 'baseline' | 'stretch' | 'end';

export interface BaseBoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  flex?: boolean;
  grid?: boolean;
  direction?: 'row' | 'col';
  justify?: Justify;
  align?: Align;
  gap?: SpaceToken;
  p?: SpaceToken;
  px?: SpaceToken;
  py?: SpaceToken;
  bg?: ColorToken;
  border?: boolean;
  radius?: RadiusToken;
  shadow?: keyof typeof tokens.shadow;
  grow?: boolean;
}

const JUSTIFY: Record<Justify, string> = {
  start: 'flex-start', center: 'center', between: 'space-between', end: 'flex-end',
};
const ALIGN: Record<Align, string> = {
  start: 'flex-start', center: 'center', baseline: 'baseline', stretch: 'stretch', end: 'flex-end',
};

export function BaseBox({
  as: Component = 'div',
  flex, grid, direction, justify, align, gap, p, px, py,
  bg, border, radius, shadow, grow, style, children, ...rest
}: BaseBoxProps) {
  const s: React.CSSProperties = {
    ...(flex && { display: 'flex' }),
    ...(grid && { display: 'grid' }),
    ...(direction === 'col' && { flexDirection: 'column' }),
    ...(justify && { justifyContent: JUSTIFY[justify] }),
    ...(align && { alignItems: ALIGN[align] }),
    ...(gap !== undefined && { gap: tokens.space[gap] }),
    ...(p !== undefined && { padding: tokens.space[p] }),
    ...(px !== undefined && { paddingLeft: tokens.space[px], paddingRight: tokens.space[px] }),
    ...(py !== undefined && { paddingTop: tokens.space[py], paddingBottom: tokens.space[py] }),
    ...(bg && { background: tokens.color[bg] }),
    ...(border && { border: `1px solid ${tokens.color.border}` }),
    ...(radius && { borderRadius: tokens.radius[radius] }),
    ...(shadow && { boxShadow: tokens.shadow[shadow] }),
    ...(grow && { flex: '1 1 auto' }),
    ...style,
  };
  return <Component style={s} {...rest}>{children}</Component>;
}
