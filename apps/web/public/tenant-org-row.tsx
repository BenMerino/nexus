import React from 'react';

/* Shared primitives for the contributors ranking and the scope rail: the unit
 * metric model (value/format/rank) and the inline ranked Bar. */

export interface Unit { name: string; unitKey: string | null; headcount: number; withOrcid: number; papers: number; citations: number; }

export type Metric = 'papers' | 'perCapita' | 'citations';
export const METRICS: { id: Metric; label: string }[] = [
  { id: 'papers', label: ES.contributors.volume },
  { id: 'perCapita', label: ES.contributors.perCapita },
  { id: 'citations', label: ES.contributors.citations },
];
export const valueOf = (u: Unit, m: Metric): number =>
  m === 'papers' ? u.papers
  : m === 'citations' ? u.citations
  : u.headcount > 0 ? u.papers / u.headcount : 0;
export const fmt = (v: number, m: Metric) =>
  m === 'perCapita' ? v.toFixed(1) : Math.round(v).toLocaleString();
export function rank<T extends Unit>(units: T[], m: Metric): T[] {
  return [...units].sort((a, b) => valueOf(b, m) - valueOf(a, m) || a.name.localeCompare(b.name));
}

export function Bar({ value, max, metric }: { value: number; max: number; metric: Metric }) {
  return (
    <span className="org-bar" title={fmt(value, metric)}>
      <span className="org-bar-track">
        <span className="org-bar-fill" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </span>
      <span className="org-bar-val">{fmt(value, metric)}</span>
    </span>
  );
}
