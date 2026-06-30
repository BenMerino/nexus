import React, { createContext, useContext } from 'react';
import { tokens, sp, WEIGHT_MAP, SpacingToken, typography, TypographyVariant } from './tokens';

const VARIANT_ELEMENT: Record<string, React.ElementType> = {
  display: 'h1', h1: 'h2', h2: 'h3', h3: 'h4', body: 'p', detail: 'span', caption: 'span', label: 'span', micro: 'span',
};

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const TextNestCtx = createContext<string | null>(null);

export interface BaseTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  variant?: TypographyVariant;
  color?: keyof typeof tokens.colors.text | string;
  align?: 'left' | 'center' | 'right' | 'justify';
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  underline?: boolean; strike?: boolean; truncate?: boolean;
  className?: string; children: React.ReactNode;
  textAlign?: 'left' | 'center' | 'right';
  m?: SpacingToken; mx?: SpacingToken; my?: SpacingToken;
  mt?: SpacingToken; mb?: SpacingToken; ml?: SpacingToken; mr?: SpacingToken;
  [key: string]: any;
}

export const BaseText = React.forwardRef<HTMLElement, BaseTextProps>(({
  as, variant = 'body', color = 'body',
  align, weight, underline, strike, truncate, className, children,
  m, mx, my, mt, mb, ml, mr, style, ...props
}, ref) => {
  const parentTag = useContext(TextNestCtx);
  let Component = as ?? VARIANT_ELEMENT[variant] ?? 'span';
  const resolvedTag = typeof Component === 'string' ? Component : null;

  if (parentTag && resolvedTag && BLOCK_TAGS.has(resolvedTag)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[BaseText] <${resolvedTag}> nested inside <${parentTag}> is invalid HTML. ` +
        `Auto-correcting to <span>. Fix: add as="span" or use variant="detail".`
      );
    }
    Component = 'span';
  }

  const textColor = (tokens.colors.text as any)[color] ?? color;
  const typo = typography[variant] ?? {};
  const s: React.CSSProperties = {
    ...typo,
    ...(textColor && { color: textColor }),
    ...(weight && { fontWeight: WEIGHT_MAP[weight] }),
    ...(align && { textAlign: align }),
    ...(underline && { textDecoration: 'underline' }),
    ...(strike && { textDecoration: 'line-through' }),
    ...(truncate && { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
    ...(m && { margin: sp(m) }),
    ...(mx && { marginLeft: sp(mx), marginRight: sp(mx) }),
    ...(my && { marginTop: sp(my), marginBottom: sp(my) }),
    ...(mt && { marginTop: sp(mt) }), ...(mb && { marginBottom: sp(mb) }),
    ...(ml && { marginLeft: sp(ml) }), ...(mr && { marginRight: sp(mr) }),
    ...style,
  };

  const isBlock = typeof Component === 'string' && BLOCK_TAGS.has(Component);
  const el = <Component ref={ref} className={className} style={s} {...props}>{children}</Component>;
  return isBlock ? <TextNestCtx.Provider value={Component}>{el}</TextNestCtx.Provider> : el;
});
