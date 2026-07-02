import React from 'react';
import { BaseBox, BaseText, BaseAction } from '../../ui/primitives';
import { InputFrame } from '../../ui/composed/InputFrame';
import type { Investigator } from './types';

/* Investigator sub-editor — a list of {name, orcid, role} rows with exactly one
 * PI (rol=IR); the rest are Co (CO). Add appends a blank row; remove is disabled
 * at one row. Replaces the legacy investigatorRow innerHTML + bindInvListeners.
 * Controlled: the parent owns the array; this emits the next array on change. */

export function InvestigatorRows({ value, onChange }: {
  value: Investigator[];
  onChange: (next: Investigator[]) => void;
}) {
  const set = (i: number, patch: Partial<Investigator>) =>
    onChange(value.map((inv, j) => (j === i ? { ...inv, ...patch } : inv)));

  const setPI = (i: number) =>
    onChange(value.map((inv, j) => ({ ...inv, rol: j === i ? 'IR' : 'CO' })));

  const add = () => onChange([...value, { rol: 'CO', full_name: '', orcid: '' }]);
  const remove = (i: number) => { if (value.length > 1) onChange(value.filter((_, j) => j !== i)); };

  return (
    <BaseBox display="flex" flexDirection="col" gap="2">
      <BaseText variant="micro" color="muted">
        Mark PI as the principal investigator. ORCID is optional but recommended.
      </BaseText>
      {value.map((inv, i) => (
        <BaseBox key={i} display="flex" gap="2" align="center">
          <InputFrame className="inv-name-frame">
            <BaseBox as="input" className="input-frame__input" placeholder="Full name"
              value={inv.full_name} onChange={(e: any) => set(i, { full_name: e.target.value })} />
          </InputFrame>
          <InputFrame className="inv-orcid-frame">
            <BaseBox as="input" className="input-frame__input" placeholder="ORCID (optional)"
              style={{ fontFamily: 'var(--font-mono)' }}
              value={inv.orcid ?? ''} onChange={(e: any) => set(i, { orcid: e.target.value })} />
          </InputFrame>
          <BaseAction variant={inv.rol === 'IR' ? 'primary' : 'outline'} size="sm"
            onClick={() => setPI(i)} title="Principal Investigator">PI</BaseAction>
          <BaseAction variant="ghost" size="sm" disabled={value.length <= 1}
            onClick={() => remove(i)} title="Remove">×</BaseAction>
        </BaseBox>
      ))}
      <BaseBox>
        <BaseAction variant="outline" size="sm" onClick={add}>+ Investigator</BaseAction>
      </BaseBox>
    </BaseBox>
  );
}
