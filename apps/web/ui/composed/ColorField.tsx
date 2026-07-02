import React from 'react';
import { BaseBox, BaseText } from '../primitives/index.js';
import { InputFrame } from './InputFrame.js';
import './color-field.css';

export interface ColorFieldProps {
  label: string;
  /** Hex value, e.g. "#1a73e8". */
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Normalize free-typed hex toward "#rrggbb"; leave partial input untouched
 *  so the field stays editable mid-type. */
function normalizeHex(raw: string): string {
  const v = raw.trim();
  const body = v.startsWith('#') ? v.slice(1) : v;
  return '#' + body.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
}

/** A color swatch (native picker) paired with a hex text input. Shares the
 *  InputFrame shell with the rest of the input family; the swatch is the
 *  leading affordance, the hex input is the guts. Controlled via value/onChange:
 *  the swatch always emits a full "#rrggbb"; the text input normalizes on change. */
export function ColorField({ label, value, onChange, disabled = false, className }: ColorFieldProps) {
  return (
    <BaseBox display="flex" flexDirection="col" gap="1" className={className}>
      <BaseText variant="label" color="detail">{label}</BaseText>
      <InputFrame
        disabled={disabled}
        leading={
          <BaseBox
            as="input" type="color" value={value} disabled={disabled}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            className="color-field__swatch" aria-label={`${label} color`}
          />
        }
      >
        <BaseBox
          as="input" type="text" value={value} disabled={disabled} spellCheck={false}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(normalizeHex(e.target.value))}
          className="input-frame__input color-field__hex" aria-label={`${label} hex value`}
        />
      </InputFrame>
    </BaseBox>
  );
}
