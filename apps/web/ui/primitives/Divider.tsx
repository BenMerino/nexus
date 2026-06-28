import React from 'react';
import { BaseBox } from './BaseBox';

/* ── Divider ───────────────────────────────────────────────
 * The single home for a 1px rule. Replaces the inline
 * `borderTop: 1px solid var(--border-*)` hand-rolls scattered
 * across menus, panels, footers, and list groups so every
 * separator shares one tone + spacing treatment.
 *
 *   <Divider />                 // hairline, --border-main, no margin
 *   <Divider tone="subtle" />   // fainter rule
 *   <Divider inset />           // 4px block margin (menu group break)
 */

export interface DividerProps {
  /** Rule color. `main` (default) or `subtle`. */
  tone?: 'main' | 'subtle';
  /** Add a small symmetric block margin (menu group separation). */
  inset?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const TONE: Record<string, string> = {
  main: 'var(--border-main)',
  subtle: 'var(--border-subtle)',
};

export function Divider({ tone = 'main', inset = false, className, style }: DividerProps) {
  return (
    <BaseBox
      as="hr"
      role="separator"
      className={className}
      my={inset ? '1' : undefined}
      style={{ height: '1px', border: 'none', background: TONE[tone], ...style }}
    />
  );
}
