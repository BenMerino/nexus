// A labeled text field for the login form: a `label` role caption stacked over
// an InputFrame wrapping a bare input. Same assembly as SearchField (InputFrame
// + .input-frame__input reset) so the field inherits the one shared input shell
// — border, focus ring, radius, disabled — rather than redrawing chrome here.

import React from "react";
import { BaseBox, BaseText } from "../../ui/primitives";
import { InputFrame } from "../../ui/composed/InputFrame";

export interface LoginFieldProps {
  label: string;
  type: "text" | "password";
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  autoFocus?: boolean;
}

export function LoginField({ label, type, value, onChange, autoComplete, autoFocus }: LoginFieldProps) {
  return (
    <BaseBox as="label" direction="col" gap="1-5">
      <BaseText as="span" variant="label" color="muted">{label}</BaseText>
      <InputFrame>
        <BaseBox
          as="input"
          type={type}
          className="input-frame__input"
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      </InputFrame>
    </BaseBox>
  );
}
