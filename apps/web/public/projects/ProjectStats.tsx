import React from 'react';
import { BaseBox } from '../../ui/primitives';
import { Stat } from '../ui-kit';
import { fmtCLP } from './funding';
import type { Project } from './types';

/* The four summary stats over ALL projects (not the filtered view — matches the
 * legacy renderStats, which always passed state.projects). */

export function ProjectStats({ projects }: { projects: Project[] }) {
  const total = projects.length;
  const amount = projects.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const conc = projects.filter((p) => p.concursable).length;
  const ext = projects.filter((p) => p.externo).length;
  return (
    <BaseBox className="stat-row reveal-group">
      <Stat label="Active projects" value={total} sub="all faculties" />
      <Stat label="Total amount" value={fmtCLP(amount)} sub="committed" accent />
      <Stat label="Competitive" value={conc} sub={`of ${total} projects`} />
      <Stat label="External" value={ext} sub="external funding" />
    </BaseBox>
  );
}
