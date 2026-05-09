import React from 'react';

export function BaseText({ children, variant, weight, color, style, ...rest }: any) {
  const s: React.CSSProperties = {
    fontWeight: weight === 'semibold' ? 600 : undefined,
    color: color === 'muted' ? '#888' : undefined,
    ...style,
  };
  return <span style={s} {...rest}>{children}</span>;
}
