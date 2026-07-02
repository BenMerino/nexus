import { BaseBox, Divider as BaseDivider } from '../primitives/index.js';
import React, { useState, useRef } from 'react';
import { DropdownContext } from './DropdownContext.js';
import { Trigger } from './DropdownTrigger.js';
import { Panel } from './DropdownPanel.js';
import { Item } from './DropdownItem.js';

interface DropdownProps {
  children: React.ReactNode; className?: string;
  /** Start open on mount (inline menus, DNA catalog which shows the OPENED
   *  composed). Default false — the normal click-to-open flow. */
  defaultOpen?: boolean;
}

function DropdownRoot({ children, className, defaultOpen = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  /* The trigger element ref — Dropdown.Panel anchors its Popover-portaled surface
   * to it. Outside-close is owned by that Popover now (not the root). */
  const triggerRef = useRef<HTMLElement>(null);

  return (
    <DropdownContext.Provider value={{ isOpen, toggle: () => setIsOpen(v => !v), close: () => setIsOpen(false), triggerRef }}>
      <BaseBox className={`relative ${className ?? ''}`}>{children}</BaseBox>
    </DropdownContext.Provider>
  );
}

/* Menu group break — the shared Divider with the menu's standard inset margin. */
const Divider = ({ className }: { className?: string }) => <BaseDivider inset className={className} />;

export const Dropdown = Object.assign(DropdownRoot, { Trigger, Panel, Item, Divider });
