import React, { useEffect, useState } from 'react';
import { ES } from './tenant-i18n';
import type { Unit } from './tenant-org-row';

// The scope a selected unit carries (shared with tenant.tsx / Overview /
// Summary). Lived in tenant-org-tree before the rail replaced the tree.
export interface UnitScope { unitKey: string; name: string; }

/* The scope rail = the mockup's flat unit list. Each faculty/institute is a
 * selectable row (name + kind tag + publication count + a mini usage bar);
 * clicking re-scopes the Overview, an "All units" row resets it. Replaces the
 * collapsible org-tree in the rail (the tree's drill-to-people is dropped here
 * — scope is faculty/institute level). Same /org-tree payload as the tree. */

interface Faculty extends Unit { kind: 'faculty' | 'institute' | 'other'; }
interface OrgTree { faculties: Faculty[]; }

const KIND_LABEL = ES.orgTree.kindLabel;

function Row({ name, kind, papers, max, active, onClick }: {
  name: string; kind?: string; papers: number; max: number; active: boolean; onClick: () => void;
}) {
  const pct = max > 0 ? Math.max(2, (papers / max) * 100) : 0;
  return (
    <div className={`scope-unit${active ? ' active' : ''}`} onClick={onClick}>
      <span className="scope-unit-name">{name}</span>
      <span className="scope-unit-val num">{papers.toLocaleString()}</span>
      {kind ? <span className="scope-unit-kind">{kind}</span> : null}
      <span className="scope-unit-bar"><i style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

export function TenantScopeRail({ slug, tenantName, selected, onSelect }: {
  slug: string; tenantName?: string; selected: UnitScope | null; onSelect: (u: UnitScope | null) => void;
}) {
  const [data, setData] = useState<OrgTree | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(r => (r.ok ? r.json() as Promise<OrgTree> : Promise.reject(new Error(`Org tree failed (${r.status})`))))
      .then(setData)
      .catch(e => setError(e.message));
  }, [slug]);

  const selKey = selected?.unitKey ?? null;
  if (error) return <div className="org-err" style={{ padding: 14 }}>{error}</div>;
  if (!data) return <div className="scope-rail-empty">{ES.loadingLabel(ES.orgSchemeLoading)}</div>;
  if (!data.faculties.length) return <div className="scope-rail-empty">{ES.orgTree.noRoster}</div>;

  const ranked = [...data.faculties].sort((a, b) => b.papers - a.papers);
  const total = ranked.reduce((s, f) => s + f.papers, 0);
  const max = ranked.length ? ranked[0].papers : 0;

  return (
    <div className="scope-list">
      <div className={`scope-unit${selKey === null ? ' active' : ''}`} onClick={() => onSelect(null)}>
        <span className="scope-unit-name">{tenantName || ES.orgTree.allOrganization}</span>
        <span className="scope-unit-val num">{total.toLocaleString()}</span>
        <span className="scope-unit-kind">{ES.scopeRail.allUnitsKind}</span>
        <span className="scope-unit-bar"><i style={{ width: '100%' }} /></span>
      </div>
      {ranked.map(f => (
        <Row key={f.name} name={f.name} kind={KIND_LABEL[f.kind]} papers={f.papers} max={max}
          active={f.unitKey != null && selKey === f.unitKey}
          onClick={() => { if (f.unitKey) onSelect({ unitKey: f.unitKey, name: f.name }); }} />
      ))}
    </div>
  );
}
