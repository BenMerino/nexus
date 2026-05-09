import React from 'react';

export const BaseBox = React.forwardRef<HTMLDivElement, any>(
  ({ children, direction, gap, px, py, surfaceRadius, shadow, style, ...rest }, ref) => {
    const s: React.CSSProperties = {
      display: direction === 'row' ? 'flex' : undefined,
      flexDirection: direction === 'row' ? 'row' : undefined,
      gap: gap ? `${Number(gap) * 0.25}rem` : undefined,
      ...style,
    };
    return <div ref={ref} style={s} {...rest}>{children}</div>;
  }
);
