import { createContext, useContext } from 'react';
import type React from 'react';

export interface DropdownCtx {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  /** The trigger element, so Dropdown.Panel can anchor its Popover-portaled
   *  surface to it (trigger + panel are siblings under <Dropdown>, not nested). */
  triggerRef: React.RefObject<HTMLElement | null>;
}

export const DropdownContext = createContext<DropdownCtx | null>(null);

export function useDropdownContext() {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown subcomponents must be inside <Dropdown>');
  return ctx;
}
