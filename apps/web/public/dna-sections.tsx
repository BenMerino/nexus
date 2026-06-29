import React, { useState } from 'react';
import {
  BaseBox, BaseText, BaseAction, BaseCheckbox, Divider, StatusPill, MetaChip,
} from '../ui/primitives';
import { Button } from '../ui/composed/Button';
import { SegmentedControl } from '../ui/composed/SegmentedControl';
import { Popover } from '../ui/composed/Popover';

/* The DNA catalog sections — live renders of the vendored Zincro primitives +
 * composed components, proving the token contract (dna-defaults + dna-bridge)
 * themes them with nexus's palette. This is the gallery body. */

const BASE_ACTION_VARIANTS = [
  'primary', 'secondary', 'danger', 'warning', 'ghost', 'outline',
  'danger-soft', 'warning-soft', 'success-soft', 'info-soft',
] as const;

export function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <BaseBox display="flex" flexDirection="col" gap="3" style={{ marginBottom: 'var(--space-8)' }}>
      <BaseText as="h3" variant="label" color="muted">{title}</BaseText>
      <BaseBox display="flex" gap="3" align="center" style={{ flexWrap: 'wrap' }}>
        {children}
      </BaseBox>
    </BaseBox>
  );
}

export function PrimitivesSection() {
  const [checked, setChecked] = useState(true);
  return (
    <div>
      <Row title="BaseAction — all variants (md)">
        {BASE_ACTION_VARIANTS.map(v => (
          <BaseAction key={v} variant={v}>{v}</BaseAction>
        ))}
      </Row>
      <Row title="BaseAction — sizes">
        <BaseAction variant="primary" size="sm">small</BaseAction>
        <BaseAction variant="primary" size="md">medium</BaseAction>
        <BaseAction variant="primary" size="lg">large</BaseAction>
        <BaseAction variant="primary" loading>loading</BaseAction>
      </Row>
      <Row title="StatusPill">
        <StatusPill tone="success" label="Active" />
        <StatusPill tone="warning" label="Pending" />
        <StatusPill tone="danger" label="Failed" />
        <StatusPill tone="info" label="Info" />
      </Row>
      <Row title="MetaChip / BaseCheckbox / Divider">
        <MetaChip>metadata chip</MetaChip>
        <BaseCheckbox checked={checked} onChange={e => setChecked(e.target.checked)} aria-label="demo" />
        <BaseText variant="detail" color="muted">label</BaseText>
      </Row>
      <Divider />
    </div>
  );
}

export function ComposedSection() {
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');
  return (
    <div>
      <Row title="Button (composed) — variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
      </Row>
      <Row title="SegmentedControl">
        <SegmentedControl<'day' | 'week' | 'month'>
          segments={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Row>
      <Row title="Popover (the composition engine)">
        <Popover
          trigger={({ toggle, ref }) => (
            <BaseAction ref={ref as any} variant="secondary" onClick={toggle}>Open popover</BaseAction>
          )}
        >
          {(close) => (
            <BaseBox display="flex" flexDirection="col" gap="2" p="4"
              style={{ minWidth: '200px' }}>
              <BaseText variant="body">Popover panel content.</BaseText>
              <BaseText variant="detail" color="muted">
                Viewport-aware, edge-flip, glass reveal.
              </BaseText>
              <BaseAction variant="primary" size="sm" onClick={close}>Close</BaseAction>
            </BaseBox>
          )}
        </Popover>
      </Row>
    </div>
  );
}
