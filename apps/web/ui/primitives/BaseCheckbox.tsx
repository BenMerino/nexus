import React, { useRef, useImperativeHandle, useEffect } from 'react';
import './base-checkbox.css';

/* ── BaseCheckbox ──────────────────────────────────────────
 * THE one checkbox — a squared box with rounded edges and a CSS-drawn
 * check. A native <input type="checkbox"> under a styled skin, so it gets
 * keyboard toggle (space), focus ring, and the `indeterminate` tri-state
 * for free. First lived as `.dt-checkbox` inside DataTable; lifted here so
 * the multi-select list (and any future selectable surface) shares ONE box
 * instead of hand-rolling its own.
 *
 * Controlled: pass `checked` + `onChange`. `indeterminate` is a DOM property
 * (not an attribute), so it's applied to the node via ref. `size` defaults to
 * the table box (--space-4); a host can shrink it (e.g. a list row passes
 * --nest-lead) without restyling. */

export interface BaseCheckboxProps {
  checked: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Tri-state visual (a dash, not a check) — for "some on this page" headers. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Box edge length. Defaults to the table size (--space-4). */
  size?: string;
  /** Pure visual — the HOST owns the toggle (e.g. a ListItem button row). The
   *  box renders read-only, claims no focus, and ignores pointer events so the
   *  row's own click drives it. No nested-interactive / invalid-HTML hazard. */
  presentational?: boolean;
  'aria-label'?: string;
  className?: string;
}

export const BaseCheckbox = React.forwardRef<HTMLInputElement, BaseCheckboxProps>(
  function BaseCheckbox({ checked, onChange, indeterminate = false, disabled, size, presentational, 'aria-label': ariaLabel, className }, ref) {
    const localRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => localRef.current!, []);
    useEffect(() => { if (localRef.current) localRef.current.indeterminate = indeterminate; }, [indeterminate]);
    return (
      <input
        ref={localRef}
        type="checkbox"
        checked={checked}
        onChange={onChange ?? (() => {})}
        disabled={disabled}
        aria-hidden={presentational || undefined}
        tabIndex={presentational ? -1 : undefined}
        aria-label={ariaLabel}
        className={`base-checkbox${presentational ? ' base-checkbox--presentational' : ''} ${className ?? ''}`}
        style={size ? { width: size, height: size } : undefined}
      />
    );
  }
);
