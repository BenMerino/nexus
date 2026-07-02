import React from 'react';
import { Check } from '../icons/index.js';
import { BaseAction } from '../primitives/index.js';

export interface ColorSwatchItemProps {
  /** Hex color this swatch represents, e.g. "#f59e0b". */
  color: string;
  /** Whether this swatch is the current selection (draws the ring + check). */
  selected: boolean;
  onSelect: (color: string) => void;
}

/* One selectable color swatch in a palette row. A real button (BaseAction,
 * ghost) — keyboard + focus + role come for free — whose face is the hatched
 * color fill. The selection ring is a 2px border in the foreground tone; the
 * check sits in the swatch color so it reads on its own tile. Replaces the
 * hand-rolled `<BaseBox onClick>` swatch duplicated across the calendar block
 * editors. */
export function ColorSwatchItem({ color, selected, onSelect }: ColorSwatchItemProps) {
  return (
    <BaseAction
      variant="ghost"
      iconOnly
      onClick={() => onSelect(color)}
      style={{
        width: 'var(--space-6)',
        height: 'var(--space-6)',
        minHeight: 'var(--space-6)',
        padding: 0,
        borderRadius: 'var(--radius-sm)',
        background: `repeating-linear-gradient(45deg, white, white 6px, ${color} 6px, ${color} 12px)`,
        border: `2px solid ${selected ? 'var(--text-main)' : 'transparent'}`,
        transition: 'border-color 0.1s',
      }}
    >
      {selected && <Check size={12} style={{ color }} />}
    </BaseAction>
  );
}
