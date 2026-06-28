import React from 'react';
import { BaseBox, BaseText } from '../../ui/primitives';

/* Stat / StatSkeleton — nexus app molecules (no Zincro equivalent), rebuilt on
 * the vendored BaseBox/BaseText primitives. The `.stat*` class names are kept so
 * existing shared.css rules (grid placement, skeleton shimmer) still apply —
 * the primitives provide the layout + type scale, the classes the surface. */

export function Stat({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean;
}) {
  return (
    <BaseBox display="flex" flexDirection="col" className="stat">
      <BaseText as="div" variant="label" color="muted" className="stat-label">{label}</BaseText>
      <BaseText as="div" variant="h2" className="stat-value"
        style={accent ? { color: 'var(--accent)' } : undefined}>{value}</BaseText>
      {sub && <BaseText as="div" variant="caption" color="muted" className="stat-sub">{sub}</BaseText>}
    </BaseBox>
  );
}

export function StatSkeleton({ label, sub, placeholder = '0,000' }: {
  label: string; sub?: string; placeholder?: string;
}) {
  return (
    <BaseBox display="flex" flexDirection="col" className="stat">
      <BaseText as="div" variant="label" color="muted" className="stat-label">{label}</BaseText>
      <BaseText as="div" variant="h2" className="stat-value skel"
        style={{ display: 'inline-block' }}>{placeholder}</BaseText>
      {sub && <BaseText as="div" variant="caption" color="muted" className="stat-sub">{sub}</BaseText>}
    </BaseBox>
  );
}
