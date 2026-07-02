import React, { useContext } from 'react';
import { DropdownContext } from './DropdownContext.js';
import { ListItem, type ListItemVariant } from './ListItem.js';

export interface ItemProps {
  children: React.ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void; closeOnClick?: boolean; className?: string;
  /** Semantic variant. `danger` reddens the WHOLE row — label + glyph (the glyph
   *  inherits `currentColor`). Declare danger HERE, never by hand-coloring the
   *  glyph, so the item's meaning owns its color. */
  variant?: ListItemVariant;
  /** Leading glyph — goes through ListItem's icon slot so it sits BESIDE the
   *  label (the global `svg { display: block }` reset would stack a glyph placed
   *  inline in `children` onto its own line). Pass a plain <BaseIcon icon={X} />
   *  with NO color — it inherits the row's text color. */
  leftIcon?: React.ReactNode;
  /** Trailing accessory — checkmark, chevron, badge. */
  rightAccessory?: React.ReactNode;
}

export function Item({ children, active, disabled, onClick, closeOnClick = true, className, variant, leftIcon, rightAccessory }: ItemProps) {
  const ctx = useContext(DropdownContext);
  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    if (closeOnClick) ctx?.close();
  };

  return (
    <ListItem as="button" onClick={handleClick} active={active} disabled={disabled} variant={variant} className={className}
      leftIcon={leftIcon} rightAccessory={rightAccessory}>
      {children}
    </ListItem>
  );
}
