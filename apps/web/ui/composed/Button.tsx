import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from '../icons/index.js';
import { BaseAction } from '../primitives/BaseAction.js';
import { BaseText } from '../primitives/BaseText.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 15 };

export function Button({
    variant = 'primary', size = 'md', loading = false, fullWidth = false,
    leftIcon, rightIcon, children, className, disabled, style, ...props
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const primaryStyle: React.CSSProperties = variant === 'primary'
        ? { background: 'linear-gradient(135deg, var(--primary, #4f46e5), var(--secondary, #10b981))' }
        : {};

    return (
        <BaseAction
            variant={variant}
            size={size}
            disabled={isDisabled}
            fullWidth={fullWidth}
            style={{ ...primaryStyle, ...style }}
            className={className}
            {...props}
        >
            {loading ? <Loader2 size={ICON_SIZE[size]} className="animate-spin shrink-0" /> : leftIcon && <BaseText as="span" style={{ flexShrink: 0 }}>{leftIcon}</BaseText>}
            {children}
            {!loading && rightIcon && <BaseText as="span" style={{ flexShrink: 0 }}>{rightIcon}</BaseText>}
        </BaseAction>
    );
}

export default Button;
