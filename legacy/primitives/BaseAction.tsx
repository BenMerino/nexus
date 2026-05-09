import React from 'react';

export function BaseAction({ children, onClick, style, ...rest }: any) {
  return <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', ...style }} {...rest}>{children}</button>;
}
