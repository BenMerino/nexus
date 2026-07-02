import React from 'react';
import { useDropdownContext } from './DropdownContext.js';

export interface TriggerProps {
  /** A single actionable element (typically a `BaseAction`). The trigger
   *  injects the open-toggle onClick + `aria-expanded`; chrome (variant,
   *  size, icon, label) belongs to the caller. */
  children: React.ReactElement;
}

/** Compound `Dropdown.Trigger`. Pure wiring — it does NOT render its own
 *  button chrome. Clones the child so the caller's `BaseAction` (or other
 *  actionable element) keeps its DNA-driven styling untouched. */
export function Trigger({ children }: TriggerProps) {
  const { isOpen, toggle, triggerRef } = useDropdownContext();
  const child = React.Children.only(children);
  const childOnClick = (child.props as { onClick?: (e: React.MouseEvent) => void }).onClick;
  return React.cloneElement(child, {
    // Anchor the panel's Popover-portaled surface to the real trigger element
    // (BaseAction forwards its ref to the underlying <button>).
    ref: triggerRef,
    onClick: (e: React.MouseEvent) => {
      childOnClick?.(e);
      toggle();
    },
    'aria-expanded': isOpen,
    'aria-haspopup': 'menu',
  } as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> });
}
