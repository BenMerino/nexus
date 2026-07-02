import React from 'react';
import { BaseBox, BaseText } from '../../ui/primitives';

/* One labelled form field — a label above its control, with an optional muted
 * hint below (used for the live CLP amount). Grows to fill its flex row. */

export function Field({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <BaseBox display="flex" flexDirection="col" gap="1" style={{ flex: '1 1 220px', minWidth: 0 }}>
      <BaseText variant="label" color="muted">{label}</BaseText>
      {children}
      {hint && <BaseText variant="micro" color="muted" style={{ fontFamily: 'var(--font-mono)' }}>{hint}</BaseText>}
    </BaseBox>
  );
}
