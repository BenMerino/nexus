import React from 'react';
import { typography, type TypographyVariant, tokens, WEIGHT_MAP } from './tokens';
import './meta-chip.css';

export interface MetaChipProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: TypographyVariant;
    color?: keyof typeof tokens.colors.text | string;
    weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
    italic?: boolean;
    className?: string;
    children: React.ReactNode;
}

/** Floating-on-background metadata text wrapped in a glass chip with a
 *  feathered edge. Use anywhere a small piece of metadata renders directly
 *  on the page background (timestamps, attribution, status labels) without
 *  a card or panel surface around it. The chip's surface lives on a
 *  ::before pseudo via meta-chip.css — text inside stays sharp. */
export const MetaChip = React.forwardRef<HTMLSpanElement, MetaChipProps>(({
    variant = 'caption', color = 'muted', weight, italic, className, style, children, ...rest
}, ref) => {
    const typo = typography[variant] ?? {};
    const textColor = (tokens.colors.text as any)[color] ?? color;
    const composed: React.CSSProperties = {
        ...typo,
        color: textColor,
        ...(weight && { fontWeight: WEIGHT_MAP[weight] }),
        ...(italic && { fontStyle: 'italic' }),
        ...style,
    };
    return (
        <span
            ref={ref}
            className={`meta-chip${className ? ` ${className}` : ''}`}
            style={composed}
            {...rest}
        >
            {children}
        </span>
    );
});
