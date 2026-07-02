import React, { useContext } from 'react';
import { DropdownContext } from './DropdownContext.js';
import { Popover } from './Popover.js';

export interface PanelProps {
  children: React.ReactNode; className?: string; align?: 'left' | 'right'; width?: string; open?: boolean; onClose?: () => void;
}

/* Dropdown.Panel renders through the ONE popover engine — <Popover> owns the glass
 * surface + the glassReveal animation + portal placement + outside-close, anchored
 * to the trigger element (triggerRef from context). This panel adds NO glass of its
 * own (that was the duplicated engine) and NO padding — the .nest-row items inside
 * self-inset on all four sides via --row-inset, so the row margin is the one
 * authority for the gutter (a panel padding here would double-count it). */
export function Panel({ children, className, align = 'left', width, open, onClose }: PanelProps) {
  const ctx = useContext(DropdownContext);
  const isOpen = open !== undefined ? open : ctx?.isOpen ?? false;
  const close = () => { ctx?.close(); onClose?.(); };

  return (
    <Popover
      triggerRef={ctx?.triggerRef}
      open={isOpen}
      onOpenChange={(next) => { if (!next) close(); }}
      align={align}
      panelClassName={className}
      // Items force their own intrinsic width (whiteSpace:nowrap), so default to
      // max-content; caller overrides via `width` for fixed-size menus.
      panelStyle={{ width: width ?? 'max-content', overflow: 'hidden' }}
    >
      {() => children}
    </Popover>
  );
}
