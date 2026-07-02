import React, { useState } from 'react';
import {
  BaseBox, BaseText, BaseAction, BaseCheckbox, BaseIcon, BaseTile, BaseNested,
  Nestable, Divider, StatusPill, MetaChip, TweenedNumber, Skeleton,
} from '../ui/primitives';
import { Search, Check, Calendar } from '../ui/icons';

/* The DNA catalog sections — live renders of the vendored Zincro primitives +
 * composed components, proving the token contract (dna-defaults + dna-bridge)
 * themes them with nexus's palette. This is the gallery body. Every primitive
 * the barrel (ui/primitives/index.ts) exports appears here — the catalog IS the
 * export list, rendered. */

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
  const [n, setN] = useState(1247);
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
      <Row title="BaseTile — variants & shape">
        <BaseTile variant="default"><BaseIcon icon={Search} size="sm" /></BaseTile>
        <BaseTile variant="primary" shape="square"><BaseIcon icon={Check} size="sm" /></BaseTile>
        <BaseTile variant="bare"><BaseIcon icon={Calendar} size="sm" /></BaseTile>
        <BaseTile variant="default" active>active</BaseTile>
      </Row>
      <Row title="BaseIcon — sizes">
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map(s => (
          <BaseIcon key={s} icon={Search} size={s} />
        ))}
        <BaseIcon icon={Check} size="md" color="var(--ok)" />
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
      <Row title="TweenedNumber">
        <BaseText variant="h2"><TweenedNumber value={n} format={v => v.toLocaleString()} /></BaseText>
        <BaseAction variant="outline" size="sm" onClick={() => setN(x => x + 613)}>+613</BaseAction>
        <BaseAction variant="ghost" size="sm" onClick={() => setN(1247)}>reset</BaseAction>
      </Row>
      <Row title="Skeleton">
        <Skeleton block width={120} height={16} />
        <Skeleton block width={64} height={16} radius="pill" />
        <Skeleton block width={40} height={40} radius="card" />
      </Row>
      <Row title="BaseNested (inside Nestable)">
        <Nestable parentRadius="surface-md">
          <BaseBox p="4" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-surface-md)', border: 'var(--border-w) solid var(--border-main)' }}>
            <BaseNested inset="tight" surface="elevated">
              <BaseText variant="detail">nested badge</BaseText>
            </BaseNested>
          </BaseBox>
        </Nestable>
      </Row>
      <Divider />
    </div>
  );
}
