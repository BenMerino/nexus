import React from 'react';
import { ChevronUp, ChevronDown } from '../icons/index.js';
import { BaseBox, BaseIcon } from '../primitives/index.js';
import { InputFrame } from './InputFrame.js';

/* Sibling of TimePicker for durations/counts (20 min, 60 days) rather than clock
 * times. Shares the InputFrame shell; its guts are a right-aligned number input,
 * with our own design-system steppers + the unit (min / hrs / days) in the
 * trailing slot — no native spinner chrome (that read as a second box). Controlled
 * string value so callers keep ownership of parse/clamp; empty string = unset. */

export interface NumberFieldProps {
    value: string;
    onChange: (value: string) => void;
    unit?: string;
    icon?: React.ReactNode;
    placeholder?: string;
    min?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
}

export function NumberField({ value, onChange, unit, icon, placeholder, min, step = 1, disabled, className }: NumberFieldProps) {
    const bump = (dir: 1 | -1) => {
        const base = value.trim() === '' ? (min ?? 0) : (parseFloat(value) || 0);
        let next = base + dir * step;
        if (min != null && next < min) next = min;
        onChange(String(next));
    };

    return (
        <InputFrame
            leading={icon}
            disabled={disabled}
            className={className}
            trailing={
                <BaseBox display="flex" align="center" density="tight">
                    <BaseBox className="number-field__steppers">
                        <BaseBox as="button" type="button" tabIndex={-1} disabled={disabled} className="number-field__step" onClick={() => bump(1)} aria-label="Increase">
                            <BaseIcon icon={ChevronUp} />
                        </BaseBox>
                        <BaseBox as="button" type="button" tabIndex={-1} disabled={disabled} className="number-field__step" onClick={() => bump(-1)} aria-label="Decrease">
                            <BaseIcon icon={ChevronDown} />
                        </BaseBox>
                    </BaseBox>
                    {unit}
                </BaseBox>
            }
        >
            <BaseBox
                as="input" type="number" inputMode="numeric" min={min} step={step} value={value}
                placeholder={placeholder} disabled={disabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                className="input-frame__input" textAlign="right"
            />
        </InputFrame>
    );
}
