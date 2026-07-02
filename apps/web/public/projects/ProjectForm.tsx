import React from 'react';
import { BaseBox, BaseText } from '../../ui/primitives';
import { InputFrame } from '../../ui/composed/InputFrame';
import { Select } from '../../ui/composed/Select';
import { NumberField } from '../../ui/composed/NumberField';
import { DatePicker } from '../../ui/composed/DatePicker';
import { SegmentedPill } from '../../ui/composed/SegmentedPill';
import { InvestigatorRows } from './InvestigatorRows';
import { Field } from './ProjectFormField';
import { FUNDING_SOURCES, FACULTIES, fundingByName, fmtCLP } from './funding';
import type { ProjectDraft } from './types';

/* The project create/edit form — DNA components only (no native <select>/<input
 * type=date>, no innerHTML). Controlled: parent owns the draft. Selecting a
 * funding source auto-sets the competitive/external toggles from the catalog
 * (the legacy p-funding change handler). */

const FUNDING_OPTS = FUNDING_SOURCES.map((f) => ({ value: f.name, label: f.name }));
const FACULTY_OPTS = [{ value: '', label: '— Select —' }, ...FACULTIES.map((f) => ({ value: f, label: f }))];
const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

export function ProjectForm({ draft, onChange }: {
  draft: ProjectDraft;
  onChange: (patch: Partial<ProjectDraft>) => void;
}) {
  const onFunding = (name: string) => {
    const src = fundingByName(name);
    onChange(src
      ? { fuente_financiamiento: name, concursable: src.concursable, externo: src.external }
      : { fuente_financiamiento: name });
  };

  return (
    <BaseBox display="flex" flexDirection="col" gap="4">
      <Field label="Title">
        <InputFrame>
          <BaseBox as="input" className="input-frame__input" placeholder="Project title"
            value={draft.titulo} onChange={(e: any) => onChange({ titulo: e.target.value })} />
        </InputFrame>
      </Field>
      <BaseBox display="flex" gap="4" style={{ flexWrap: 'wrap' }}>
        <Field label="Funding source">
          <Select value={draft.fuente_financiamiento ?? ''} onChange={onFunding} options={FUNDING_OPTS} placeholder="— Select —" />
        </Field>
        <Field label="Code / ID">
          <InputFrame>
            <BaseBox as="input" className="input-frame__input" placeholder="1240187" style={{ fontFamily: 'var(--font-mono)' }}
              value={draft.codigo ?? ''} onChange={(e: any) => onChange({ codigo: e.target.value })} />
          </InputFrame>
        </Field>
      </BaseBox>
      <BaseBox display="flex" gap="4" style={{ flexWrap: 'wrap' }}>
        <Field label="Amount (CLP)" hint={draft.monto ? fmtCLP(draft.monto) : undefined}>
          <NumberField value={draft.monto != null ? String(draft.monto) : ''} min={0}
            onChange={(v) => onChange({ monto: v ? Number(v) : null })} placeholder="0" />
        </Field>
        <Field label="Faculty">
          <Select value={draft.departamento ?? ''} onChange={(v) => onChange({ departamento: v || null })} options={FACULTY_OPTS} placeholder="— Select —" />
        </Field>
      </BaseBox>
      <BaseBox display="flex" gap="4" style={{ flexWrap: 'wrap' }}>
        <Field label="Start date">
          <DatePicker value={draft.fecha_inicio ?? ''} onChange={(v) => onChange({ fecha_inicio: v || null })} />
        </Field>
        <Field label="End date">
          <DatePicker value={draft.fecha_fin ?? ''} onChange={(v) => onChange({ fecha_fin: v || null })} />
        </Field>
      </BaseBox>
      <BaseBox display="flex" gap="4" style={{ flexWrap: 'wrap' }}>
        <Field label="Competitive">
          <SegmentedPill options={YES_NO} value={draft.concursable ? 'yes' : 'no'}
            onChange={(v) => onChange({ concursable: v === 'yes' })} />
        </Field>
        <Field label="External">
          <SegmentedPill options={YES_NO} value={draft.externo ? 'yes' : 'no'}
            onChange={(v) => onChange({ externo: v === 'yes' })} />
        </Field>
      </BaseBox>
      <Field label="Notes">
        <InputFrame>
          <BaseBox as="textarea" className="input-frame__input" rows={2} placeholder="Remarks, external collaborators, etc."
            value={draft.notas ?? ''} onChange={(e: any) => onChange({ notas: e.target.value })} />
        </InputFrame>
      </Field>
      <Field label="Investigators">
        <InvestigatorRows value={draft.investigators} onChange={(investigators) => onChange({ investigators })} />
      </Field>
    </BaseBox>
  );
}
