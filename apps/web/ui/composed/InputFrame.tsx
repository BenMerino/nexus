import React from 'react';
import { BaseBox } from '../primitives/index.js';
import './input-frame.css';

/* The shared input shell. Owns the border, radius, focus ring, padding and
 * disabled treatment for every input molecule so none of them redraw it. The
 * guts (a text input, a <select>, a swatch) go in `children`; affordances flank
 * them via `leading` / `trailing` (an icon, a chevron, a unit label). Focus is
 * pure CSS (:focus-within) — no JS focus state. */

export interface InputFrameProps {
    children: React.ReactNode;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    disabled?: boolean;
    className?: string;
    onClick?: () => void;
}

export function InputFrame({ children, leading, trailing, disabled, className = '', onClick }: InputFrameProps) {
    return (
        <BaseBox className={`input-frame ${className}`} data-disabled={disabled || undefined} onClick={onClick}>
            <BaseBox as="span" className="input-frame__body">
                {leading && <BaseBox as="span" className="input-frame__affordance">{leading}</BaseBox>}
                {children}
            </BaseBox>
            {trailing && <BaseBox as="span" className="input-frame__affordance">{trailing}</BaseBox>}
        </BaseBox>
    );
}
