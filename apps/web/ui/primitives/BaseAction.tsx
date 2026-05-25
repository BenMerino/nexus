import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import './base-action.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
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

/* borderRadius moved to CSS classes (.base-action--sm/md/lg) so
 * parent rules can override naturally via specificity. Inline style
 * here would block ancestor styling and force !important hacks. */
const SIZE_STYLE: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: 'var(--text-detail)', gap: 'var(--space-1-5)' },
  md: { fontSize: 'var(--text-body)', gap: 'var(--space-2)' },
  lg: { fontSize: 'var(--text-body)', gap: 'var(--space-2)' },
};

/* Padding moved to CSS classes — see base-action.css. Per-size +
 * per-variant rules let ancestor selectors override via specificity
 * without !important. */

const BORDERED_VARIANTS = new Set<ButtonVariant>(['secondary', 'outline']);

const ICON_SIZE: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 15 };

export const BaseAction = React.forwardRef<HTMLButtonElement, BaseActionProps>(({
  variant = 'ghost', size = 'md', loading = false, fullWidth = false,
  leftIcon, rightIcon, iconOnly: iconOnlyProp, children, className, disabled, style, ...props
}, ref) => {
  const isDisabled = disabled || loading;
  const iconOnly = iconOnlyProp ?? !children;
  const primaryBg = variant === 'primary'
    ? { background: 'linear-gradient(135deg, var(--primary, #4f46e5), var(--secondary, #10b981))' }
    : {};
  const hasBorder = BORDERED_VARIANTS.has(variant);
  const sizeStyle = SIZE_STYLE[size];

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
      style={{ ...sizeStyle, ...primaryBg, ...style }}
    >
      {loading
        ? <Loader2 size={ICON_SIZE[size]} className="action-spinner" />
        : leftIcon && <span className="action-icon">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="action-icon">{rightIcon}</span>}
    </button>
  );
});
