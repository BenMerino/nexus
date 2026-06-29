import React from 'react';
import { BaseBox, BaseText, Skeleton } from '../../ui/primitives';

/* Stat — a nexus app molecule (no Zincro equivalent), rebuilt on the vendored
 * BaseBox/BaseText primitives. The `.stat*` class names are kept so existing
 * shared.css rules (grid placement) still apply.
 *
 * The loading state lives WITH the component: pass `loading` (the value ghosts
 * via the Skeleton primitive) or render <Stat.Skeleton …/>. Same markup → the
 * skeleton's geometry is byte-identical to the loaded Stat, by construction. */

export function Stat({ label, value, sub, accent, loading, placeholder = '0,000' }: {
  label: string; value?: React.ReactNode; sub?: React.ReactNode; accent?: boolean;
  loading?: boolean; placeholder?: string;
}) {
  return (
    <BaseBox display="flex" flexDirection="col" className="stat">
      <BaseText as="div" variant="label" color="muted" className="stat-label">{label}</BaseText>
      {loading
        ? <Skeleton as="span" className="stat-value">{placeholder}</Skeleton>
        : <BaseText as="div" variant="h2" className="stat-value"
            style={accent ? { color: 'var(--accent)' } : undefined}>{value}</BaseText>}
      {sub && <BaseText as="div" variant="caption" color="muted" className="stat-sub">{sub}</BaseText>}
    </BaseBox>
  );
}

/** The skeleton travels with the component. <Stat.Skeleton label sub /> ≡
 *  <Stat loading label sub />. */
export function StatSkeleton({ label, sub, placeholder }: {
  label: string; sub?: React.ReactNode; placeholder?: string;
}) {
  return <Stat loading label={label} sub={sub} placeholder={placeholder} />;
}
Stat.Skeleton = StatSkeleton;
