import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from '../icons/index.js';
import './base-action.css';

/* Solid status weight (HIGH emphasis): 'danger' / 'warning' — filled.
 * Soft status weight (LOW emphasis): '*-soft' — outlined in the status tone,
 * fills on hover. One treatment parameterized over the four status tones; the
 * sibling of the solid weight. (Replaced the bespoke DangerPill molecule.) */
export type ButtonVariant =
  | 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline'
  | 'danger-soft' | 'warning-soft' | 'success-soft' | 'info-soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BaseActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Render as a square icon-only button (rounded-full chrome, equal padding).
   *  When omitted, inferred from the absence of children. Set explicitly when
   *  the child IS the icon (e.g. `<BaseAction iconOnly><Icon /></BaseAction>`)
   *  so the layout treats it as an icon button rather than a text button. */
  iconOnly?: boolean;
}

/* `size` is the SAME mechanism as a controlSize cluster — it publishes the
 * tier's --_ctl-* row locally, so the button's own font/gap/icon track the one
 * control table (BaseBox CONTROL_SIZE) instead of a parallel per-size map. An
 * UNSIZED button (no wrapper, default md) inherits the :root --_ctl-* defaults.
 * Mirrors the controlSize rows exactly; gap is the per-tier icon-to-text space. */
const SIZE_VARS: Record<ButtonSize, React.CSSProperties> = {
  sm: { '--_ctl-h': 'var(--space-8)',  '--_ctl-px': 'var(--space-3)', '--_ctl-pad-block': '0px', '--_ctl-font': 'var(--text-detail)',  '--_ctl-icon': 'var(--icon-control-sm)', gap: 'var(--space-1-5)' } as React.CSSProperties,
  md: { '--_ctl-h': 'var(--space-10)', '--_ctl-px': 'var(--space-4)', '--_ctl-pad-block': '0px', '--_ctl-font': 'var(--text-control)', '--_ctl-icon': 'var(--icon-control-md)', gap: 'var(--space-2)' } as React.CSSProperties,
  lg: { '--_ctl-h': 'var(--space-12)', '--_ctl-px': 'var(--space-6)', '--_ctl-pad-block': '0px', '--_ctl-font': 'var(--text-body)',    '--_ctl-icon': 'var(--icon-control-lg)', gap: 'var(--space-2)' } as React.CSSProperties,
};

/* Padding moved to CSS classes — see base-action.css. Per-size +
 * per-variant rules let ancestor selectors override via specificity
 * without !important. */

/* Soft status weights carry a real outline, so they share the bordered
 * footprint accounting (--_ctl-border box) — same as secondary/outline. */
const BORDERED_VARIANTS = new Set<ButtonVariant>([
  'secondary', 'outline', 'danger-soft', 'warning-soft', 'success-soft', 'info-soft',
]);

export const BaseAction = React.forwardRef<HTMLButtonElement, BaseActionProps>(({
  variant = 'ghost', size = 'md', loading = false, fullWidth = false,
  leftIcon, rightIcon, iconOnly: iconOnlyProp, children, className, disabled, style, ...props
}, ref) => {
  const isDisabled = disabled || loading;
  const iconOnly = iconOnlyProp ?? !children;
  const hasBorder = BORDERED_VARIANTS.has(variant);

  return (
    <button
      ref={ref} disabled={isDisabled} {...props}
      className={clsx(
        'base-action',
        `base-action--${variant}`,
        `base-action--${size}`,
        iconOnly && 'base-action--icon-only',
        hasBorder && 'base-action--has-border',
        fullWidth && 'base-action--full',
        className
      )}
      style={{ ...SIZE_VARS[size], ...style }}
    >
      {loading
        ? <Loader2 className="action-spinner" />
        : leftIcon && <span className="action-icon">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="action-icon">{rightIcon}</span>}
    </button>
  );
});
