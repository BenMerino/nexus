import React from 'react';
import { BaseBox, BaseAction } from '../../ui/primitives';
import type { Project } from './types';

/* Faculty filter pills — "All · N" plus one per faculty present, with counts.
 * A dynamic set (not a fixed SegmentedPill), so each is a BaseAction toggle:
 * the active filter is `primary`, the rest `outline`. */

export function ProjectFilters({ projects, active, onChange }: {
  projects: Project[];
  active: string;
  onChange: (dept: string) => void;
}) {
  const counts: Record<string, number> = {};
  for (const p of projects) {
    if (p.departamento) counts[p.departamento] = (counts[p.departamento] || 0) + 1;
  }
  const depts = Object.keys(counts).sort();
  const pill = (value: string, label: string) => (
    <BaseAction key={value} size="sm" variant={active === value ? 'primary' : 'outline'}
      onClick={() => onChange(value)}>{label}</BaseAction>
  );
  return (
    <BaseBox display="flex" gap="2" align="center" style={{ flexWrap: 'wrap' }}>
      {pill('all', `All · ${projects.length}`)}
      {depts.map((d) => pill(d, `${d} · ${counts[d]}`))}
    </BaseBox>
  );
}
