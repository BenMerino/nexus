import React from 'react';
import { BaseBox } from '../primitives/index.js';
import './toggle.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, size = 'md', disabled = false, className }: ToggleProps) {
  return (
    <BaseBox
      as="button"
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`toggle toggle--${size} ${checked ? 'toggle--on' : 'toggle--off'} ${disabled ? 'toggle--disabled' : ''} ${className ?? ''}`}
    >
      <BaseBox className="toggle__knob" />
    </BaseBox>
  );
}
