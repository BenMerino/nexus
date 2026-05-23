// BaseText — the typography primitive (Phase 2). Maps the Phase 1 type
// scale (--text-*, --leading-*, --tracking-*) and font families onto a
// text element, so the ad-hoc `fontSize: 13, fontFamily: 'var(--mono)'`
// inline patterns become `<BaseText variant="detail" font="mono">`.
//
// Variants mirror the de-facto roles already in shared.css: display/serif
// titles, section headings, body, and the uppercase mono labels.

import React from 'react';
import { tokens, ColorToken } from './tokens';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'detail' | 'label';
type Font = 'display' | 'sans' | 'mono';

export interface BaseTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  variant?: Variant;
  font?: Font;
  color?: ColorToken;
  weight?: number;
  uppercase?: boolean;
}

// Per-variant defaults: size + leading + tracking + the natural font/weight,
// matching how shared.css styles each role today.
const VARIANT: Record<Variant, React.CSSProperties> = {
  display: { fontSize: tokens.text.display, fontFamily: tokens.font.display, fontWeight: 400, lineHeight: 'var(--leading-tight)', letterSpacing: 'var(--tracking-tight)' },
  h1:      { fontSize: tokens.text.h1, fontFamily: tokens.font.display, fontWeight: 400, lineHeight: 'var(--leading-tight)', letterSpacing: 'var(--tracking-tight)' },
  h2:      { fontSize: tokens.text.h2, fontFamily: tokens.font.display, fontWeight: 400, lineHeight: 'var(--leading-snug)' },
  h3:      { fontSize: tokens.text.h3, fontFamily: tokens.font.display, fontWeight: 400, lineHeight: 'var(--leading-snug)' },
  body:    { fontSize: tokens.text.body, fontFamily: tokens.font.sans, lineHeight: 'var(--leading-base)' },
  detail:  { fontSize: tokens.text.detail, fontFamily: tokens.font.sans, lineHeight: 'var(--leading-base)' },
  label:   { fontSize: tokens.text.label, fontFamily: tokens.font.mono, textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)' },
};

export function BaseText({
  as: Component = 'span',
  variant = 'body', font, color, weight, uppercase, style, children, ...rest
}: BaseTextProps) {
  const s: React.CSSProperties = {
    ...VARIANT[variant],
    ...(font && { fontFamily: tokens.font[font] }),
    ...(color && { color: tokens.color[color] }),
    ...(weight !== undefined && { fontWeight: weight }),
    ...(uppercase && { textTransform: 'uppercase' }),
    ...style,
  };
  return <Component style={s} {...rest}>{children}</Component>;
}
