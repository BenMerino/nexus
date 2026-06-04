import React from 'react';
import { ES } from './tenant-i18n';

/* Row primitives for the org-scheme rail (contributors ranking + scope picker):
 * the metric model (value/format/rank), the inline ranked Bar, and the leaf
 * PersonRow. Split from tenant-org-tree.tsx to keep each file one concern under
 * the size cap. */

export interface Person { name: string; category: string | null; orcid: string | null; paperCount: number; }
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

export function PersonRow({ p }: { p: Person }) {
  return (
    <div className="org-node">
      <div className="org-row leaf">
        <span className="org-twist" />
        <span className="org-name person">{p.name} <span className="text-muted">· {p.category || ''}</span></span>
        <span className="org-metrics">
          {p.orcid
            ? <a className="org-orcid" href={`https://orcid.org/${p.orcid}`} target="_blank" rel="noopener noreferrer">{p.orcid}</a>
            : <span className="org-orcid none">{ES.orgTree.orcidNone}</span>}
          <span className="org-pill">{p.paperCount} {p.paperCount === 1 ? ES.orgTree.paperOne : ES.orgTree.paperMany}</span>
        </span>
      </div>
    </div>
  );
}
